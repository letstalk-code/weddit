import { getJson, objectExists } from '@/lib/r2'
import type { ProjectIndex, ProjectMeta } from '@/lib/types'

export async function GET() {
  try {
    if (!(await objectExists('projects/index.json'))) {
      return Response.json({ projects: [] })
    }
    const index = await getJson<ProjectIndex>('projects/index.json')

    // index.json only tracks id/order — the worker writes live status to each
    // project's own meta.json, so refresh from there to avoid showing stale status.
    const projects = await Promise.all(
      index.projects.map(async (p) => {
        try {
          return await getJson<ProjectMeta>(`projects/${p.id}/meta.json`)
        } catch {
          return p
        }
      }),
    )

    return Response.json({ projects })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
