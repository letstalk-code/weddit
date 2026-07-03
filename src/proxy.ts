import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, sha256Hex } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const expected = process.env.APP_PASSWORD
  // No password configured → do not lock anyone out (local/dev, or before the
  // owner sets APP_PASSWORD in production).
  if (!expected) return NextResponse.next()

  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (token && token === (await sha256Hex(expected))) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  // Unauthenticated API calls get a clean 401; page navigations go to /login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Guard everything except the login page, the login API, Next internals, and
  // the favicon. The Modal worker never calls a Vercel API route (it talks only
  // to R2 + Deepgram), so guarding all of /api is safe.
  matcher: ['/((?!login|api/auth/login|_next/static|_next/image|favicon.ico).*)'],
}
