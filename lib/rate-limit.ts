// Sliding-window in-memory rate limiter.
// Works per function instance (serverless best-effort), enough to prevent accidental abuse.

const store = new Map<string, number[]>()

// Prune stale keys every 5 min to avoid memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000
    for (const [key, hits] of store) {
      if (hits.every(t => t < cutoff)) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique identifier (IP, userId, etc.)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  const hits = (store.get(key) ?? []).filter(t => t > windowStart)
  if (hits.length >= limit) return false
  hits.push(now)
  store.set(key, hits)
  return true
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
