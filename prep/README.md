# weddit-prep

Local footage triage for wedding edits. Walks a folder of camera files, flags
takes you would never use, works out multicam offsets from the audio, and
writes an FCPXML you can open in Final Cut.

**Your originals are never modified and never uploaded.** Everything here runs
on your Mac. (This is the local half of the plan in `tasks/todo.md` — the
cloud half, classifying clips by wedding moment, is Phase 3.)

## Requirements
ffmpeg + ffprobe, and Python with numpy + scipy. All already installed.
No pip install needed.

## Use

```bash
python3 prep/weddit_prep.py scan  /Volumes/CARD/wedding      # inventory + junk
python3 prep/weddit_prep.py sync  /Volumes/CARD/wedding      # multicam offsets
python3 prep/weddit_prep.py build /Volumes/CARD/wedding -o timeline.fcpxml
```

`scan` and `sync` write `weddit-prep.plan.json` next to the footage. Open it,
edit it, delete rows — `build` just reads it. Nothing is hidden.

## What it flags

| Reject | Why |
|---|---|
| `too short` | under `--min-take` (default 2s) |
| `black frames` | over 80% black — lens cap, false start |
| `static/frozen` | over 60% pixel-identical — camera left running |
| `unreadable` / `no media streams` | ffprobe could not open it |

Tags (kept, just labelled): `long take`, `has black`, `silent`, `synced`.

Takes of 10 minutes or more skip frame analysis entirely — a ceremony is never
junk and decoding it costs minutes. Analysis runs at 120p, not delivery res.

## Multicam sync

Picks the longest clip with audio as the reference, then correlates a 5ms
loudness envelope against every other clip. 5ms is sub-frame even at 24fps.
Reported as seconds that clip starts *after* the reference (negative = before),
with a confidence ratio; matches below `--min-confidence` (default 6.0) are
reported as failed rather than silently trusted — clips that never overlapped
in time cannot sync, and a wrong offset is worse than none.

## Known limits (honest list)

- **Sync offsets are computed but NOT yet applied to the FCPXML.** `build`
  currently lays usable clips end to end as a stringout. The offsets live in
  `weddit-prep.plan.json`. Emitting a real multicam `<mc-clip>` with angles is
  the next step.
- **No shake detection yet.** Needs `vidstabdetect`, which this ffmpeg build
  was not compiled with (`brew install ffmpeg --with-libvidstab`, or use
  OpenCV optical flow).
- **No "sort by moment".** That is Phase 3 — sampled stills to a vision model.
- **Only tested on synthetic fixtures**, not a real wedding card yet.
