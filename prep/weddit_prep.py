#!/usr/bin/env python3
"""weddit-prep — local footage triage for wedding edits.

Walks a folder of camera files, probes them, flags takes you would never use,
works out multicam offsets from the audio, and writes an FCPXML you can open in
Final Cut. Originals are never modified, never uploaded.

Needs only ffmpeg/ffprobe + numpy/scipy.

    python3 weddit_prep.py scan  FOOTAGE_DIR
    python3 weddit_prep.py sync  FOOTAGE_DIR
    python3 weddit_prep.py build FOOTAGE_DIR -o timeline.fcpxml
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures
import json
import math
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict

import numpy as np
from scipy import signal

MEDIA_EXT = {".mov", ".mp4", ".m4v", ".mxf", ".avi", ".mts", ".m2ts", ".wav", ".aif", ".aiff", ".mp3", ".m4a"}
PLAN_NAME = "weddit-prep.plan.json"

# Long takes (ceremony, speeches) are never "junk" and decoding them costs
# minutes, so skip frame analysis on them — the same trick Hailo uses.
LONG_TAKE_SEC = 600.0
ENVELOPE_HOP_MS = 5.0   # 5ms => sub-frame sync accuracy even at 24fps
ENVELOPE_SR = 8000

# Classifying clips by moment is the one step that needs a model. Stills are
# sent, never the footage — same trade Hailo makes. Haiku is the default
# because a wedding card is hundreds of clips; --model claude-sonnet-5 if the
# labels come back sloppy.
DEFAULT_MODEL = "claude-haiku-4-5-20251001"
STILL_WIDTH = 512
MOMENTS = [
    "getting ready", "details", "first look", "portraits", "ceremony",
    "cocktail hour", "reception decor", "grand entrance", "speeches",
    "first dance", "parent dance", "cake cutting", "dancing", "bouquet toss",
    "exit", "venue", "other",
]


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


# ── probing ───────────────────────────────────────────────────────────────────

@dataclass
class Clip:
    path: str
    name: str
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps_num: int = 0
    fps_den: int = 1
    has_video: bool = False
    has_audio: bool = False
    created: str | None = None
    reject: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    sync_offset: float | None = None
    sync_confidence: float | None = None
    sync_ref: str | None = None
    moment: str | None = None
    moment_confidence: float | None = None

    @property
    def fps(self) -> float:
        return self.fps_num / self.fps_den if self.fps_den else 0.0

    @property
    def ok(self) -> bool:
        return not self.reject


def probe(path: pathlib.Path) -> Clip | None:
    p = run(["ffprobe", "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", str(path)])
    if p.returncode != 0:
        return None
    try:
        data = json.loads(p.stdout)
    except json.JSONDecodeError:
        return None

    clip = Clip(path=str(path.resolve()), name=path.name)
    try:
        clip.duration = float(data.get("format", {}).get("duration", 0.0))
    except (TypeError, ValueError):
        clip.duration = 0.0
    clip.created = data.get("format", {}).get("tags", {}).get("creation_time")

    for st in data.get("streams", []):
        kind = st.get("codec_type")
        if kind == "video" and not clip.has_video:
            # Cover art / thumbnails report as video; ignore those.
            if st.get("disposition", {}).get("attached_pic"):
                continue
            clip.has_video = True
            clip.width = int(st.get("width") or 0)
            clip.height = int(st.get("height") or 0)
            rate = st.get("avg_frame_rate") or st.get("r_frame_rate") or "0/1"
            try:
                num, den = (int(x) for x in rate.split("/"))
                if num and den:
                    clip.fps_num, clip.fps_den = num, den
            except ValueError:
                pass
        elif kind == "audio":
            clip.has_audio = True
    return clip


# ── junk detection ────────────────────────────────────────────────────────────

BLACK_RE = re.compile(r"black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)")
FREEZE_START_RE = re.compile(r"freeze_start: *([\d.]+)")
FREEZE_END_RE = re.compile(r"freeze_end: *([\d.]+)")
SILENCE_DUR_RE = re.compile(r"silence_duration: ([\d.]+)")


def analyse(clip: Clip, min_take: float) -> None:
    """Flag takes not worth putting in front of the editor."""
    if clip.duration <= 0:
        clip.reject.append("unreadable")
        return
    if not clip.has_video and not clip.has_audio:
        clip.reject.append("no media streams")
        return
    if clip.duration < min_take:
        clip.reject.append(f"too short ({clip.duration:.1f}s)")

    if clip.duration >= LONG_TAKE_SEC:
        clip.tags.append("long take")
        return  # ceremony/speeches: never junk, and too slow to decode

    if clip.has_video:
        # One decode pass at 120p for both checks — analysis res, not delivery.
        p = run(["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "info",
                 "-i", clip.path, "-map", "0:v:0",
                 "-vf", "scale=-2:120,blackdetect=d=0.4:pic_th=0.98,"
                        "freezedetect=n=0.003:d=2.0",
                 "-an", "-f", "null", "-"])
        err = p.stderr
        black = sum(float(m.group(3)) for m in BLACK_RE.finditer(err))
        # freezedetect only reports freeze_duration when the freeze ENDS. A take
        # that is frozen all the way to the end (camera left running, lens cap)
        # emits a bare freeze_start — the most common junk take of all — so pair
        # starts with ends and run any unterminated freeze to the clip end.
        starts = [float(m.group(1)) for m in FREEZE_START_RE.finditer(err)]
        ends = [float(m.group(1)) for m in FREEZE_END_RE.finditer(err)]
        freeze = sum(max(0.0, (ends[i] if i < len(ends) else clip.duration) - s)
                     for i, s in enumerate(starts))
        if black > 0.8 * clip.duration:
            clip.reject.append("black frames")
        elif black > 1.0:
            clip.tags.append("has black")
        if freeze > 0.6 * clip.duration:
            clip.reject.append("static/frozen")

    if clip.has_audio:
        p = run(["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "info",
                 "-i", clip.path, "-map", "0:a:0",
                 "-af", "silencedetect=n=-50dB:d=3", "-vn", "-f", "null", "-"])
        quiet = sum(float(m.group(1)) for m in SILENCE_DUR_RE.finditer(p.stderr))
        if quiet > 0.95 * clip.duration:
            clip.tags.append("silent")


# ── multicam sync ─────────────────────────────────────────────────────────────

def envelope(path: str) -> np.ndarray | None:
    """Loudness envelope at 1/ENVELOPE_HOP_MS Hz — enough for sub-frame sync
    and orders of magnitude cheaper than correlating raw samples."""
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-map", "0:a:0",
         "-ac", "1", "-ar", str(ENVELOPE_SR), "-f", "f32le", "-"],
        capture_output=True)
    if p.returncode != 0 or not p.stdout:
        return None
    pcm = np.frombuffer(p.stdout, dtype=np.float32)
    hop = max(1, int(ENVELOPE_SR * ENVELOPE_HOP_MS / 1000.0))
    usable = (len(pcm) // hop) * hop
    if usable < hop * 10:
        return None
    env = np.sqrt((pcm[:usable].reshape(-1, hop).astype(np.float64) ** 2).mean(axis=1))
    env -= env.mean()
    sd = env.std()
    return env / sd if sd > 1e-9 else None


def offset_between(ref: np.ndarray, other: np.ndarray) -> tuple[float, float]:
    """Seconds `other` starts after `ref` (negative = starts earlier), plus a
    confidence ratio (peak vs typical correlation)."""
    corr = signal.correlate(ref, other, mode="full", method="fft")
    lags = signal.correlation_lags(len(ref), len(other), mode="full")
    peak = int(np.argmax(np.abs(corr)))
    magnitude = np.abs(corr)
    typical = float(np.median(magnitude)) or 1e-9
    confidence = float(magnitude[peak] / typical)
    return float(lags[peak]) * ENVELOPE_HOP_MS / 1000.0, confidence


def sync(clips: list[Clip], min_conf: float) -> None:
    usable = [c for c in clips if c.ok and c.has_audio]
    if len(usable) < 2:
        return
    ref = max(usable, key=lambda c: c.duration)
    ref_env = envelope(ref.path)
    if ref_env is None:
        return
    ref.sync_offset, ref.sync_confidence, ref.sync_ref = 0.0, math.inf, ref.name

    for clip in usable:
        if clip is ref:
            continue
        env = envelope(clip.path)
        if env is None:
            continue
        off, conf = offset_between(ref_env, env)
        clip.sync_confidence = round(conf, 2)
        clip.sync_ref = ref.name
        if conf >= min_conf:
            clip.sync_offset = round(off, 4)
            clip.tags.append("synced")


# ── FCPXML ────────────────────────────────────────────────────────────────────

def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def file_url(path: str) -> str:
    return pathlib.Path(path).resolve().as_uri()


class Timebase:
    """FCPXML wants every time as a multiple of the frame duration."""

    def __init__(self, fps_num: int, fps_den: int):
        if not fps_num:
            fps_num, fps_den = 30000, 1000
        self.num, self.den = fps_num, fps_den

    @property
    def frame_duration(self) -> str:
        return f"{self.den}/{self.num}s"

    def time(self, seconds: float) -> str:
        frames = max(0, round(seconds * self.num / self.den))
        return f"{frames * self.den}/{self.num}s"


def build_fcpxml(clips: list[Clip], project: str) -> str:
    good = [c for c in clips if c.ok]
    if not good:
        raise SystemExit("Nothing to build: every clip was rejected.")

    dominant = max(good, key=lambda c: c.duration)
    tb = Timebase(dominant.fps_num, dominant.fps_den)
    width = dominant.width or 1920
    height = dominant.height or 1080

    resources = [
        f'    <format id="r0" name="WedditPrepFormat" frameDuration="{tb.frame_duration}"'
        f' width="{width}" height="{height}" colorSpace="1-1-1 (Rec. 709)"/>'
    ]
    spine, offset = [], 0.0
    for i, c in enumerate(good, start=1):
        aid = f"a{i}"
        dur = tb.time(c.duration)
        resources.append(
            f'    <asset id="{aid}" name="{esc(c.name)}" start="0s" duration="{dur}"'
            f' hasVideo="{1 if c.has_video else 0}" hasAudio="{1 if c.has_audio else 0}"'
            f' format="r0" audioSources="{1 if c.has_audio else 0}"'
            f' audioChannels="2" audioRate="48000">\n'
            f'      <media-rep kind="original-media" src="{esc(file_url(c.path))}"/>\n'
            f'    </asset>')
        kw = "".join(
            f'\n        <keyword start="0s" duration="{dur}" value="{esc(t)}"/>'
            for t in c.tags)
        spine.append(
            f'      <asset-clip ref="{aid}" offset="{tb.time(offset)}"'
            f' name="{esc(c.name)}" duration="{dur}" format="r0"'
            f' audioRole="dialogue">{kw}\n      </asset-clip>')
        offset += c.duration

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE fcpxml>\n'
        '<fcpxml version="1.10">\n'
        '  <resources>\n' + "\n".join(resources) + '\n  </resources>\n'
        '  <library>\n'
        '    <event name="Weddit Prep">\n'
        f'      <project name="{esc(project)}">\n'
        f'        <sequence format="r0" duration="{tb.time(offset)}" tcStart="0s"'
        ' tcFormat="NDF" audioLayout="stereo" audioRate="48k">\n'
        '          <spine>\n' + "\n".join(spine) + '\n          </spine>\n'
        '        </sequence>\n'
        '      </project>\n'
        '    </event>\n'
        '  </library>\n'
        '</fcpxml>\n')


# ── moment labelling (the one step that leaves the machine) ──────────────────

def api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    env = pathlib.Path(__file__).resolve().parent.parent / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("No ANTHROPIC_API_KEY (checked environment and .env.local).")


def stills(clip: Clip, count: int) -> list[bytes]:
    """A few small JPEGs spread across the take. Downscaled to STILL_WIDTH —
    these are what get sent, never the footage."""
    out: list[bytes] = []
    for frac in [(i + 0.5) / count for i in range(count)]:
        p = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{clip.duration * frac:.2f}",
             "-i", clip.path, "-frames:v", "1",
             "-vf", f"scale={STILL_WIDTH}:-2", "-q:v", "5",
             "-f", "image2pipe", "-vcodec", "mjpeg", "-"],
            capture_output=True)
        if p.returncode == 0 and p.stdout:
            out.append(p.stdout)
    return out


def classify(clip: Clip, images: list[bytes], key: str, model: str) -> None:
    content: list[dict] = [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                     "data": base64.b64encode(img).decode()}}
        for img in images
    ]
    content.append({"type": "text", "text":
        f"These {len(images)} stills are sampled across one clip from a wedding "
        f"shoot. Filename: {clip.name}. Length: {clip.duration:.0f}s.\n"
        f"Pick the single best label from this list:\n{', '.join(MOMENTS)}\n"
        'Reply with only JSON: {"moment": "<label>", "confidence": <0-1>}'})

    body = json.dumps({"model": model, "max_tokens": 200,
                       "system": "You label wedding footage. Reply with JSON only.",
                       "messages": [{"role": "user", "content": content}]}).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = json.load(r)["content"][0]["text"]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON in reply: {text[:80]}")
    data = json.loads(text[start:end + 1])
    moment = str(data.get("moment", "")).strip().lower()
    clip.moment = moment if moment in MOMENTS else "other"
    try:
        clip.moment_confidence = round(float(data.get("confidence", 0)), 2)
    except (TypeError, ValueError):
        clip.moment_confidence = None
    if clip.moment not in clip.tags:
        clip.tags.append(clip.moment)


def label(clips: list[Clip], model: str, count: int, workers: int,
          dry_run: bool) -> None:
    todo = [c for c in clips if c.ok and c.has_video]
    if not todo:
        print("  nothing to label (no usable clips with video)")
        return

    print(f"\n  Extracting {count} still(s) from each of {len(todo)} clip(s)…")
    shots = {c.path: stills(c, count) for c in todo}
    total = sum(len(v) for v in shots.values())
    kb = sum(len(b) for v in shots.values() for b in v) / 1024

    print(f"  {total} still(s), {kb:.0f} KB total, downscaled to {STILL_WIDTH}px.")
    print("  NOTE: these stills leave your Mac and go to the Anthropic API.")
    print("        Your footage does not. Rejected takes are never sent.")
    if dry_run:
        print("  --dry-run: nothing sent.\n")
        return

    key = api_key()
    failures: list[str] = []

    def work(c: Clip) -> None:
        try:
            classify(c, shots[c.path], key, model)
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read()).get("error", {}).get("message", "")
            except Exception:
                msg = ""
            failures.append(f"{c.name}: HTTP {e.code} {msg[:90]}")
        except Exception as e:  # noqa: BLE001 - one bad clip must not kill the run
            failures.append(f"{c.name}: {e}")

    print(f"  Labelling with {model} ({workers} at a time)…")
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(work, todo))

    if failures:
        print(f"\n  {len(failures)} clip(s) could not be labelled:")
        for f in failures[:5]:
            print(f"    ! {f}")
        if len(failures) > 5:
            print(f"    … and {len(failures) - 5} more")


# ── plan io / cli ─────────────────────────────────────────────────────────────

def gather(folder: pathlib.Path) -> list[pathlib.Path]:
    return sorted(p for p in folder.rglob("*")
                  if p.is_file() and p.suffix.lower() in MEDIA_EXT
                  and not p.name.startswith("."))


def save(folder: pathlib.Path, clips: list[Clip]) -> pathlib.Path:
    out = folder / PLAN_NAME
    out.write_text(json.dumps([asdict(c) for c in clips], indent=2))
    return out


def load(folder: pathlib.Path) -> list[Clip]:
    path = folder / PLAN_NAME
    if not path.exists():
        raise SystemExit(f"No plan found. Run 'scan' on {folder} first.")
    return [Clip(**d) for d in json.loads(path.read_text())]


def report(clips: list[Clip]) -> None:
    good = [c for c in clips if c.ok]
    print(f"\n  {len(good)} usable · {len(clips) - len(good)} rejected "
          f"· {sum(c.duration for c in good) / 60:.1f} min\n")
    for c in clips:
        if c.ok:
            bits = []
            if c.sync_offset is not None and c.sync_offset != 0.0:
                bits.append(f"sync {c.sync_offset:+.3f}s")
            elif c.sync_confidence is not None and c.sync_offset is None:
                bits.append(f"sync FAILED (conf {c.sync_confidence})")
            if c.moment:
                bits.insert(0, f"{c.moment} ({c.moment_confidence})")
            bits += [t for t in c.tags if t != c.moment]
            extra = f"  [{', '.join(bits)}]" if bits else ""
            print(f"    ok    {c.name:<34} {c.duration:7.1f}s{extra}")
        else:
            print(f"    drop  {c.name:<34} {c.duration:7.1f}s  -> {', '.join(c.reject)}")
    print()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["scan", "sync", "label", "build"])
    ap.add_argument("folder", type=pathlib.Path)
    ap.add_argument("-o", "--out", type=pathlib.Path, help="FCPXML path (build)")
    ap.add_argument("--min-take", type=float, default=2.0,
                    help="reject takes shorter than this (seconds)")
    ap.add_argument("--min-confidence", type=float, default=6.0,
                    help="reject a sync match below this confidence ratio")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="model for 'label'")
    ap.add_argument("--stills", type=int, default=3,
                    help="stills sampled per clip for 'label'")
    ap.add_argument("--workers", type=int, default=6, help="parallel label calls")
    ap.add_argument("--dry-run", action="store_true",
                    help="'label': extract stills and report, send nothing")
    args = ap.parse_args()

    folder: pathlib.Path = args.folder
    if not folder.is_dir():
        raise SystemExit(f"Not a folder: {folder}")

    if args.command == "scan":
        files = gather(folder)
        if not files:
            raise SystemExit(f"No media found in {folder}")
        print(f"Scanning {len(files)} file(s) in {folder}…")
        clips: list[Clip] = []
        for f in files:
            clip = probe(f)
            if clip is None:
                clip = Clip(path=str(f.resolve()), name=f.name, reject=["unreadable"])
            else:
                analyse(clip, args.min_take)
            clips.append(clip)
        report(clips)
        print(f"  plan -> {save(folder, clips)}")

    elif args.command == "sync":
        clips = load(folder)
        sync(clips, args.min_confidence)
        report(clips)
        print(f"  plan -> {save(folder, clips)}")

    elif args.command == "label":
        clips = load(folder)
        label(clips, args.model, args.stills, args.workers, args.dry_run)
        if not args.dry_run:
            report(clips)
            print(f"  plan -> {save(folder, clips)}")

    else:
        clips = load(folder)
        out = args.out or (folder / "weddit-prep.fcpxml")
        out.write_text(build_fcpxml(clips, folder.name))
        print(f"  fcpxml -> {out}")


if __name__ == "__main__":
    main()
