'use client'

import { useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bookmark, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'zatto:ticket-filter-presets'
const CHANGE_EVENT = 'zatto:ticket-filter-presets-change'
const MAX_PRESETS = 5

type Preset = {
  id: string
  name: string
  query: string
}

function parsePresets(raw: string | null): Preset[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Preset[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_PRESETS) : []
  } catch {
    return []
  }
}

function subscribe(onStoreChange: () => void) {
  const handler = () => onStoreChange()
  window.addEventListener('storage', handler)
  window.addEventListener(CHANGE_EVENT, handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(CHANGE_EVENT, handler)
  }
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY)
}

function getServerSnapshot() {
  return null
}

function writePresets(presets: Preset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {}
}

export function SavedTicketFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const presets = parsePresets(raw)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const currentQuery = searchParams.toString()
  const canSave = Boolean(currentQuery) && presets.length < MAX_PRESETS

  function apply(preset: Preset) {
    router.replace(`${pathname}${preset.query ? `?${preset.query}` : ''}`)
  }

  function save() {
    const trimmed = name.trim()
    if (!trimmed || !currentQuery) return
    writePresets([
      { id: crypto.randomUUID(), name: trimmed.slice(0, 40), query: currentQuery },
      ...presets,
    ].slice(0, MAX_PRESETS))
    setName('')
    setNaming(false)
  }

  function remove(id: string) {
    writePresets(presets.filter((preset) => preset.id !== id))
  }

  if (presets.length === 0 && !canSave && !naming) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        <Bookmark className="h-3 w-3" />
        Meus filtros
      </span>

      {presets.map((preset) => {
        const active = currentQuery === preset.query
        return (
          <span
            key={preset.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] transition-colors',
              active
                ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            )}
          >
            <button type="button" onClick={() => apply(preset)} className="max-w-[10rem] truncate">
              {preset.name}
            </button>
            <button
              type="button"
              onClick={() => remove(preset.id)}
              className="text-zinc-600 hover:text-zinc-200"
              aria-label={`Remover filtro ${preset.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}

      {naming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="inline-flex items-center gap-1.5"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do filtro"
            className="w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-zinc-50 px-2 py-1 text-[12px] font-medium text-zinc-950 disabled:opacity-40"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => {
              setNaming(false)
              setName('')
            }}
            className="text-[12px] text-zinc-500 hover:text-zinc-200"
          >
            Cancelar
          </button>
        </form>
      ) : (
        canSave && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-800 px-2 py-1 text-[12px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          >
            <Plus className="h-3 w-3" />
            Salvar atual
          </button>
        )
      )}
    </div>
  )
}
