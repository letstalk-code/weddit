import Anthropic from '@anthropic-ai/sdk'
import type { Segment, Story, StoryBeat } from './types'

const client = new Anthropic()

const BEAT_NAMES: StoryBeat['name'][] = ['Hook', 'Build', 'Peak', 'Resolve']

function validateStory(raw: unknown, segmentIds: Set<string>): Story {
  if (!raw || typeof raw !== 'object') throw new Error('Response is not an object')
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.beats)) throw new Error('beats must be an array')
  if (obj.beats.length !== 4) throw new Error(`Expected 4 beats, got ${obj.beats.length}`)
  for (let i = 0; i < 4; i++) {
    const beat = obj.beats[i] as Record<string, unknown>
    if (beat.name !== BEAT_NAMES[i]) throw new Error(`Beat ${i} name must be ${BEAT_NAMES[i]}, got ${beat.name}`)
    if (!Array.isArray(beat.segment_ids)) throw new Error(`Beat ${i} segment_ids must be an array`)
    for (const id of beat.segment_ids as unknown[]) {
      if (typeof id !== 'string') throw new Error('segment_id must be a string')
      if (!segmentIds.has(id)) throw new Error(`Unknown segment_id: ${id}`)
    }
  }
  return raw as Story
}

function buildUserPrompt(segments: Segment[]): string {
  const list = segments
    .map((s) => `id=${s.id} speaker=${s.speaker} text="${s.text}"`)
    .join('\n')
  return `Assign these interview segments to story beats for a wedding film.\nSegments:\n${list}\n\nReturn ONLY this JSON (no markdown, no explanation):\n{"beats":[{"name":"Hook","segment_ids":[...]},{"name":"Build","segment_ids":[...]},{"name":"Peak","segment_ids":[...]},{"name":"Resolve","segment_ids":[...]}]}`
}

async function callClaude(userPrompt: string): Promise<unknown> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'Return ONLY valid JSON, no markdown, no explanation.',
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}

export async function generateStory(segments: Segment[]): Promise<Story> {
  const top = [...segments].sort((a, b) => b.story_score - a.story_score).slice(0, 20)
  const segmentIds = new Set(top.map((s) => s.id))
  const userPrompt = buildUserPrompt(top)

  let raw: unknown
  try {
    raw = await callClaude(userPrompt)
  } catch {
    // retry once with a more explicit prompt
    const retryPrompt = userPrompt + '\n\nIMPORTANT: Your response must be parseable JSON only. No text before or after the JSON object.'
    raw = await callClaude(retryPrompt)
  }

  return validateStory(raw, segmentIds)
}
