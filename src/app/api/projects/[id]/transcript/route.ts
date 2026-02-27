import { getJson } from '@/lib/r2'
import type { Transcript } from '@/lib/types'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const transcript = await getJson<Transcript>(`projects/${id}/outputs/transcript.json`)
    return Response.json(transcript)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
