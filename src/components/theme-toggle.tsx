'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export const THEME_STORAGE_KEY = 'zatto:theme'

export function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    // Theme is applied by the pre-hydration script, so read it back once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLight(document.documentElement.classList.contains('light'))
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    document.documentElement.classList.toggle('light', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'light' : 'dark')
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
    >
      {light ? <Moon className="h-4 w-4 text-zinc-600" /> : <Sun className="h-4 w-4 text-zinc-600" />}
      {light ? 'Tema escuro' : 'Tema claro'}
    </button>
  )
}
