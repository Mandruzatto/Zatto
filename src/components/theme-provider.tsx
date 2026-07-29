'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

export const THEME_STORAGE_KEY = 'zatto:theme'

export type Theme = 'dark' | 'light'

const listeners = new Set<() => void>()

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function serverTheme(): Theme {
  return 'dark'
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme)

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {}
    // The storage event only reaches other tabs, so notify this one directly.
    listeners.forEach((listener) => listener())
  }, [])

  return { theme, setTheme }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()

  // React owns the attribute from here on, so it is reapplied on every change
  // even if something else clears it.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return <>{children}</>
}
