# Weddit — Get the app ready to use

## Goal
Upload wedding audio (ceremony + reception speeches) → AI finds the best parts →
download a single FCPXML containing that audio with markers at the best moments,
to line up against video in Final Cut Pro.

## What was broken & fixed

- [x] **R2 CORS** — browser uploads to R2 were blocked (403). Added CORS policy in
      Cloudflare (allow PUT/GET/HEAD from localhost:3000 + Vercel domain). Verified
      preflight now returns 204. This was THE blocker — every prior project was stuck
      at "created" with no uploaded audio.
- [x] **Modal worker crash #1** — `huggingface_hub` was unpinned and pulled a version
      that removed the `use_auth_token` arg pyannote relies on. Pinned
      `huggingface_hub==0.25.2` in the worker image.
- [x] **Modal worker crash #2** — PyTorch 2.6+ defaults `torch.load` to
      `weights_only=True`, which refuses pyannote's checkpoint. Patched `torch.load`
      to force `weights_only=False` for the trusted pyannote weights (survives future
      torch upgrades — more robust than pinning torch).
- [x] **Claude story auth** — client was created at module load (`new Anthropic()`);
      made it lazy so the API key resolves at request time (mirrors r2.ts). Also found
      an empty `ANTHROPIC_API_KEY` injected into the dev shell that shadowed the real
      one — Next.js won't override an already-set env var. Local fix: launch with
      `env -u ANTHROPIC_API_KEY npm run dev`. Not an issue on Vercel.
- [x] **FCPXML export rebuilt** — old export required uploading an existing FCP
      timeline (no UI for it). Replaced with `buildStandaloneFcpxml`: generates a
      complete Final Cut file referencing the uploaded audio as a clip on a 30fps
      timeline, with a frame-aligned marker at each best moment (labeled by AI story
      beat, falling back to top-scoring moments). No timeline upload needed.

## Verified end-to-end (real speech audio through the live stack)
- [x] Create project → presign → browser-style upload to R2 (HTTP 200)
- [x] Modal: Whisper transcription (47 words, correct text)
- [x] Modal: pyannote speaker diarization (SPEAKER_00 labels)
- [x] Best-moment segmentation + scoring (story/emotion/clarity)
- [x] Claude story arc (Hook/Build/Peak/Resolve)
- [x] FCPXML export — well-formed XML, audio + 7 markers, downloads correctly
- [x] `npm run build` compiles clean

## Still to do (owner: user)
- [ ] Deploy the app code to Vercel (Modal worker already deployed). Ensure all
      env vars from .env.local.example are set in Vercel project settings.
- [ ] One test import of the generated .fcpxml into your Final Cut version, and
      relink the audio (the file references audio by filename). Confirm markers land.
- [ ] Optional: minor label polish — a few words fall outside diarized turns and get
      a default "Speaker 0" label instead of SPEAKER_00.

---

# Stability review (2026-07-03) — plan for approval

Full code review of the app against a "Plotline-grade" stability bar.
Verdict: strong prototype, four real functional bugs, no auth, and jobs can
get stuck forever. Plan below, smallest-change-possible per item.

## Execution guardrails (agreed with user 2026-07-03)

Work is split by model. **If you are Sonnet 5: do ONLY Batch A, in order,
then STOP and tell the user to switch to Opus 4.8. Do not attempt Batch B,
even partially — Batch B touches the Modal worker deployment and auth, where
a quiet mistake is expensive.** Every change: minimal diff, no refactors
beyond what the item asks, run `npm run build` after each item.

## Batch A — Sonnet 5 (small, isolated, fully specified)

- [x] **A1. Score display is wrong everywhere.** Worker scores are already
      0–100, but `src/app/workspace/[id]/page.tsx` (~line 797) renders
      `Math.round(seg.story_score * 100)` — cards show numbers like 3700,
      every card passes the `>= 90` "peak" test (all gold), and the score
      ring is always full. Fix: drop the `* 100` (score ring + isPeak use
      the same variable, so one fix covers all three symptoms).
- [x] **A2. Manual arc edits are never saved.** "Add to Arc" only updates
      local React state; `story.json` in R2 is untouched. A refresh loses the
      edits, and worse, **Export reads story.json — so the export silently
      ignores manual edits**. Fix: add a PUT handler to the story route that
      accepts a Story body and `putJson`s it; call it from `handleAddToArc`
      (fire on change, no debounce needed for single-user).
- [x] **A3. Dashboard status is permanently stale.** The project list reads
      `index.json`, but only create writes it — the worker updates
      `meta.json` only. Every project shows as new forever. Fix: in the list
      route, read each project's `meta.json` (Promise.all) and return the
      fresh status; keep index.json as the id/order source.
- [x] **A4. Story route timeout.** Claude call with up to 400 segments + a
      retry can exceed Vercel's default function duration. Fix:
      `export const maxDuration = 120` in the story route.
- [x] **A5. Validate presign input.** `extension` is used raw in the R2 key;
      whitelist mp3/mp4/wav/m4a/mov server-side, 400 otherwise.
- [x] **A6. Silent failures in the UI.** Generate Story shows nothing on
      failure; upload errors use `alert()`. Fix: reuse the existing red error
      banner pattern in the workspace page for both.
- [x] **A7. Presigned audio URL expires after 1h** — preview buttons die
      silently in long sessions. Fix: on `<audio>` element `onError`,
      re-fetch `/api/projects/[id]/audio` once and retry playback.
