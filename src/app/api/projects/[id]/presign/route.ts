import { presignUpload } from '@/lib/r2'

const AUDIO_EXTENSIONS = ['mp3', 'mp4', 'wav', 'm4a', 'mov']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { fileType, contentType, extension } = await request.json()

    if (fileType === 'audio' && !AUDIO_EXTENSIONS.includes(extension)) {
      return Response.json({ error: `Unsupported audio extension: ${extension}` }, { status: 400 })
    }

    const key =
      fileType === 'audio'
        ? `projects/${id}/uploads/audio.${extension}`
        : `projects/${id}/uploads/timeline.fcpxml`
    const url = await presignUpload(key, contentType)
    return Response.json({ url, key })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
