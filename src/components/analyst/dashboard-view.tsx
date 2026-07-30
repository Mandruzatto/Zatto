'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Ticket as TicketIcon,
  Monitor,
  AlertCircle,
  ShieldAlert,
  Settings2,
  X,
  MessageSquare,
  CheckCircle2,
  CalendarClock,
  MonitorSmartphone,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  cn,
  formatDate,
  formatDateShort,
  daysUntil,
  getWarrantyStatus,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_STATUS_BAR_COLORS,
  TICKET_STATUS_HEX,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
  REMOTE_SESSION_STATUS_LABELS,
  REMOTE_SESSION_STATUS_COLORS,
  getScheduleState,
} from '@/lib/utils'
import type { Ticket, TicketStatus, Asset, RemoteSessionStatus } from '@/lib/types'

export interface DashboardData {
  statusCounts: Record<TicketStatus, number>
  assetsInUse: number
  assetsStock: number
  totalUsers: number
  recentTickets: (Ticket & { requester: { full_name: string; department?: string } | null })[]
  criticalTickets: (Ticket & { requester: { full_name: string } | null })[]
  warrantyAssets: Asset[]
  awaitingReply: {
    id: string
    ticket_number: string
    title: string
    status: TicketStatus
    requester_name: string
    last_comment_at: string
  }[]
  newlyApproved: {
    id: string
    ticket_number: string
    title: string
    status: TicketStatus
    requester_name: string
    approver_name: string
    decided_at: string
  }[]
  scheduledTickets: {
    id: string
    ticket_number: string
    title: string
    scheduled_for: string
    requester_name: string
    assignee_name: string | null
  }[]
  remoteSessionsToday: {
    id: string
    ticket_id: string
    ticket_number: string
    title: string
    scheduled_for: string
    status: RemoteSessionStatus
    requester_name: string
  }[]
  remoteReadyCount: number
  slaBreached: number
  slaAtRisk: number
}

type WidgetId =
  | 'stats' | 'progress' | 'pie' | 'awaiting' | 'approved' | 'scheduled' | 'remote' | 'warranty' | 'recent' | 'critical'

const WIDGETS: { id: WidgetId; label: string }[] = [
  { id: 'stats', label: 'Indicadores' },
  { id: 'progress', label: 'Andamento dos chamados' },
  { id: 'pie', label: 'Gráfico de pizza' },
  { id: 'awaiting', label: 'Aguardando resposta' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'scheduled', label: 'Agenda' },
  { id: 'remote', label: 'Sessões remotas' },
  { id: 'warranty', label: 'Alertas de garantia' },
  { id: 'recent', label: 'Chamados recentes' },
  { id: 'critical', label: 'Chamados críticos' },
]

const STORAGE_KEY = 'zatto:dashboard-widgets-v2'
const STATUS_FILTER_KEY = 'zatto:dashboard-status-filter-v2'

const DEFAULT_VISIBILITY: Record<WidgetId, boolean> = {
  stats: true,
  progress: false,
  pie: false,
  awaiting: true,
  approved: true,
  scheduled: true,
  remote: true,
  warranty: false,
  recent: false,
  critical: true,
}

const ALL_STATUSES: TicketStatus[] = [
  'open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled', 'finalized',
]

const DEFAULT_STATUS_FILTER: Record<TicketStatus, boolean> = {
  open: true,
  awaiting_approval: true,
  in_progress: true,
  pending: true,
  scheduled: true,
  finalized: false,
}

