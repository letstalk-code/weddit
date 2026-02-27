import json
import os
import tempfile
import time
import uuid
from pathlib import Path

import boto3
import modal
from botocore.exceptions import ClientError

app = modal.App('weddit-worker')

image = modal.Image.debian_slim().pip_install([
    'faster-whisper',
    'pyannote.audio',
    'boto3',
    'textblob',
    'fastapi[standard]',
])

_whisper_model = None
_diarization_pipeline = None


def get_whisper_model():
    from faster_whisper import WhisperModel
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = WhisperModel('base', device='cuda', compute_type='float16')
    return _whisper_model


def get_diarization_pipeline():
    from pyannote.audio import Pipeline
    global _diarization_pipeline
    if _diarization_pipeline is None:
        token = os.environ.get('PYANNOTE_AUTH_TOKEN')
        if not token:
            raise RuntimeError('PYANNOTE_AUTH_TOKEN is required for diarization')
        _diarization_pipeline = Pipeline.from_pretrained(
            'pyannote/speaker-diarization-3.1', use_auth_token=token
        )
    return _diarization_pipeline


def get_s3():
    return boto3.client(
        's3',
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
    )


def get_bucket_name() -> str:
    bucket = os.environ.get('R2_BUCKET_NAME')
    if not bucket:
        raise RuntimeError('R2_BUCKET_NAME must be set')
    return bucket


def meta_key(project_id: str) -> str:
    return f'projects/{project_id}/meta.json'


def output_key(project_id: str, name: str) -> str:
    return f'projects/{project_id}/outputs/{name}.json'


def load_json(s3, bucket: str, key: str) -> dict:
    response = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(response['Body'].read().decode('utf-8'))


def write_json(s3, bucket: str, key: str, payload: dict) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload).encode('utf-8'),
        ContentType='application/json',
    )


def load_meta(s3, bucket: str, project_id: str) -> dict:
    try:
        return load_json(s3, bucket, meta_key(project_id))
    except ClientError as err:
        code = err.response.get('Error', {}).get('Code')
        if code in ('NoSuchKey', '404', 'NotFound'):
            now_ms = int(time.time() * 1000)
            return {
                'id': project_id,
                'title': project_id,
                'status': 'created',
                'createdAt': now_ms,
                'updatedAt': now_ms,
            }
        raise


def save_meta(s3, bucket: str, project_id: str, meta: dict) -> None:
    write_json(s3, bucket, meta_key(project_id), meta)


def update_meta_status(s3, bucket: str, project_id: str, status: str) -> None:
    meta = load_meta(s3, bucket, project_id)
    meta['status'] = status
    meta['updatedAt'] = int(time.time() * 1000)
    save_meta(s3, bucket, project_id, meta)


def find_audio_key(s3, bucket: str, project_id: str) -> tuple[str, str]:
    extensions = ('mp3', 'mp4', 'wav', 'm4a')
    for ext in extensions:
        key = f'projects/{project_id}/uploads/audio.{ext}'
        try:
            s3.head_object(Bucket=bucket, Key=key)
            return key, ext
        except ClientError as err:
            code = err.response.get('Error', {}).get('Code')
            if code in ('NoSuchKey', '404', 'NotFound'):
                continue
            raise
    raise RuntimeError('No uploaded audio file found')


def download_audio(s3, bucket: str, key: str, extension: str) -> Path:
    response = s3.get_object(Bucket=bucket, Key=key)
    with tempfile.NamedTemporaryFile(suffix=f'.{extension}', delete=False) as tmpfile:
        tmpfile.write(response['Body'].read())
        return Path(tmpfile.name)


def transcribe_audio(audio_path: Path) -> list[dict]:
    model = get_whisper_model()
    segments, _ = model.transcribe(
        str(audio_path), word_timestamps=True, language='en'
    )
    words = []
    for segment in segments:
        for word in segment.words:
            token = getattr(word, 'word', None) or getattr(word, 'text', '') or ''
            confidence = getattr(word, 'probability', None)
            if confidence is None:
                confidence = 0.0
            confidence = max(0.0, min(1.0, float(confidence)))
            words.append(
                {
                    'start_ms': int(word.start * 1000),
                    'end_ms': int(word.end * 1000),
                    'word': token.strip(),
                    'speaker': 'unknown',
                    'confidence': confidence * 100,
                }
            )
    return words


def diarize_audio(audio_path: Path):
    pipeline = get_diarization_pipeline()
    return pipeline({'uri': f'project-{uuid.uuid4()}', 'audio': str(audio_path)})


def align_speakers(words: list[dict], diarization) -> list[dict]:
    aligned = []
    for word in words:
        mid_point = (word['start_ms'] + word['end_ms']) / 2 / 1000
        speaker_label = 'Speaker 0'
        for segment, _, label in diarization.itertracks(yield_label=True):
            if segment.start <= mid_point < segment.end:
                speaker_label = label
                break
        aligned_word = word.copy()
        aligned_word['speaker'] = speaker_label
        aligned.append(aligned_word)
    return aligned


