import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 600) {
  const [displayed, setDisplayed] = useState(target)
  const prevRef = useRef(target)

  useEffect(() => {
    const from = prevRef.current
    if (from === target) return

    let cancelled = false
    const startTime = performance.now()

    function tick(now: number) {
      if (cancelled) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      setDisplayed(Math.round(from + (target - from) * progress))
      if (progress < 1) requestAnimationFrame(tick)
      else prevRef.current = target
    }

    requestAnimationFrame(tick)
    return () => {
      cancelled = true
      prevRef.current = target
    }
  }, [target, duration])

  return displayed
}
