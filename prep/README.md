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
python3 prep/weddit_prep.py label /Volumes/CARD/wedding      # sort clips by moment
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

## Sorting clips by moment (`label`)

The one step that talks to a network. It pulls 3 small JPEGs from each usable
clip, downscales them to 512px, and asks a model which wedding moment it is —
`getting ready`, `first look`, `ceremony`, `speeches`, `first dance`,
`cake cutting`, `exit`, and so on. The label lands in the plan and becomes an
FCPXML keyword, so clips arrive in Final Cut already sorted.

**What leaves your Mac: a handful of downscaled stills. Never the footage.**
Rejected takes are never sent at all, so junk costs nothing. Run with
`--dry-run` to see exactly how many stills and how many KB would be sent
without sending anything.

Defaults to Haiku 4.5 because a wedding card is hundreds of clips. If labels
come back sloppy, `--model claude-sonnet-5`. Verified model IDs as of
2026-09-11: `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-sonnet-4-6`.

A label the model invents that is not in the list is forced to `other`, and a
reply with no JSON in it is recorded as a failure rather than guessed at — a
wrong label is worse than a missing one.

## Known limits (honest list)

- **Sync offsets are computed but NOT yet applied to the FCPXML.** `build`
  currently lays usable clips end to end as a stringout. The offsets live in
  `weddit-prep.plan.json`. Emitting a real multicam `<mc-clip>` with angles is
  the next step.
- **No shake detection yet.** Needs `vidstabdetect`, which this ffmpeg build
  was not compiled with (`brew install ffmpeg --with-libvidstab`, or use
  OpenCV optical flow).
- **No "sort by moment".** That is Phase 3 — sampled stills to a vision model.
- **`label` has never made a successful live call.** The Anthropic key in
  `.env.local` returns "credit balance is too low", so real-world labelling
  accuracy is completely unverified. Everything around the call is tested
  (still extraction, parsing, bad-reply handling, keywords reaching Final Cut)
  — but whether it actually recognises a first dance is unknown until the
  account has credit.
- **Only tested on synthetic fixtures**, not a real wedding card yet.