- [x] **A8. Housekeeping.** Commit the already-modified files (worker.py,
      fcpxml.ts, story.ts) as their own commit BEFORE starting A1, then one
      commit per item (or small groups). Do NOT deploy the Modal worker —
      that happens in Batch B.

**>>> STOP HERE. Tell the user: "Batch A done — switch to Opus 4.8 for
Batch B." Do not continue. <<<**

## Batch B — Opus 4.8 (deployment-coupled, quiet-failure risk)

- [x] **B1. Jobs can hang in "processing" forever.** Two causes:
      1. `process/route.ts` fires the Modal webhook without `await` — on
         Vercel the function can freeze before the request ever leaves, so
         processing never starts but status says processing.
      2. The Modal endpoint runs the whole job synchronously inside the
         webhook request; if Modal kills it at the 600s timeout, the `except`
         never runs and meta is stuck at processing.
      Fix: split the Modal endpoint into a fast webhook that `.spawn()`s the
      real work (returns instantly, safe to await from Vercel); await the
      fetch in process/route.ts and surface failure to the UI; add a
      watchdog in the status route that marks the project `error` if status
      is processing and `startedAt` is older than ~20 min. Requires
      `modal deploy` + one end-to-end test with real audio.
- [x] **B2. No auth at all.** Every API route is open: anyone with the URL
      can create projects, upload audio, trigger Modal jobs (Deepgram +
      Claude bill), and read every transcript. Modal webhook is also public.
      Fix (minimal, single-user): shared secret — Next.js middleware checks
      a cookie set by a simple password page (password from env var);
      process route sends a bearer token the Modal worker verifies (same
      secret in the Modal secret bundle). Verify you can still log in BEFORE
      deploying, and keep the middleware matcher away from /api/… used by
      the Modal worker if any.
      NOTE: implemented as a body secret (not a bearer header) — see the B2
      commit message for why. Auth uses Next 16's `proxy.ts` (renamed from
      the deprecated `middleware.ts`).

## Batch B — deploy & verify (owner: user — I can't run these from here)

I made and locally build-verified all code, and verified the auth flow
end-to-end against a dev server. Two things I could NOT do and you must:

- [ ] **Redeploy the Modal worker** so the .spawn() split + secret check go
      live: `modal deploy modal_worker/worker.py`. Until you do, the OLD
      synchronous worker is still running and B1's fix isn't active.
- [ ] **Set the new env vars** (same value where shared):
      - Vercel: `APP_PASSWORD`, `WORKER_SECRET`
      - Modal `weddit-secrets` bundle: `WORKER_SECRET` (identical value)
      - Local `.env.local`: both, if you want the gate/secret active locally
        (leave `APP_PASSWORD` blank locally to skip the login screen).
- [ ] **End-to-end test with real audio** after deploy: upload → confirm it
      transcribes and reaches "ready" (proves the spawn path works), then
      confirm a wrong/absent WORKER_SECRET is rejected (jobs only trigger
      from the app).
- [ ] **Watchdog reminder:** a job is force-failed after 20 min of
      "processing" (worker timeout is 900s/15 min). If you ever process very
      long audio that legitimately needs >15 min, raise `run_process`'s
      timeout in worker.py AND `STUCK_JOB_MS` in the status route together
      (keep watchdog > worker timeout).

## Restyle (2026-07-03) — Plotline aesthetic

- [x] Pulled plotline.pro's design system from the live site (computed styles +
      screenshots) into `DESIGN.md` (project root + designsystem skill library
      under `plotline/`). Aesthetic only — no copy/logo/imagery taken.
- [x] Rebuilt the theme to it: warm-dark palette (#161618 / #131315 / #f5f2ec),
      red #e94a47 accent, Instrument Serif + Geist, flat panels with hairline
      borders. Removed all glassmorphism, gradient text, glows, and blobs.
      NOTE: `.glass-panel` / `.glass-card` class names remain in markup but are
      redefined as flat surfaces in globals.css — rename later if confusing.
- [x] Fixed latent framer-motion bug (cards mounting after parent animation
      stayed opacity-0 forever) that A3's slower list fetch exposed.
- [x] Gotcha for future font work: font tokens must live in `@theme inline`
      (not plain `@theme`) because next/font vars are body-scoped.

## P2 — Product polish (the Plotline-feel gap)

- [x] Arc affordance honesty (2026-07-03): removed the fake "Drag Fragment
      Here" + grip handles (no DnD existed) and instead added a real
      remove-from-arc (×) button — Add-to-Arc now has an inverse, so the arc
      is actually editable. Empty beats read "Use Add to Arc on a moment to
      place it here." (Full drag-to-reorder DnD deliberately NOT built —
      would be a feature, not a fix.)
- [x] Wired ⌘E / Ctrl+E to Export.
- [ ] Remove/disable dead sidebar icons (Search, Settings do nothing).
- [ ] Real waveform from the audio instead of the decorative sine animation.
- [ ] A few unit tests for the pure logic: fcpxml frame math + escaping,
      story JSON extraction/assembly, trimToTarget.
- [ ] Error monitoring (Sentry free tier) so production failures are visible.

## Housekeeping
- [x] Committed the worker.py/fcpxml.ts/story.ts changes (done in Batch A).
      Modal worker STILL needs `modal deploy` — see Batch B deploy checklist.
- [x] Deleted `/workspace` (no-id) hardcoded mock page (2026-07-03).
- [x] Lint clean (2026-07-03): all 17 errors cleared (typed `any`s, escaped
      entity; most lived in the deleted mock page).
