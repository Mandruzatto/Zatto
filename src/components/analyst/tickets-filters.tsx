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
import { SavedTicketFilters } from '@/components/analyst/saved-ticket-filters'

const FILTERS: { key: string; placeholder: string; labels: Record<string, string> }[] = [
  { key: 'status', placeholder: 'Status', labels: TICKET_STATUS_LABELS },
  { key: 'priority', placeholder: 'Prioridade', labels: TICKET_PRIORITY_LABELS },
  { key: 'type', placeholder: 'Tipo', labels: TICKET_TYPE_LABELS },
  { key: 'area', placeholder: 'Área', labels: TICKET_AREA_LABELS },
  { key: 'sla', placeholder: 'SLA', labels: { breached: 'Vencido', risk: 'Em risco (4h)' } },
  {
    key: 'awaiting',
    placeholder: 'Atenção',
    labels: { '1': 'Aguardando resposta' },
  },
  {
    key: 'remote',
    placeholder: 'Sessão remota',
    labels: {
      today: 'Sessões hoje',
      ready: 'Autorizadas (entrar)',
      awaiting: 'Aguardando autorização',
    },
  },
]

export function TicketsFilters({
  exclude = [],
  analysts = [],
  teams = [],
  hasTeams = false,
  currentUserId,
}: {
  exclude?: string[]
  analysts?: { id: string; full_name: string }[]
  teams?: { id: string; name: string }[]
  /** A pessoa está em alguma fila — só aí "Minhas filas" faz sentido. */
  hasTeams?: boolean
  currentUserId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = FILTERS.filter((filter) => !exclude.includes(filter.key))

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`)
  }

  const assignee = searchParams.get('assignee') ?? ''
  const team = searchParams.get('team') ?? ''
  const hasFilters =
    filters.some((f) => searchParams.get(f.key)) ||
    searchParams.get('q') ||
    Boolean(assignee) ||
    Boolean(team)

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <ListSearch placeholder="Buscar por título ou número..." className="w-64" />

        {!exclude.includes('assignee') && analysts.length > 0 && (
          <div className="relative">
            <select
              value={assignee}
              onChange={(e) => setParam('assignee', e.target.value)}
              className={cn(
                'appearance-none rounded-lg border bg-zinc-900 pl-3 pr-8 py-2 text-[13px] transition-colors cursor-pointer',
                'focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600',
                assignee ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-500'
              )}
            >
              <option value="">Responsável</option>
              {currentUserId && <option value="me">Atribuídos a mim</option>}
              <option value="unassigned">Não atribuídos</option>
              {analysts.map((analyst) => (
                <option key={analyst.id} value={analyst.id}>
                  {analyst.full_name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-zinc-600" />
          </div>
        )}

        {!exclude.includes('team') && teams.length > 0 && (
          <div className="relative">
            <select
              value={team}
              onChange={(e) => setParam('team', e.target.value)}
              className={cn(
                'appearance-none rounded-lg border bg-zinc-900 pl-3 pr-8 py-2 text-[13px] transition-colors cursor-pointer',
                'focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600',
                team ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-500'
              )}
            >
              <option value="">Fila</option>
              {hasTeams && <option value="mine">Minhas filas</option>}
              <option value="none">Sem fila</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-zinc-600" />
          </div>
        )}

        {filters.map((filter) => {
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

      <SavedTicketFilters />
    </div>
  )
}
