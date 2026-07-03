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

function buildCurationPrompt(segments: Segment[], targetSeconds: number, style: StoryStyle): string {
  const minutes = Math.round(targetSeconds / 60)
  const list = segments
    .map((s, i) => `[${i + 1}] ${s.speaker} (${Math.round(segDurationSec(s))}s): "${s.text}"`)
    .join('\n')
  return `You are an award-winning wedding film editor building a roughly ${minutes}-minute highlight reel from the full transcript below. ${styleHint(style)}

CRITICAL RULE — exclude song lyrics and music: The transcript may contain lines that are actually song lyrics from music playing during the ceremony or reception (NOT a person speaking to the couple or guests). These often read as poetic, rhythmic, or repetitive lines that don't fit a toast, vow, speech, or officiant remark. NEVER select these. Only select genuine SPOKEN moments — vows, toasts, speeches, officiant remarks, heartfelt direct address. If a line looks like it could be from a song, leave it out. This applies to every beat, especially the Hook/opening.

Your job is to CURATE — choose the genuinely spoken moments that together tell the most emotionally compelling, coherent story, then arrange them into a four-beat arc:
- Hook: a strong SPOKEN opening line that immediately draws the viewer in (never a song lyric)
- Build: establishes the people, relationship, and context
- Peak: the emotional climax — the most moving moments
- Resolve: a closing thought that lands the story

Selection guidance:
- Choose for genuine emotional resonance, vivid or specific storytelling, and a satisfying arc — not just keywords.
- Prefer complete thoughts; skip filler, false starts, rambling, repetition, fragments that don't stand alone, and anything that reads like song lyrics.
- Vary speakers and themes where it strengthens the story.
- Aim for the selected moments' combined length (durations shown in seconds) to total about ${minutes} minutes. You do NOT need to use every moment — leaving weak moments out makes a better film.
- Put at least one moment in each beat and order moments within each beat for the best emotional flow.

Transcript moments (numbered, in chronological order):
${list}

Return ONLY this JSON (no markdown, no commentary), listing the moment NUMBERS you select for each beat:
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

// Trim the weakest moments until the highlight is within ~10% of the target
// duration, so the length slider is respected. Never empties a beat.
function trimToTarget(
  story: Story,
  segments: Segment[],
  targetSeconds: number,
  style: StoryStyle,
): Story {
  const map = new Map(segments.map((s) => [s.id, s]))
  const dur = (id: string) => {
    const s = map.get(id)
    return s ? (s.end_ms - s.start_ms) / 1000 : 0
  }
  const score = (id: string) => {
    const s = map.get(id)
    return s ? weightedScore(s, style) : 0
  }
  const beats = story.beats.map((b) => ({ name: b.name, segment_ids: [...b.segment_ids] }))
  const totalDur = () => beats.reduce((a, b) => a + b.segment_ids.reduce((x, id) => x + dur(id), 0), 0)
  const limit = targetSeconds * 1.1

  let total = totalDur()
  while (total > limit) {
    let worst: { bi: number; ii: number; id: string; sc: number } | null = null
    beats.forEach((b, bi) => {
      if (b.segment_ids.length <= 1) return // keep at least one moment per beat
      b.segment_ids.forEach((id, ii) => {
        const sc = score(id)
        if (!worst || sc < worst.sc) worst = { bi, ii, id, sc }
      })
    })
    if (!worst) break
    total -= dur((worst as { id: string }).id)
    beats[(worst as { bi: number }).bi].segment_ids.splice((worst as { ii: number }).ii, 1)
  }
  return { beats }
}

export async function generateStory(
  segments: Segment[],
  targetSeconds = 180,
  style: StoryStyle = 'balanced',
): Promise<Story> {
  if (segments.length === 0) {
    return { beats: BEAT_NAMES.map((name) => ({ name, segment_ids: [] })) }
  }
  // Give Claude a broad candidate pool to curate from (capped for token safety,
  // by style relevance), presented in chronological order so it sees the timeline.
  const ranked = [...segments].sort((a, b) => weightedScore(b, style) - weightedScore(a, style))
  const candidates = ranked.slice(0, 400).sort((a, b) => a.start_ms - b.start_ms)

  const userPrompt = buildCurationPrompt(candidates, targetSeconds, style)
  const maxTokens = 4096
  const retryPrompt =
    userPrompt + '\n\nIMPORTANT: Respond with ONLY the JSON object described above, nothing else.'

  // Each attempt covers both the API call AND parsing/assembly, so a malformed
  // response triggers a retry. After two failures, fall back deterministically.
  const attempt = async (prompt: string): Promise<Story> =>
    trimToTarget(assembleStory(await callClaude(prompt, maxTokens), candidates), segments, targetSeconds, style)

  try {
    return await attempt(userPrompt)
  } catch {
    try {
      return await attempt(retryPrompt)
    } catch {
      return trimToTarget(
        fallbackStory(selectForTarget(candidates, targetSeconds, style)),
        segments,
        targetSeconds,
        style,
      )
    }
  }
}