function DonutChart({
  counts,
  statuses,
  total,
}: {
  counts: Record<TicketStatus, number>
  statuses: TicketStatus[]
  total: number
}) {
  const router = useRouter()
  const [hovered, setHovered] = useState<TicketStatus | null>(null)
  const radius = 15.915494 // circumference = 100

  const segments = statuses.reduce<{ status: TicketStatus; count: number; pct: number; offset: number }[]>(
    (acc, status) => {
      const count = counts[status]
      if (count === 0) return acc
      const consumed = acc.reduce((sum, segment) => sum + segment.pct, 0)
      acc.push({ status, count, pct: (count / total) * 100, offset: -consumed })
      return acc
    },
    []
  )

  return (
    <div className="flex items-center gap-8">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r={radius} fill="none" stroke="#27272a" strokeWidth="5" />
          {segments.map(({ status, count, pct, offset }) => (
            <circle
              key={status}
              cx="21"
              cy="21"
              r={radius}
              fill="none"
              stroke={TICKET_STATUS_HEX[status]}
              strokeWidth={hovered === status ? 6.5 : 5}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
              className="transition-all duration-300 cursor-pointer"
              style={{ opacity: hovered && hovered !== status ? 0.35 : 1 }}
              onMouseEnter={() => setHovered(status)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => router.push(`/tickets?status=${status}`)}
            >
              <title>{`${TICKET_STATUS_LABELS[status]}: ${count}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered ? (
            <>
              <span className="text-2xl font-semibold text-zinc-100 tabular-nums">{counts[hovered]}</span>
              <span className="text-[11px] text-zinc-500 text-center px-4 leading-tight">
                {TICKET_STATUS_LABELS[hovered]}
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-semibold text-zinc-100 tabular-nums">{total}</span>
              <span className="text-[11px] text-zinc-600">tickets</span>
            </>
          )}
        </div>
      </div>
      <div className="space-y-1 min-w-0">
        {statuses.map((status) => {
          const count = counts[status]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <Link
              key={status}
              href={`/tickets?status=${status}`}
              className="flex items-center gap-2 rounded-md px-2 py-1 -mx-2 hover:bg-zinc-900 transition-colors"
              onMouseEnter={() => setHovered(status)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: TICKET_STATUS_HEX[status] }} />
              <span className="text-[13px] text-zinc-400">{TICKET_STATUS_LABELS[status]}</span>
              <span className="text-[13px] font-medium text-zinc-200 tabular-nums ml-auto pl-4">
                {count}
                <span className="text-zinc-600 font-normal ml-1.5">({pct}%)</span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function DashboardView({ data }: { data: DashboardData }) {
  const [visibility, setVisibility] = useState<Record<WidgetId, boolean>>(DEFAULT_VISIBILITY)
  const [statusFilter, setStatusFilter] = useState<Record<TicketStatus, boolean>>(DEFAULT_STATUS_FILTER)
  const [customizing, setCustomizing] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      // Restore the user's persisted widget layout after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setVisibility({ ...DEFAULT_VISIBILITY, ...JSON.parse(stored) })
      const storedStatuses = localStorage.getItem(STATUS_FILTER_KEY)
      if (storedStatuses) setStatusFilter({ ...DEFAULT_STATUS_FILTER, ...JSON.parse(storedStatuses) })
    } catch {}
    setHydrated(true)
  }, [])

  function toggle(id: WidgetId) {
    setVisibility((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function toggleStatus(status: TicketStatus) {
    setStatusFilter((prev) => {
      const next = { ...prev, [status]: !prev[status] }
      localStorage.setItem(STATUS_FILTER_KEY, JSON.stringify(next))
      return next
    })
  }

  function setAllStatuses(value: boolean) {
    const next = ALL_STATUSES.reduce(
      (acc, status) => ({ ...acc, [status]: value }),
      {} as Record<TicketStatus, boolean>
    )
    setStatusFilter(next)
    localStorage.setItem(STATUS_FILTER_KEY, JSON.stringify(next))
  }

  const activeTickets =
    data.statusCounts.open +
    data.statusCounts.awaiting_approval +
    data.statusCounts.in_progress +
    data.statusCounts.pending +
    data.statusCounts.scheduled
  const totalTickets = Object.values(data.statusCounts).reduce((a, b) => a + b, 0)

  const selectedStatuses = ALL_STATUSES.filter((status) => statusFilter[status])
  const selectedTotal = selectedStatuses.reduce((sum, status) => sum + data.statusCounts[status], 0)

  const expiringAssets = data.warrantyAssets.filter((a) => {
    const s = getWarrantyStatus(a.warranty_end_date)
    return s === 'expiring' || s === 'expired'
  })

  const stats = [
    { label: 'Chamados ativos', value: activeTickets, icon: TicketIcon, href: '/tickets' },
    { label: 'SLA vencido', value: data.slaBreached, icon: AlertCircle, href: '/tickets?sla=breached' },
    { label: 'SLA em risco', value: data.slaAtRisk, icon: ShieldAlert, href: '/tickets?sla=risk' },
    {
      label: 'Aguardando resposta',
      value: data.awaitingReply.length,
      icon: MessageSquare,
      href: '/tickets?awaiting=1',
    },
    {
      label: 'Sessões hoje',
      value: data.remoteSessionsToday.length,
      icon: MonitorSmartphone,
      href: '/tickets?remote=today',
    },
  ]

  if (!hydrated) return <div className="p-6" />

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Dashboard</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Filas que precisam da sua atenção</p>
        </div>
        <button
          onClick={() => setCustomizing(!customizing)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors',
            customizing
              ? 'border-zinc-600 bg-zinc-900 text-zinc-100'
              : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Personalizar
        </button>
      </div>

      {customizing && (
        <Card>
          <CardContent className="py-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium text-zinc-300">Widgets visíveis</p>
              <button onClick={() => setCustomizing(false)} className="text-zinc-600 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {WIDGETS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => toggle(w.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    visibility[w.id]
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {visibility.stats && (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Link key={stat.label} href={stat.href}>
                <Card className="hover:border-zinc-700 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500">{stat.label}</p>
                      <Icon className="h-4 w-4 text-zinc-700" />
                    </div>
                    <p className="text-2xl font-semibold text-zinc-100 mt-1.5 tabular-nums">{stat.value}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {visibility.progress && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Andamento dos chamados</CardTitle>
            <span className="text-xs text-zinc-600 tabular-nums">
              {selectedTotal} de {totalTickets} no total
            </span>
          </CardHeader>
          <CardContent>
            {selectedTotal > 0 ? (
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800/60">
                {selectedStatuses.map((status) =>
                  data.statusCounts[status] > 0 ? (
                    <Link
                      key={status}
                      href={`/tickets?status=${status}`}
                      title={`${TICKET_STATUS_LABELS[status]}: ${data.statusCounts[status]}`}
                      className={cn(TICKET_STATUS_BAR_COLORS[status], 'hover:opacity-75 transition-opacity')}
                      style={{ width: `${(data.statusCounts[status] / selectedTotal) * 100}%` }}
                    />
                  ) : null
                )}
              </div>
            ) : (
              <div className="h-2 w-full rounded-full bg-zinc-800/60" />
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {ALL_STATUSES.map((status) => {
                const active = statusFilter[status]
                return (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    title={active ? 'Remover do total' : 'Incluir no total'}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors',
                      active
                        ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                        : 'border-zinc-800/70 text-zinc-600 hover:border-zinc-700'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        active ? TICKET_STATUS_BAR_COLORS[status] : 'bg-zinc-700'
                      )}
                    />
                    <span className="text-xs">{TICKET_STATUS_LABELS[status]}</span>
                    <span className="text-xs font-medium tabular-nums">{data.statusCounts[status]}</span>
                  </button>
                )
              })}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setAllStatuses(true)}
                  className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  Todos
                </button>
                <button
                  onClick={() => setAllStatuses(false)}
                  className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  Limpar
                </button>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-zinc-700">
              Clique em um status para incluí-lo ou removê-lo do total e dos gráficos.
            </p>
          </CardContent>
        </Card>
      )}

      {visibility.pie && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Distribuição por status</CardTitle>
            <span className="text-xs text-zinc-600 tabular-nums">{selectedTotal} chamados</span>
          </CardHeader>
          <CardContent className="py-5">
            {selectedTotal > 0 ? (
              <DonutChart
                counts={data.statusCounts}
                statuses={selectedStatuses}
                total={selectedTotal}
              />
            ) : (
              <p className="text-[13px] text-zinc-600 py-2">
                Nenhum status selecionado no andamento dos chamados.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {visibility.awaiting && data.awaitingReply.length > 0 && (
        <Card className="border-blue-500/20">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                Aguardando sua resposta
                <span className="text-xs font-normal text-zinc-600">
                  — a última mensagem foi do colaborador
                </span>
              </CardTitle>
              <Link href="/tickets?awaiting=1" className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800/70">
              {data.awaitingReply.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-zinc-200 truncate">{ticket.title}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      <span className="font-mono">{ticket.ticket_number}</span>
                      {' · '}
                      <span className="text-blue-400/80">{ticket.requester_name}</span>
                      {' respondeu em '}
                      {formatDate(ticket.last_comment_at)}
                    </p>
                  </div>
                  <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {visibility.approved && data.newlyApproved.length > 0 && (
        <Card className="border-emerald-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Aprovados — aguardando atendimento
              <span className="text-xs font-normal text-zinc-600">
                — liberados pelo gestor e ainda abertos
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800/70">
              {data.newlyApproved.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-zinc-200 truncate">{ticket.title}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      <span className="font-mono">{ticket.ticket_number}</span>
                      {' · '}
                      {ticket.requester_name}
                      {' · aprovado por '}
                      <span className="text-emerald-400/80">{ticket.approver_name}</span>
                      {' em '}
                      {formatDate(ticket.decided_at)}
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400">Aprovado</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {visibility.scheduled && data.scheduledTickets.length > 0 && (
        <Card className="border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-violet-400" />
              Agenda
              <span className="text-xs font-normal text-zinc-600">
                — chamados agendados, do mais próximo ao mais distante
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800/70">
              {data.scheduledTickets.map((ticket) => {
                const schedule = getScheduleState(ticket.scheduled_for)
                return (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-zinc-200 truncate">{ticket.title}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        <span className="font-mono">{ticket.ticket_number}</span>
                        {' · '}
                        {ticket.requester_name}
                        {' · '}
                        {formatDate(ticket.scheduled_for)}
                        {ticket.assignee_name ? ` · ${ticket.assignee_name}` : ' · sem agente'}
                      </p>
                    </div>
                    <Badge className={schedule.className}>{schedule.label}</Badge>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {visibility.remote && (data.remoteSessionsToday.length > 0 || data.remoteReadyCount > 0) && (
        <Card className="border-violet-500/20">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-violet-400" />
                Sessões remotas
                <span className="text-xs font-normal text-zinc-600">
                  — {data.remoteReadyCount > 0 ? `${data.remoteReadyCount} autorizada(s)` : 'agenda de hoje'}
                </span>
              </CardTitle>
              <Link href="/tickets?remote=today" className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800/70">
              {data.remoteSessionsToday.map((session) => (
                <Link
                  key={session.id}
                  href={`/tickets/${session.ticket_id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-zinc-200 truncate">{session.title}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      <span className="font-mono">{session.ticket_number}</span>
                      {' · '}
                      {session.requester_name}
                      {' · '}
                      {formatDate(session.scheduled_for)}
                    </p>
                  </div>
                  <Badge className={REMOTE_SESSION_STATUS_COLORS[session.status]}>
                    {REMOTE_SESSION_STATUS_LABELS[session.status]}
                  </Badge>
                </Link>
              ))}
              {data.remoteSessionsToday.length === 0 && data.remoteReadyCount > 0 && (
                <Link
                  href="/tickets?remote=ready"
                  className="block px-5 py-4 text-[13px] text-emerald-400 hover:bg-zinc-900/60 transition-colors"
                >
                  {data.remoteReadyCount} sessão(ões) autorizada(s) — entrar agora
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {visibility.warranty && expiringAssets.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Garantias exigindo atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800/70">
              {expiringAssets.map((asset) => {
                const status = getWarrantyStatus(asset.warranty_end_date)
                const days = asset.warranty_end_date ? daysUntil(asset.warranty_end_date) : 0
                return (
                  <Link
                    key={asset.id}
                    href={`/assets/${asset.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                  >
                    <Monitor className="h-4 w-4 text-zinc-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-zinc-200 truncate">{asset.name}</p>
                      <p className="text-xs text-zinc-600 font-mono">{asset.asset_tag}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        className={
                          status === 'expired'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }
                      >
                        {status === 'expired'
                          ? 'Expirada'
                          : `${days} dia${days === 1 ? '' : 's'} restante${days === 1 ? '' : 's'}`}
                      </Badge>
                      <p className="text-[11px] text-zinc-600 mt-1">
                        {asset.warranty_end_date && formatDateShort(asset.warranty_end_date)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {visibility.recent && (
          <div className={visibility.critical ? 'xl:col-span-2' : 'xl:col-span-3'}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Chamados recentes</CardTitle>
                <Link href="/tickets" className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
                  Ver todos
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {data.recentTickets.length > 0 ? (
                  <div className="divide-y divide-zinc-800/70">
                    {data.recentTickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        href={`/tickets/${ticket.id}`}
                        className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-zinc-200 truncate">{ticket.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-zinc-600 font-mono">{ticket.ticket_number}</span>
                            <span className="text-zinc-800">·</span>
                            <span className="text-xs text-zinc-500">{ticket.requester?.full_name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
                            {TICKET_PRIORITY_LABELS[ticket.priority]}
                          </Badge>
                          <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                            {TICKET_STATUS_LABELS[ticket.status]}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-[13px] text-zinc-600">
                    Nenhum chamado registrado.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {visibility.critical && (
          <div className={visibility.recent ? '' : 'xl:col-span-3'}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  Críticos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.criticalTickets.length > 0 ? (
                  <div className="divide-y divide-zinc-800/70">
                    {data.criticalTickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        href={`/tickets/${ticket.id}`}
                        className="block px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                      >
                        <p className="text-[13px] font-medium text-zinc-200 truncate">{ticket.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-zinc-500">{ticket.requester?.full_name}</span>
                          <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                            {TICKET_STATUS_LABELS[ticket.status]}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-zinc-600 mt-1">{formatDate(ticket.created_at)}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-[13px] text-zinc-600">
                    Nenhum chamado crítico.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
