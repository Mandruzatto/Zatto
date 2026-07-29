'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { ASSET_TYPE_LABELS } from '@/lib/utils'
import type { AssetType } from '@/lib/types'
import { Monitor, X, Search, Loader2, Plus } from 'lucide-react'

interface LinkedAsset {
  id: string
  asset_tag: string
  name: string
}

interface SearchedAsset {
  id: string
  asset_tag: string
  name: string
  type: AssetType
  phone_line: string | null
}

interface TicketAssetsManagerProps {
  ticketId: string
  linkedAssets: LinkedAsset[]
  requesterAssets: SearchedAsset[]
}

export function TicketAssetsManager({
  ticketId,
  linkedAssets,
  requesterAssets,
}: TicketAssetsManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchedAsset[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [working, setWorking] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const linkedIds = new Set(linkedAssets.map((a) => a.id))
  const requesterSuggestions = requesterAssets.filter((a) => !linkedIds.has(a.id))

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      const term = `%${value.trim()}%`
      setSearching(true)
      const { data } = await supabase
        .from('assets')
        .select('id, asset_tag, name, type, phone_line')
        .or(`asset_tag.ilike.${term},name.ilike.${term},serial_number.ilike.${term},phone_line.ilike.${term}`)
        .limit(8)
      setResults(((data ?? []) as SearchedAsset[]).filter((a) => !linkedIds.has(a.id)))
      setSearching(false)
    }, 250)
  }

  async function handleLink(asset: SearchedAsset) {
    setWorking(true)

    const { error } = await supabase.from('ticket_assets').insert({
      ticket_id: ticketId,
      asset_id: asset.id,
    })

    setWorking(false)
    if (error) {
      toast('Erro ao vincular ativo', 'error')
      return
    }
    toast(`${asset.name} vinculado ao chamado`)
    setQuery('')
    setResults([])
    setOpen(false)
    router.refresh()
  }

  async function handleRemove(asset: LinkedAsset) {
    setWorking(true)

    const { error } = await supabase
      .from('ticket_assets')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('asset_id', asset.id)

    setWorking(false)
    if (error) {
      toast('Erro ao desvincular ativo', 'error')
      return
    }
    toast('Ativo desvinculado')
    router.refresh()
  }

  const showingSuggestions = query.trim().length < 2
  const list = showingSuggestions ? requesterSuggestions : results

  return (
    <Card>
      <CardHeader><CardTitle>Ativos vinculados</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        {linkedAssets.length > 0 ? (
          <div className="space-y-2">
            {linkedAssets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 group">
                <Monitor className="h-4 w-4 text-zinc-600 shrink-0" />
                <Link
                  href={`/assets/${asset.id}`}
                  className="text-[13px] text-zinc-300 hover:text-zinc-50 transition-colors truncate flex-1 min-w-0"
                >
                  {asset.name}
                  <span className="text-zinc-600 text-xs ml-1.5 font-mono">{asset.asset_tag}</span>
                </Link>
                <button
                  onClick={() => handleRemove(asset)}
                  disabled={working}
                  className="text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                  title="Desvincular"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-zinc-600">Nenhum ativo vinculado.</p>
        )}

        <div ref={containerRef} className="relative border-t border-zinc-800/70 pt-3.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
            {searching && (
              <Loader2 className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-600 animate-spin" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder="Buscar ativo por nome, tag, série, linha..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-8 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 transition-colors focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          {open && list.length > 0 && (
            <div className="absolute top-full mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden z-40 max-h-64 overflow-y-auto">
              {showingSuggestions && (
                <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                  Ativos do solicitante
                </p>
              )}
              {list.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleLink(asset)}
                  disabled={working}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-900 transition-colors text-left disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{asset.name}</p>
                    <p className="text-xs text-zinc-600 font-mono truncate">
                      {asset.asset_tag} · {ASSET_TYPE_LABELS[asset.type]}
                      {asset.phone_line && ` · ${asset.phone_line}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {open && !showingSuggestions && !searching && results.length === 0 && (
            <div className="absolute top-full mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 z-40">
              <p className="px-3 py-4 text-center text-[13px] text-zinc-600">
                Nenhum ativo encontrado para &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
