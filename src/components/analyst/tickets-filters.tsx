'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ListSearch } from '@/components/ui/list-search'
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_AREA_LABELS,
  cn,
} from '@/lib/utils'
import { ChevronDown, X } from 'lucide-react'

const FILTERS: { key: string; placeholder: string; labels: Record<string, string> }[] = [
  { key: 'status', placeholder: 'Status', labels: TICKET_STATUS_LABELS },
  { key: 'priority', placeholder: 'Prioridade', labels: TICKET_PRIORITY_LABELS },
  { key: 'type', placeholder: 'Tipo', labels: TICKET_TYPE_LABELS },
  { key: 'area', placeholder: 'Área', labels: TICKET_AREA_LABELS },
]

export function TicketsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`)
  }

  const hasFilters = FILTERS.some((f) => searchParams.get(f.key)) || searchParams.get('q')

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <ListSearch placeholder="Buscar por título ou número..." className="w-64" />

      {FILTERS.map((filter) => {
        const current = searchParams.get(filter.key) ?? ''
        return (
          <div key={filter.key} className="relative">
            <select
              value={current}
              onChange={(e) => setParam(filter.key, e.target.value)}
              className={cn(
                'appearance-none rounded-lg border bg-zinc-900 pl-3 pr-8 py-2 text-[13px] transition-colors cursor-pointer',
                'focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600',
                current
                  ? 'border-zinc-600 text-zinc-100'
                  : 'border-zinc-800 text-zinc-500'
              )}
            >
              <option value="">{filter.placeholder}</option>
              {Object.entries(filter.labels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-zinc-600" />
          </div>
        )
      })}

      {hasFilters && (
        <button
          onClick={() => router.replace(pathname)}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1.5"
        >
          <X className="h-3 w-3" />
          Limpar filtros
        </button>
      )}
    </div>
  )
}
