import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TICKET_AREA_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  formatDate,
} from '@/lib/utils'
import type { TicketArea, TicketPriority, TicketStatus, TicketType } from '@/lib/types'

export type StatusEvent = {
  id: string
  event_type: string
  from_status: TicketStatus | null
  to_status: TicketStatus | null
  metadata: Record<string, string | null> | null
  created_at: string
  actor: { full_name: string } | null
}

const DOT_COLOR: Record<string, string> = {
  status_change: 'bg-zinc-600',
  priority_change: 'bg-amber-500/70',
  assignee_change: 'bg-sky-500/70',
  type_change: 'bg-zinc-600',
  area_change: 'bg-zinc-600',
  approver_change: 'bg-cyan-500/70',
  approval_decision: 'bg-emerald-500/70',
  team_change: 'bg-sky-500/70',
  automation: 'bg-violet-500/70',
  sla_escalation: 'bg-orange-500/70',
}

/** Sem valor (campo que estava vazio) fica explícito, em vez de virar espaço em branco. */
function ou(value: string | null | undefined, fallback = 'ninguém') {
  return value && value.trim() ? value : fallback
}

function describe(event: StatusEvent): string {
  const meta = event.metadata ?? {}

  switch (event.event_type) {
    case 'status_change':
      return event.from_status
        ? `${TICKET_STATUS_LABELS[event.from_status]} → ${TICKET_STATUS_LABELS[event.to_status as TicketStatus]}`
        : TICKET_STATUS_LABELS[event.to_status as TicketStatus]

    case 'priority_change':
      return `Prioridade: ${TICKET_PRIORITY_LABELS[meta.de as TicketPriority] ?? '—'} → ${
        TICKET_PRIORITY_LABELS[meta.para as TicketPriority] ?? '—'
      }`

    case 'type_change':
      return `Tipo: ${TICKET_TYPE_LABELS[meta.de as TicketType] ?? '—'} → ${
        TICKET_TYPE_LABELS[meta.para as TicketType] ?? '—'
      }`

    case 'area_change':
      return `Área: ${meta.de ? TICKET_AREA_LABELS[meta.de as TicketArea] : 'sem área'} → ${
        meta.para ? TICKET_AREA_LABELS[meta.para as TicketArea] : 'sem área'
      }`

    case 'assignee_change':
      return `Atendente: ${ou(meta.de, 'não atribuído')} → ${ou(meta.para, 'não atribuído')}`

    case 'approver_change':
      return `Aprovador: ${ou(meta.de)} → ${ou(meta.para)}`

    case 'team_change':
      return `Fila: ${ou(meta.de, 'sem fila')} → ${ou(meta.para, 'sem fila')}`

    case 'automation':
      return `Automação: ${ou(meta.regra, 'regra removida')}`

    case 'sla_escalation':
      return `Escalonado: prazo passou de ${meta.percentual ?? '—'}%`

    case 'approval_decision':
      return `${meta.decisao === 'approved' ? 'Aprovado' : 'Rejeitado'} por ${ou(meta.por, 'aprovador')}`

    default:
      return event.event_type
  }
}

export function TicketStatusTimeline({ events }: { events: StatusEvent[] }) {
  if (events.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex gap-3">
            <div
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                DOT_COLOR[event.event_type] ?? 'bg-zinc-600'
              }`}
            />
            <div className="min-w-0">
              <p className="text-[13px] text-zinc-300">{describe(event)}</p>
              {event.event_type === 'approval_decision' && event.metadata?.comentario && (
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  “{event.metadata.comentario}”
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-zinc-600">
                {event.actor?.full_name ?? 'Sistema'} · {formatDate(event.created_at)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
