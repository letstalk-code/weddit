# Weddit

## Overview
Weddit is a single-user wedding film story assistant that stitches together narrated moments, diarized speakers, and emotional scoring to help capture the story behind every clip. It uses Claude + Modal GPU workers to transcribe voiceovers and segment them into story-worthy beats, with all project state stored in Cloudflare R2 as JSON.

## Stack
- Next.js
- Cloudflare R2
- Modal (GPU worker)
- Anthropic Claude API

## Prerequisites
- Node.js 18 or newer
- Python 3.10 or newer
- Cloudflare R2 account with an R2 bucket
- Modal account with GPU quota
- Anthropic Claude API access
- Pyannote credentials for diarization

## Setup
1. Copy the example environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
2. Fill in all the values in `.env.local`.
3. Install the Next.js app dependencies:
   ```bash
   cd weddit-app && npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Then visit [http://localhost:3000](http://localhost:3000).

## Modal Worker Deploy
1. Install Modal:
   ```bash
   pip install modal
   ```
2. Generate a token if you do not already have one:
   ```bash
   modal token new
   ```
3. Create a Modal secret named `weddit-secrets` that contains all of your Cloudflare R2 credentials, the Deepgram API key, and (optionally) `WORKER_SECRET` to require an authenticated trigger from the app.
4. Deploy the worker:
   ```bash
   modal deploy modal_worker/worker.py
   ```
5. Copy the function webhook URL from the deploy output into `MODAL_WEBHOOK_URL` inside `.env.local`.

## Cloudflare R2 Setup
1. Create an R2 bucket named `weddit`.
2. Disable public access on the bucket.
3. Create an API token that can read/write R2 buckets and bind it to the `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` values.

## Authentication
The whole app sits behind a single shared password.

- `APP_PASSWORD` — set this in the Next.js app environment (`.env.local` locally,
  Vercel project settings in production). Visitors are redirected to `/login` and
  must enter it; API routes return 401 without a valid session cookie. Leave it
  **blank to disable the gate** (e.g. local development).
- `WORKER_SECRET` — shared secret so only this app can trigger the Modal worker.
  Set the **same value** in two places: the Next.js app environment AND the Modal
  `weddit-secrets` bundle. If set on the worker but not the app (or vice versa),
  the worker returns 401 and jobs won't start. Leave blank on both sides to
  disable the check.

## Vercel Deploy
1. Connect this GitHub repository to Vercel.
2. Add all environment variables (R2, Anthropic, `MODAL_WEBHOOK_URL`,
   `APP_PASSWORD`, `WORKER_SECRET`) to the Vercel project settings.
3. Deploy; Vercel will run `npm run build` followed by `npm run start` for production.
