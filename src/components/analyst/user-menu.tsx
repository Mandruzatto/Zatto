'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Moon, Settings, Sun } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

export function UserMenu({ fullName, email }: { fullName: string; email: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const light = theme === 'light'

  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'

  useEffect(() => {
    if (!open) return
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Menu do usuário"
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
          open
            ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
            : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
        )}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-zinc-950/60">
          <div className="border-b border-zinc-800/70 px-3.5 py-3">
            <p className="truncate text-[13px] font-medium text-zinc-200">{fullName}</p>
            <p className="truncate text-[11px] text-zinc-600">{email}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-700">Analista</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              <Settings className="h-4 w-4 text-zinc-600" />
              Configurações
            </Link>
            <button
              onClick={() => setTheme(light ? 'dark' : 'light')}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              {light ? <Moon className="h-4 w-4 text-zinc-600" /> : <Sun className="h-4 w-4 text-zinc-600" />}
              {light ? 'Tema escuro' : 'Tema claro'}
            </button>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4 text-zinc-600" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
