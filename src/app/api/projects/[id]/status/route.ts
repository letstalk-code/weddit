import { getJson } from '@/lib/r2'
import type { ProjectMeta } from '@/lib/types'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const meta = await getJson<ProjectMeta>(`projects/${id}/meta.json`)
    return Response.json({ status: meta.status, updatedAt: meta.updatedAt })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
