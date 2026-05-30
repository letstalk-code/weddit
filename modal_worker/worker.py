from __future__ import annotations

import json
import os
import time

import boto3
import modal
import requests
from botocore.exceptions import ClientError

app = modal.App('weddit-worker')

# No GPU and no ML libraries needed: Deepgram does the transcription + speaker
# diarization in one fast hosted call. The worker just orchestrates and scores.
image = modal.Image.debian_slim().pip_install([
    'requests',
    'boto3',
    'textblob',
    'fastapi[standard]',
])

DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen'


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


def write_json(s3, bucket: str, key: str, payload) -> None:
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
    if status in ('ready', 'error', 'created'):
        meta.pop('stage', None)
    meta['updatedAt'] = int(time.time() * 1000)
    save_meta(s3, bucket, project_id, meta)


def update_meta_stage(s3, bucket: str, project_id: str, stage: str,
                      audio_duration_sec=None) -> None:
    # Reports which processing step is currently running so the UI can show
    # a progress indicator. Keeps status as 'processing'.
    meta = load_meta(s3, bucket, project_id)
    meta['status'] = 'processing'
    meta['stage'] = stage
    if 'startedAt' not in meta:
        meta['startedAt'] = int(time.time() * 1000)
    if audio_duration_sec is not None:
        meta['audioDurationSec'] = round(audio_duration_sec)
    meta['updatedAt'] = int(time.time() * 1000)
    save_meta(s3, bucket, project_id, meta)


def find_audio_key(s3, bucket: str, project_id: str) -> str:
    extensions = ('mp3', 'mp4', 'wav', 'm4a', 'mov')
    for ext in extensions:
        key = f'projects/{project_id}/uploads/audio.{ext}'
        try:
            s3.head_object(Bucket=bucket, Key=key)
            return key
        except ClientError as err:
            code = err.response.get('Error', {}).get('Code')
            if code in ('NoSuchKey', '404', 'NotFound'):
                continue
            raise
    raise RuntimeError('No uploaded audio file found')


def presign_get(s3, bucket: str, key: str, expires: int = 3600) -> str:
    # Deepgram fetches the audio directly from this URL, so we never download it.
    return s3.generate_presigned_url(
        'get_object', Params={'Bucket': bucket, 'Key': key}, ExpiresIn=expires
    )


def transcribe_with_deepgram(audio_url: str) -> dict:
    api_key = os.environ.get('DEEPGRAM_API_KEY')
    if not api_key:
        raise RuntimeError('DEEPGRAM_API_KEY is not set')
    params = {
        'model': 'nova-2',
        'diarize': 'true',
        'punctuate': 'true',
        'smart_format': 'true',
        'language': 'en',
    }
    response = requests.post(
        DEEPGRAM_URL,
        params=params,
        headers={'Authorization': f'Token {api_key}', 'Content-Type': 'application/json'},
        json={'url': audio_url},
        timeout=600,
    )
    if response.status_code != 200:
        raise RuntimeError(f'Deepgram error {response.status_code}: {response.text[:500]}')
    return response.json()


def parse_deepgram_words(payload: dict) -> list:
    channels = payload.get('results', {}).get('channels', [])
    if not channels:
        return []
    alternatives = channels[0].get('alternatives', [])
    if not alternatives:
        return []
    words = []
    for w in alternatives[0].get('words', []):
        speaker_idx = w.get('speaker')
        speaker = f'Speaker {speaker_idx}' if speaker_idx is not None else 'Speaker 0'
        text = (w.get('punctuated_word') or w.get('word') or '').strip()
        confidence = float(w.get('confidence', 0.0) or 0.0)
        words.append({
            'start_ms': int(float(w.get('start', 0)) * 1000),
            'end_ms': int(float(w.get('end', 0)) * 1000),
            'word': text,
            'speaker': speaker,
            'confidence': max(0.0, min(1.0, confidence)) * 100,
        })
    return words


# ── Segment building + scoring (unchanged logic) ─────────────────────────────

def build_segments(words: list) -> list:
    groups = []
    buffer = []
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
    return [create_segment(group) for group in groups if group]


def create_segment(words: list) -> dict:
    import uuid
    start_ms = words[0]['start_ms']
    end_ms = words[-1]['end_ms']
    text = ' '.join(word['word'] for word in words).strip()
    speaker = words[0]['speaker']
    return {
        'id': uuid.uuid4().hex,
        'start_ms': start_ms,
        'end_ms': end_ms,
        'speaker': speaker,
        'text': text,
        'emotion_score': calculate_emotion(text, len(words)),
        'story_score': calculate_story(text),
        'clarity_score': calculate_clarity(words, (end_ms - start_ms) / 1000),
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
    tokens = [word.strip(".,!?;:'\"").lower() for word in lower.split()]
    if pronouns & set(tokens):
        score += 15
    return clamp(score)


def calculate_clarity(words: list, duration_sec: float) -> float:
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
    return clamp(100 - ratio - penalty)


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


# ── Entry point ──────────────────────────────────────────────────────────────

@app.function(timeout=600, image=image, secrets=[modal.Secret.from_name('weddit-secrets')])
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
    try:
        update_meta_stage(s3, bucket, project_id, 'transcribing')
        key = find_audio_key(s3, bucket, project_id)
        audio_url = presign_get(s3, bucket, key)
        payload = transcribe_with_deepgram(audio_url)
        words = parse_deepgram_words(payload)
        duration_sec = payload.get('metadata', {}).get('duration')
        update_meta_stage(s3, bucket, project_id, 'analyzing', audio_duration_sec=duration_sec)
        write_json(s3, bucket, output_key(project_id, 'transcript'), {'words': words})
        write_json(s3, bucket, output_key(project_id, 'segments'), build_segments(words))
        update_meta_status(s3, bucket, project_id, 'ready')
    except Exception as exc:
        print(f'Failed to process project {project_id}:', exc)
        update_meta_status(s3, bucket, project_id, 'error')
        raise


@app.local_entrypoint()
def local_test():
    process_project.remote({'project_id': 'test-project-id'})
