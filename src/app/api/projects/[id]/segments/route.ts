import { getJson } from '@/lib/r2'
import type { Segment } from '@/lib/types'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const segments = await getJson<Segment[]>(`projects/${id}/outputs/segments.json`)
    return Response.json(segments)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
