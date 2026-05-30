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
