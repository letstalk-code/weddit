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
      markers.push({ start_ms: seg.start_ms, value: label, note: beat.name })
    }
  }
  return markers.sort((a, b) => a.start_ms - b.start_ms)
}

function renderMarkers(markers: Marker[]): string {
  return markers
    .map((m) => `<marker start="${m.start_ms}/1000s" value="${m.value}" note="${m.note}" completed="0"/>`)
    .join('\n')
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
