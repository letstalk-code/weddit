import { getJson, putJson } from '@/lib/r2'
import { generateStory } from '@/lib/story'
import type { Segment, Story } from '@/lib/types'

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
