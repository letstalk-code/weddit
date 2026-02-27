import { getJson, getObject } from '@/lib/r2'
import { injectMarkers } from '@/lib/fcpxml'
import type { Segment, Story } from '@/lib/types'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [fcpxmlBuf, story, segments] = await Promise.all([
      getObject(`projects/${id}/uploads/timeline.fcpxml`),
      getJson<Story>(`projects/${id}/outputs/story.json`),
      getJson<Segment[]>(`projects/${id}/outputs/segments.json`),
    ])
    const fcpxmlString = fcpxmlBuf.toString('utf-8')
    const result = injectMarkers(fcpxmlString, story.beats, segments)
    return new Response(result, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="markers.fcpxml"',
      },
    })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
