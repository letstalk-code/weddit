import { getJson, putJson } from '@/lib/r2'
import { generateStory } from '@/lib/story'
import type { Segment, Story, StoryBeat } from '@/lib/types'

// The Claude curation call (up to 400 segments + a retry) can run long;
// extend past Vercel's default function duration.
export const maxDuration = 120

const BEAT_NAMES: StoryBeat['name'][] = ['Hook', 'Build', 'Peak', 'Resolve']

function parseStory(body: unknown): Story {
  const beatsRaw = (body as Record<string, unknown> | null)?.beats
  if (!Array.isArray(beatsRaw)) throw new Error('beats must be an array')
  const beats: StoryBeat[] = BEAT_NAMES.map((name) => {
    const match = beatsRaw.find((b) => (b as Record<string, unknown>)?.name === name) as
      | Record<string, unknown>
      | undefined
    const ids = Array.isArray(match?.segment_ids) ? (match!.segment_ids as unknown[]) : []
    return { name, segment_ids: ids.filter((id): id is string => typeof id === 'string') }
  })
  return { beats }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const story = await getJson<Story>(`projects/${id}/outputs/story.json`)
    return Response.json(story)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const targetMinutes = Number(body?.targetMinutes) || 3
    const targetSeconds = Math.max(30, Math.min(900, targetMinutes * 60))
    const style = (['video', 'balanced', 'story'] as const).includes(body?.style)
      ? (body.style as 'video' | 'balanced' | 'story')
      : 'balanced'
    const segments = await getJson<Segment[]>(`projects/${id}/outputs/segments.json`)
    const story = await generateStory(segments, targetSeconds, style)
    await putJson(`projects/${id}/outputs/story.json`, story)
    return Response.json(story)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const story = parseStory(body)
    await putJson(`projects/${id}/outputs/story.json`, story)
    return Response.json(story)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}
