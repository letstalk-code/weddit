import Anthropic from '@anthropic-ai/sdk'
import type { Segment, Story, StoryBeat } from './types'

// Instantiate lazily (not at module load) so the API key is read from the
// environment at request time, mirroring how r2.ts resolves its credentials.
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return new Anthropic({ apiKey })
}

const BEAT_NAMES: StoryBeat['name'][] = ['Hook', 'Build', 'Peak', 'Resolve']

export type StoryStyle = 'video' | 'balanced' | 'story'

// Re-weight the per-moment scores by the chosen style so selection emphasis
// changes: "video" favors emotional punch, "story" favors narrative substance.
function weightedScore(s: Segment, style: StoryStyle): number {
  const e = s.emotion_score
  const st = s.story_score
  const c = s.clarity_score
  if (style === 'video') return 0.65 * e + 0.2 * st + 0.15 * c
  if (style === 'story') return 0.65 * st + 0.2 * e + 0.15 * c
  return 0.4 * st + 0.4 * e + 0.2 * c // balanced
}

// Claude returns small 1-based index numbers per beat (not the long ids), which
// is far more reliable. We map those indices back to real segment ids here.
function assembleStory(raw: unknown, selected: Segment[]): Story {
  if (!raw || typeof raw !== 'object') throw new Error('Response is not an object')
  const beatsRaw = (raw as Record<string, unknown>).beats
  if (!Array.isArray(beatsRaw)) throw new Error('beats must be an array')

  const used = new Set<number>()
  const beats: StoryBeat[] = BEAT_NAMES.map((name) => {
    const match = beatsRaw.find(
      (b) => (b as Record<string, unknown>)?.name === name,
    ) as Record<string, unknown> | undefined
    const indices = Array.isArray(match?.indices) ? (match!.indices as unknown[]) : []
    const segment_ids: string[] = []
    for (const raw_idx of indices) {
      const i = Math.round(Number(raw_idx)) - 1 // 1-based -> 0-based
      if (Number.isInteger(i) && i >= 0 && i < selected.length && !used.has(i)) {
        used.add(i)
        segment_ids.push(selected[i].id)
      }
    }
    return { name, segment_ids }
  })
  return { beats }
}

function segDurationSec(s: Segment): number {
  return Math.max(0, (s.end_ms - s.start_ms) / 1000)
}

// Pick the best-scoring moments until their combined length reaches the target
// duration (or we run out of moments). This makes the highlight length predictable.
function selectForTarget(segments: Segment[], targetSeconds: number, style: StoryStyle): Segment[] {
  const sorted = [...segments].sort((a, b) => weightedScore(b, style) - weightedScore(a, style))
  const selected: Segment[] = []
  let total = 0
  for (const s of sorted) {
    selected.push(s)
    total += segDurationSec(s)
    if (total >= targetSeconds) break
  }
  return selected
}

function styleHint(style: StoryStyle): string {
  if (style === 'video') {
    return 'This is a video-forward highlight: favor the most emotional, punchy, quotable moments and keep the arc tight.'
  }
  if (style === 'story') {
    return 'This is a story-forward highlight: prioritize narrative flow and meaningful context so the spoken words carry the story.'
  }
  return 'This is a balanced highlight: mix emotional peaks with enough narrative context.'
}

function buildArrangementPrompt(segments: Segment[], targetSeconds: number, style: StoryStyle): string {
  const list = segments
    .map((s, i) => `[${i + 1}] ${s.speaker} (${Math.round(segDurationSec(s))}s): "${s.text}"`)
    .join('\n')
  return `You are arranging moments for a wedding highlight film of about ${Math.round(targetSeconds / 60)} minutes. ${styleHint(style)}
Each moment below is numbered. Arrange ALL ${segments.length} moments into a four-beat narrative arc: Hook (grab attention), Build (establish characters and context), Peak (the emotional climax), Resolve (the closing thought). Every moment number from 1 to ${segments.length} must appear in exactly one beat. Include at least one moment in each beat, and order the numbers within each beat for the best narrative flow.
Moments:
${list}

Return ONLY this JSON (no markdown, no explanation), using the moment NUMBERS:
{"beats":[{"name":"Hook","indices":[...]},{"name":"Build","indices":[...]},{"name":"Peak","indices":[...]},{"name":"Resolve","indices":[...]}]}`
}

// Pull the first complete JSON object out of the model's reply, tolerating
// markdown code fences or stray prose before/after the JSON.
function extractJsonObject(text: string): string {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in response')
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start)
}

async function callClaude(userPrompt: string, maxTokens: number): Promise<unknown> {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: 'Return ONLY valid JSON, no markdown, no explanation.',
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(extractJsonObject(text))
}

// If Claude is unavailable or keeps returning a bad shape, still produce a
// usable arc by splitting the selected moments chronologically into four beats.
function fallbackStory(selected: Segment[]): Story {
  const chrono = [...selected].sort((a, b) => a.start_ms - b.start_ms)
  const beats: StoryBeat[] = BEAT_NAMES.map((name) => ({ name, segment_ids: [] }))
  chrono.forEach((s, i) => {
    const beatIdx = chrono.length <= 1 ? 0 : Math.min(3, Math.floor((i / chrono.length) * 4))
    beats[beatIdx].segment_ids.push(s.id)
  })
  return { beats }
}

export async function generateStory(
  segments: Segment[],
  targetSeconds = 180,
  style: StoryStyle = 'balanced',
): Promise<Story> {
  const selected = selectForTarget(segments, targetSeconds, style)
  if (selected.length === 0) {
    return { beats: BEAT_NAMES.map((name) => ({ name, segment_ids: [] })) }
  }
  const userPrompt = buildArrangementPrompt(selected, targetSeconds, style)
  // Output is just small index numbers, so the token budget stays modest.
  const maxTokens = Math.min(8192, 800 + selected.length * 10)
  const retryPrompt =
    userPrompt + '\n\nIMPORTANT: Respond with ONLY the JSON object described above, nothing else.'

  // Each attempt covers both the API call AND parsing/assembly, so a malformed
  // response triggers a retry. After two failures, fall back deterministically.
  const attempt = async (prompt: string): Promise<Story> =>
    assembleStory(await callClaude(prompt, maxTokens), selected)

  try {
    return await attempt(userPrompt)
  } catch {
    try {
      return await attempt(retryPrompt)
    } catch {
      return fallbackStory(selected)
    }
  }
}
