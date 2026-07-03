import { getJson, putJson } from '@/lib/r2'
import type { ProjectMeta } from '@/lib/types'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const webhookUrl = process.env.MODAL_WEBHOOK_URL
    if (!webhookUrl) {
      return Response.json({ error: 'MODAL_WEBHOOK_URL not configured' }, { status: 503 })
    }

    // Mark processing BEFORE triggering, so the UI reflects state immediately and
    // startedAt anchors the watchdog clock (see the status route). The worker
    // preserves this startedAt when it later updates its stage.
    const meta = await getJson<ProjectMeta>(`projects/${id}/meta.json`)
    meta.status = 'processing'
    meta.stage = 'transcribing'
    meta.startedAt = Date.now()
    delete meta.audioDurationSec // clear any stale duration from a prior run
    meta.updatedAt = Date.now()
    await putJson(`projects/${id}/meta.json`, meta)

    // Await the webhook — the Modal endpoint now only .spawn()s the real work and
    // returns instantly, so this is fast and safe on Vercel (an un-awaited fetch
    // can be frozen before it is ever sent). If it fails to fire, roll the project
    // back to 'error' instead of leaving it stuck on 'processing' forever.
    let triggered = false
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify({ project_id: id, secret: process.env.WORKER_SECRET }),
        headers: { 'Content-Type': 'application/json' },
      })
      triggered = res.ok
    } catch {
      triggered = false
    }

    if (!triggered) {
      meta.status = 'error'
      meta.updatedAt = Date.now()
      await putJson(`projects/${id}/meta.json`, meta)
      return Response.json({ error: 'Failed to start processing on the worker.' }, { status: 502 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
