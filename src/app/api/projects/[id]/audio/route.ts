import { objectExists, presignDownload } from '@/lib/r2'

const AUDIO_EXTENSIONS = ['mp3', 'mp4', 'wav', 'm4a', 'mov']

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    for (const ext of AUDIO_EXTENSIONS) {
      const key = `projects/${id}/uploads/audio.${ext}`
      if (await objectExists(key)) {
        const url = await presignDownload(key)
        return Response.json({ url })
      }
    }
    return Response.json({ error: 'No audio found for this project' }, { status: 404 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
