import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export type ToastState = {
  message: string
  variant: ToastVariant
  id: number
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counterRef = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const show = useCallback((message: string, variant: ToastVariant = 'info', duration = 2000) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    counterRef.current++
    setToast({ message, variant, id: counterRef.current })
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return { toast, show, hide }
}
