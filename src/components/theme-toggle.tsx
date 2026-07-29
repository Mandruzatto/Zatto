'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const light = theme === 'light'

  return (
    <button
      onClick={() => setTheme(light ? 'dark' : 'light')}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors',
        className
      )}
    >
      {light ? <Moon className="h-4 w-4 text-zinc-600" /> : <Sun className="h-4 w-4 text-zinc-600" />}
      {light ? 'Tema escuro' : 'Tema claro'}
    </button>
  )
}
