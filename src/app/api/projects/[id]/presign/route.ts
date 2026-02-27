import { presignUpload } from '@/lib/r2'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { fileType, contentType, extension } = await request.json()
    const key =
      fileType === 'audio'
        ? `projects/${id}/uploads/audio.${extension ?? 'mp3'}`
        : `projects/${id}/uploads/timeline.fcpxml`
    const url = await presignUpload(key, contentType)
    return Response.json({ url, key })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
