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

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const segments = await getJson<Segment[]>(`projects/${id}/outputs/segments.json`)
    const story = await generateStory(segments)
    await putJson(`projects/${id}/outputs/story.json`, story)
    return Response.json(story)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
