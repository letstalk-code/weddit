// Minimal shared-password gate for this single-user app. The login route sets a
// cookie to sha256(APP_PASSWORD); the middleware allows a request only when the
// cookie matches that same hash. Web Crypto is available in both the Node route
// handler and the Edge middleware, so this one helper serves both.

export const AUTH_COOKIE = 'weddit_auth'

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
