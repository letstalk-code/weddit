import { getJson, putJson } from '@/lib/r2'
import type { ProjectMeta } from '@/lib/types'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const webhookUrl = process.env.MODAL_WEBHOOK_URL
    if (!webhookUrl) {
      return Response.json({ error: 'MODAL_WEBHOOK_URL not configured' }, { status: 503 })
    }

    // fire-and-forget
    fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ project_id: id }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})

    const meta = await getJson<ProjectMeta>(`projects/${id}/meta.json`)
    meta.status = 'processing'
    meta.updatedAt = Date.now()
    await putJson(`projects/${id}/meta.json`, meta)

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
