import { getJson, putJson } from '@/lib/r2'
import type { ProjectMeta } from '@/lib/types'

// A job should never legitimately outrun this. It sits above the Modal worker's
// own timeout (900s), so any project still 'processing' past it means the worker
// died without recording an error (e.g. Modal killed it) — surface that instead
// of polling forever.
const STUCK_JOB_MS = 20 * 60 * 1000

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const meta = await getJson<ProjectMeta>(`projects/${id}/meta.json`)

    if (
      meta.status === 'processing' &&
      typeof meta.startedAt === 'number' &&
      Date.now() - meta.startedAt > STUCK_JOB_MS
    ) {
      meta.status = 'error'
      meta.updatedAt = Date.now()
      await putJson(`projects/${id}/meta.json`, meta)
    }

    return Response.json({
      status: meta.status,
      stage: meta.stage ?? null,
      startedAt: meta.startedAt ?? null,
      audioDurationSec: meta.audioDurationSec ?? null,
      updatedAt: meta.updatedAt,
    })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
