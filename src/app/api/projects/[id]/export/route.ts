import { getJson, objectExists } from '@/lib/r2'
import { beatMarkers, buildStandaloneFcpxml, topSegmentMarkers } from '@/lib/fcpxml'
import type { ProjectMeta, Segment, Story } from '@/lib/types'

const AUDIO_EXTENSIONS = ['mp3', 'mp4', 'wav', 'm4a', 'mov']

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const segments = await getJson<Segment[]>(`projects/${id}/outputs/segments.json`)
    if (!segments || segments.length === 0) {
      return Response.json({ error: 'No analyzed segments yet — process the audio first.' }, { status: 400 })
    }

    // Prefer the AI story arc for marker labels; fall back to the top-scoring moments.
    let markers = topSegmentMarkers(segments)
    try {
      const story = await getJson<Story>(`projects/${id}/outputs/story.json`)
      const fromBeats = beatMarkers(story.beats, segments)
      if (fromBeats.length > 0) markers = fromBeats
    } catch {
      // no story generated yet — top moments are used
    }

    // Locate the uploaded audio so the FCPXML references the right filename.
    let audioFilename = 'audio.mp3'
    for (const ext of AUDIO_EXTENSIONS) {
      if (await objectExists(`projects/${id}/uploads/audio.${ext}`)) {
        audioFilename = `audio.${ext}`
        break
      }
    }

    let projectTitle = 'Weddit Export'
    try {
      const meta = await getJson<ProjectMeta>(`projects/${id}/meta.json`)
      if (meta?.title) projectTitle = meta.title
    } catch {
      // fall back to default title
    }

    const durationMs = Math.max(...segments.map((s) => s.end_ms), 1000)
    const xml = buildStandaloneFcpxml({ projectTitle, audioFilename, durationMs, markers })

    const safeName = projectTitle.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'weddit'
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${safeName}.fcpxml"`,
      },
    })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
