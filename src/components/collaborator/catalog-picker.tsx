'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, FileText, Search, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ServiceCatalogItem } from '@/lib/types'

export function CatalogPicker({ items }: { items: ServiceCatalogItem[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const term = query.trim().toLowerCase()

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category || 'Outros'))).sort(),
    [items]
  )

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category && (item.category || 'Outros') !== category) return false
      if (!term) return true
      return [item.title, item.description, ...item.keywords].join(' ').toLowerCase().includes(term)
    })
  }, [items, term, category])

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Abrir chamado</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Escolha o tipo de solicitação no catálogo.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar catálogo..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-2.5 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[null, ...categories].map((name) => (
          <button
            key={name ?? 'all'}
            onClick={() => setCategory(name)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
              category === name
                ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
            )}
          >
            {name ?? 'Tudo'}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        {filtered.map((item) => (
          <Link key={item.id} href={`/new-ticket?catalog=${item.slug}`}>
            <Card className="transition-colors hover:border-zinc-700">
              <CardContent className="flex items-center gap-3 py-3.5">
                <FileText className="h-4 w-4 shrink-0 text-sky-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                    {item.requires_approval && <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />}
                  </div>
                  <p className="text-xs text-zinc-500">{item.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-700" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-600">
              Nenhum item encontrado no catálogo.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
