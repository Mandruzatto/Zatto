'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Ticket, Monitor, User, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  cn,
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
} from '@/lib/utils'
import type { TicketStatus, AssetStatus, AssetType } from '@/lib/types'

interface TicketResult {
  id: string
  ticket_number: string
  title: string
  status: TicketStatus
}

interface AssetResult {
  id: string
  asset_tag: string
  name: string
  type: AssetType
  status: AssetStatus
  phone_line: string | null
  serial_number: string | null
}

interface ProfileResult {
  id: string
  full_name: string
  email: string
  department: string | null
}

interface SearchResults {
  tickets: TicketResult[]
  assets: AssetResult[]
  profiles: ProfileResult[]
}

const EMPTY: SearchResults = { tickets: [], assets: [], profiles: [] }

export function GlobalSearch() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const runSearch = useCallback(async (q: string) => {
    const term = `%${q}%`
    setLoading(true)

    const [ticketsRes, assetsRes, profilesRes] = await Promise.all([
      supabase
        .from('tickets')
        .select('id, ticket_number, title, status')
        .or(`ticket_number.ilike.${term},title.ilike.${term},description.ilike.${term}`)
        .limit(5),
      supabase
        .from('assets')
        .select('id, asset_tag, name, type, status, phone_line, serial_number')
        .or(`asset_tag.ilike.${term},name.ilike.${term},brand.ilike.${term},model.ilike.${term},serial_number.ilike.${term},phone_line.ilike.${term},notes.ilike.${term}`)
        .limit(5),
      supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .or(`full_name.ilike.${term},email.ilike.${term},department.ilike.${term}`)
        .limit(5),
    ])

    setResults({
      tickets: (ticketsRes.data ?? []) as TicketResult[],
      assets: (assetsRes.data ?? []) as AssetResult[],
      profiles: (profilesRes.data ?? []) as ProfileResult[],
    })
    setLoading(false)
  }, [supabase])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults(EMPTY)
      setOpen(false)
      return
    }

    setOpen(true)
    debounceRef.current = setTimeout(() => runSearch(value.trim()), 250)
  }

  function go(path: string) {
    setOpen(false)
    setQuery('')
    setResults(EMPTY)
    router.push(path)
  }

  const hasResults = results.tickets.length > 0 || results.assets.length > 0 || results.profiles.length > 0

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-zinc-600 animate-spin" />
        )}
        {!loading && !query && (
          <kbd className="absolute right-3 top-2 hidden sm:flex items-center gap-0.5 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
            ⌘K
          </kbd>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Buscar tickets, ativos, colaboradores..."
          className={cn(
            'w-full rounded-lg border border-zinc-800 bg-zinc-900/80 pl-9 pr-12 py-2 text-[13px] text-zinc-100',
            'placeholder:text-zinc-600 transition-colors',
            'focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600'
          )}
        />
      </div>

      {open && (
        <div className="absolute top-full mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
          {!hasResults && !loading && (
            <p className="px-4 py-6 text-center text-[13px] text-zinc-600">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </p>
          )}

          {results.tickets.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                Tickets
              </p>
              {results.tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => go(`/tickets/${t.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-900 transition-colors text-left"
                >
                  <Ticket className="h-4 w-4 text-zinc-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{t.title}</p>
                    <p className="text-xs text-zinc-600 font-mono">{t.ticket_number}</p>
                  </div>
                  <Badge className={TICKET_STATUS_COLORS[t.status]}>
                    {TICKET_STATUS_LABELS[t.status]}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {results.assets.length > 0 && (
            <div className={results.tickets.length > 0 ? 'border-t border-zinc-800/70' : ''}>
              <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                Ativos
              </p>
              {results.assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => go(`/assets/${a.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-900 transition-colors text-left"
                >
                  <Monitor className="h-4 w-4 text-zinc-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{a.name}</p>
                    <p className="text-xs text-zinc-600 font-mono">
                      {a.asset_tag} · {ASSET_TYPE_LABELS[a.type]}
                      {a.phone_line && ` · ${a.phone_line}`}
                    </p>
                  </div>
                  <Badge className={ASSET_STATUS_COLORS[a.status]}>
                    {ASSET_STATUS_LABELS[a.status]}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {results.profiles.length > 0 && (
            <div className={results.tickets.length > 0 || results.assets.length > 0 ? 'border-t border-zinc-800/70' : ''}>
              <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                Colaboradores
              </p>
              {results.profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go(`/users/${p.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-900 transition-colors text-left"
                >
                  <User className="h-4 w-4 text-zinc-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{p.full_name}</p>
                    <p className="text-xs text-zinc-600 truncate">
                      {p.email}
                      {p.department && ` · ${p.department}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
