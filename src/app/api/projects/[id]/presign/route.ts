import { getJson, presignUpload, putJson } from '@/lib/r2'
import type { ProjectMeta } from '@/lib/types'

const AUDIO_EXTENSIONS = ['mp3', 'mp4', 'wav', 'm4a', 'mov']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { fileType, contentType, extension, filename } = await request.json()

    if (fileType === 'audio' && !AUDIO_EXTENSIONS.includes(extension)) {
      return Response.json({ error: `Unsupported audio extension: ${extension}` }, { status: 400 })
    }

    const key =
      fileType === 'audio'
        ? `projects/${id}/uploads/audio.${extension}`
        : `projects/${id}/uploads/timeline.fcpxml`
    // Remember what the file was actually called. Final Cut relinks by
    // filename, so the export can emit the real name and auto-match on import.
    if (fileType === 'audio' && typeof filename === 'string' && filename.trim()) {
      try {
        const meta = await getJson<ProjectMeta>(`projects/${id}/meta.json`)
        meta.originalFilename = filename.trim().split('/').pop()
        meta.updatedAt = Date.now()
        await putJson(`projects/${id}/meta.json`, meta)
      } catch {
        // non-fatal: export falls back to the audio.<ext> key name
      }
    }

    const url = await presignUpload(key, contentType)
    return Response.json({ url, key })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
