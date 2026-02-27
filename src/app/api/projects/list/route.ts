import { getJson, objectExists } from '@/lib/r2'
import type { ProjectIndex } from '@/lib/types'

export async function GET() {
  try {
    if (!(await objectExists('projects/index.json'))) {
      return Response.json({ projects: [] })
    }
    const index = await getJson<ProjectIndex>('projects/index.json')
    return Response.json(index)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