def build_segments(words: list[dict]) -> list[dict]:
    groups: list[list[dict]] = []
    buffer: list[dict] = []
    for word in words:
        if not buffer:
            buffer.append(word)
            continue
        prev = buffer[-1]
        pause_ms = word['start_ms'] - prev['end_ms']
        speaker_changed = word['speaker'] != buffer[0]['speaker']
        previous_text = (prev.get('word') or '').strip()
        sentence_end = previous_text.endswith(('.', '?', '!'))
        duration_ms = word['end_ms'] - buffer[0]['start_ms']
        should_break = (
            len(buffer) >= 3
            and (
                pause_ms > 600
                or speaker_changed
                or sentence_end
                or duration_ms >= 45_000
            )
        )
        if should_break:
            groups.append(buffer.copy())
            buffer = []
        buffer.append(word)
    if buffer:
        if len(buffer) >= 3 or not groups:
            groups.append(buffer.copy())
        else:
            groups[-1].extend(buffer)
    segments = [create_segment(group) for group in groups if group]
    return segments


def create_segment(words: list[dict]) -> dict:
    start_ms = words[0]['start_ms']
    end_ms = words[-1]['end_ms']
    text = ' '.join(word['word'] for word in words).strip()
    speaker = words[0]['speaker']
    emotion_score = calculate_emotion(text, len(words))
    story_score = calculate_story(text)
    clarity_score = calculate_clarity(words, (end_ms - start_ms) / 1000)
    return {
        'id': uuid.uuid4().hex,
        'start_ms': start_ms,
        'end_ms': end_ms,
        'speaker': speaker,
        'text': text,
        'emotion_score': emotion_score,
        'story_score': story_score,
        'clarity_score': clarity_score,
    }


def calculate_emotion(text: str, word_count: int) -> float:
    from textblob import TextBlob
    if not text:
        return 50.0
    polarity = TextBlob(text).sentiment.polarity
    score = ((polarity + 1) / 2) * 100
    if '!' in text:
        score += 5
    exclamation_density = text.count('!') / max(word_count, 1)
    if exclamation_density > 0.1:
        score += 10
    return clamp(score)


def calculate_story(text: str) -> float:
    lower = text.lower()
    keywords = ['promise', 'love', 'remember', 'forever', 'always', 'never', 'moment']
    score = 10
    for keyword in keywords:
        if keyword in lower:
            score += 12
    pronouns = {'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours'}
    words = [word.strip(".,!?;:'\"").lower() for word in lower.split()]
    if pronouns & set(words):
        score += 15
    return clamp(score)


def calculate_clarity(words: list[dict], duration_sec: float) -> float:
    fillers = {'uh', 'um', 'like'}
    normalized = [
        word['word'].strip().strip('.?!,').lower()
        for word in words
        if word.get('word')
    ]
    filler_count = sum(1 for token in normalized if token in fillers)
    ratio = (filler_count / max(len(words), 1)) * 100
    penalty = 0
    if duration_sec < 3:
        penalty += 10
    if duration_sec > 40:
        penalty += 10
    clarity = 100 - ratio - penalty
    return clamp(clarity)


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


@app.function(gpu='T4', timeout=600, image=image, secrets=[modal.Secret.from_name('weddit-secrets')])
@modal.fastapi_endpoint(method='POST')
def process_project(data: dict) -> dict:
    project_id = data.get('project_id')
    if not project_id:
        return {'error': 'project_id required'}
    _run_process_project(project_id)
    return {'status': 'processing', 'project_id': project_id}


def _run_process_project(project_id: str) -> None:
    s3 = get_s3()
    bucket = get_bucket_name()
    audio_path: Path | None = None
    try:
        update_meta_status(s3, bucket, project_id, 'processing')
        key, extension = find_audio_key(s3, bucket, project_id)
        audio_path = download_audio(s3, bucket, key, extension)
        words = transcribe_audio(audio_path)
        diarization = diarize_audio(audio_path)
        aligned_words = align_speakers(words, diarization)
        transcript_payload = {'words': aligned_words}
        segment_payload = build_segments(aligned_words)
        write_json(s3, bucket, output_key(project_id, 'transcript'), transcript_payload)
        write_json(s3, bucket, output_key(project_id, 'segments'), segment_payload)
        update_meta_status(s3, bucket, project_id, 'ready')
    except Exception as exc:
        print(f'Failed to process project {project_id}:', exc)
        update_meta_status(s3, bucket, project_id, 'error')
        raise
    finally:
        if audio_path and audio_path.exists():
            audio_path.unlink()


@app.local_entrypoint()
def local_test():
    process_project.remote({'project_id': 'test-project-id'})
