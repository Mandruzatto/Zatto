'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error'

interface ToastData {
  id: number
  message: string
  type: ToastType
}

export function toast(message: string, type: ToastType = 'success') {
  window.dispatchEvent(new CustomEvent('zatto:toast', { detail: { message, type } }))
}

let nextId = 0

export function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const { message, type } = (e as CustomEvent).detail as { message: string; type: ToastType }
      const item: ToastData = { id: ++nextId, message, type }
      setToasts((prev) => [...prev, item])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id))
      }, 3200)
    }
    window.addEventListener('zatto:toast', onToast)
    return () => window.removeEventListener('zatto:toast', onToast)
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[13px] font-medium shadow-2xl shadow-black/50',
            'toast-enter',
            t.type === 'success'
              ? 'border-emerald-500/30 bg-zinc-900 text-zinc-100'
              : 'border-red-500/30 bg-zinc-900 text-zinc-100'
          )}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  )
}
