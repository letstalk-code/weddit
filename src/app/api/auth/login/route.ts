import { NextResponse } from 'next/server'
import { AUTH_COOKIE, sha256Hex } from '@/lib/auth'

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({}))
  const expected = process.env.APP_PASSWORD
  if (!expected) {
    return NextResponse.json({ error: 'APP_PASSWORD is not configured' }, { status: 503 })
  }
  if (typeof password !== 'string' || password !== expected) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, await sha256Hex(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
