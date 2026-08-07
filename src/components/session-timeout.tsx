'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ACTIVITY_KEY = 'zatto:last-activity'
export const EXPIRED_FLAG_KEY = 'zatto:session-expired'

const CHECK_INTERVAL_MS = 30_000
const WRITE_THROTTLE_MS = 15_000
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'wheel', 'touchstart'] as const

export function SessionTimeout({ timeoutMinutes = 30 }: { timeoutMinutes?: number }) {
  const router = useRouter()

  useEffect(() => {
    // Logout por inatividade é proteção de produção. Em desenvolvimento só derruba
    // a sessão no meio do trabalho, então fica desligado localmente.
    if (process.env.NODE_ENV === 'development') return

    const supabase = createClient()
    const limitMs = timeoutMinutes * 60_000
    let lastWrite = 0
    let expiring = false

    function markActivity() {
      const now = Date.now()
      if (now - lastWrite < WRITE_THROTTLE_MS) return
      lastWrite = now
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now))
      } catch {}
    }

    function lastActivityAt() {
      try {
        const stored = Number(localStorage.getItem(ACTIVITY_KEY))
        if (Number.isFinite(stored) && stored > 0) return stored
      } catch {}
      return Date.now()
    }

    async function expire() {
      if (expiring) return
      expiring = true
      try {
        localStorage.removeItem(ACTIVITY_KEY)
        sessionStorage.setItem(EXPIRED_FLAG_KEY, '1')
      } catch {}
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    }

    function checkIdle() {
      if (Date.now() - lastActivityAt() >= limitMs) void expire()
    }

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      checkIdle()
    }

    try {
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
    } catch {}

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true })
    )
    document.addEventListener('visibilitychange', onVisibilityChange)
    const interval = window.setInterval(checkIdle, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(interval)
    }
  }, [router, timeoutMinutes])

  return null
}
