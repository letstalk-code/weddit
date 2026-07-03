import type { Segment, StoryBeat } from './types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface Marker {
  start_ms: number
  end_ms: number
  value: string
  note: string
}

function buildMarkers(beats: StoryBeat[], segMap: Map<string, Segment>): Marker[] {
  const markers: Marker[] = []
  for (const beat of beats) {
    for (const id of beat.segment_ids) {
      const seg = segMap.get(id)
      if (!seg) continue
      const label = escapeXml(`${beat.name}: ${seg.text.slice(0, 40)}`)
      markers.push({ start_ms: seg.start_ms, end_ms: seg.end_ms, value: label, note: beat.name })
    }
  }
  return markers.sort((a, b) => a.start_ms - b.start_ms)
}

// Expand each moment into an IN marker (its label) and an OUT marker (where the
// cut ends), so editors can see exactly where to start AND end each clip.
function expandInOut(markers: Marker[]): { ms: number; value: string; note: string }[] {
  const out: { ms: number; value: string; note: string }[] = []
  for (const m of markers) {
    if (m.start_ms < 0) continue
    out.push({ ms: m.start_ms, value: `▸ ${m.value}`, note: m.note })
    if (typeof m.end_ms === 'number' && m.end_ms > m.start_ms) {
      out.push({ ms: m.end_ms, value: '◂ end', note: m.note })
    }
  }
  return out.sort((a, b) => a.ms - b.ms)
}

function renderMarkers(markers: Marker[]): string {
  return expandInOut(markers)
    .map((m) => `<marker start="${m.ms}/1000s" value="${m.value}" note="${m.note}" completed="0"/>`)
    .join('\n')
}

// ── Standalone FCPXML generation ────────────────────────────────────────────
// Builds a complete Final Cut Pro file containing the uploaded audio as a clip
// on a 30 fps timeline, with a marker placed at each best moment. The editor
// imports this, relinks the audio, and lines it up against their video footage.

const FPS = 30
const FRAME_DURATION = '100/3000s' // exactly 30 fps

// Convert milliseconds to a frame-aligned FCPXML time string (required so Final
// Cut accepts the value as landing on an edit boundary).
function msToFcpTime(ms: number): string {
  const frames = Math.max(0, Math.round((ms / 1000) * FPS))
  return `${frames * 100}/3000s`
}

interface StandaloneOptions {
  projectTitle: string
  audioFilename: string
  durationMs: number
  markers: Marker[]
}

function buildMarkersFromBeats(beats: StoryBeat[], segMap: Map<string, Segment>): Marker[] {
  return buildMarkers(beats, segMap)
}

export function topSegmentMarkers(segments: Segment[], limit = 25): Marker[] {
  return [...segments]
    .sort((a, b) => b.story_score - a.story_score)
    .slice(0, limit)
    .map((s) => ({
      start_ms: s.start_ms,
      end_ms: s.end_ms,
      value: escapeXml(`★${Math.round(s.story_score)} ${s.text.slice(0, 40)}`),
      note: 'Best moment',
    }))
    .sort((a, b) => a.start_ms - b.start_ms)
}

export function beatMarkers(beats: StoryBeat[], segments: Segment[]): Marker[] {
  const segMap = new Map<string, Segment>(segments.map((s) => [s.id, s]))
  return buildMarkersFromBeats(beats, segMap)
}

function renderStandaloneMarkers(markers: Marker[], durationMs: number): string {
  const maxFrames = Math.max(1, Math.round((durationMs / 1000) * FPS))
  // Each moment becomes an IN marker (label) and an OUT marker (end of the cut).
  return expandInOut(markers)
    .map((m) => {
      // Clamp so no marker sits at or past the clip end (Final Cut rejects that).
      const frames = Math.min(maxFrames - 1, Math.max(0, Math.round((m.ms / 1000) * FPS)))
      const start = `${frames * 100}/3000s`
      return `            <marker start="${start}" duration="${FRAME_DURATION}" value="${m.value}" note="${m.note}"/>`
    })
    .join('\n')
}

export function buildStandaloneFcpxml(opts: StandaloneOptions): string {
  const { projectTitle, audioFilename, durationMs, markers } = opts
  const duration = msToFcpTime(Math.max(durationMs, 1000))
  const name = escapeXml(audioFilename)
  const title = escapeXml(projectTitle)
  const markerBlock = renderStandaloneMarkers(markers, durationMs)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="${FRAME_DURATION}" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
    <asset id="r2" name="${name}" start="0s" duration="${duration}" hasVideo="0" hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000">
      <media-rep kind="original-media" src="${name}"/>
    </asset>
  </resources>
  <library>
    <event name="Weddit">
      <project name="${title}">
        <sequence format="r1" duration="${duration}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
            <asset-clip ref="r2" offset="0s" name="${name}" duration="${duration}" audioRole="dialogue">
${markerBlock}
            </asset-clip>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`
}

export function injectMarkers(
  fcpxmlString: string,
  beats: StoryBeat[],
  segments: Segment[],
): string {
  const segMap = new Map<string, Segment>(segments.map((s) => [s.id, s]))
  const markers = buildMarkers(beats, segMap)
  if (markers.length === 0) return fcpxmlString

  const markerBlock = '\n' + renderMarkers(markers) + '\n'

  // Strategy 1: inject before closing tag of first <gap> or <asset-clip>
  const clipMatch = fcpxmlString.match(/<(gap|asset-clip)[^>]*>/)
  if (clipMatch) {
    const tagName = clipMatch[1]
    const closeTag = `</${tagName}>`
    const insertIdx = fcpxmlString.indexOf(closeTag, clipMatch.index!)
    if (insertIdx !== -1) {
      return (
        fcpxmlString.slice(0, insertIdx) +
        markerBlock +
        fcpxmlString.slice(insertIdx)
      )
    }
  }

  // Strategy 2: fallback — insert before </spine>
  const spineClose = '</spine>'
  const spineIdx = fcpxmlString.indexOf(spineClose)
  if (spineIdx !== -1) {
    return (
      fcpxmlString.slice(0, spineIdx) +
      markerBlock +
      fcpxmlString.slice(spineIdx)
    )
  }

  return fcpxmlString
}
