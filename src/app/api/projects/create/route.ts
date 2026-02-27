import { getJson, objectExists, putJson } from '@/lib/r2'
import type { ProjectIndex, ProjectMeta } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const { title } = await request.json()
    const id = crypto.randomUUID()
    const now = Date.now()
    const meta: ProjectMeta = { id, title, status: 'created', createdAt: now, updatedAt: now }

    await putJson(`projects/${id}/meta.json`, meta)

    const index: ProjectIndex = (await objectExists('projects/index.json'))
      ? await getJson<ProjectIndex>('projects/index.json')
      : { projects: [] }

    index.projects.unshift(meta)
    await putJson('projects/index.json', index)

    return Response.json(meta, { status: 201 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
