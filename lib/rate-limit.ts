const store = new Map<string, number[]>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000
    for (const [key, hits] of store) {
      if (hits.every(t => t < cutoff)) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

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
