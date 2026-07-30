import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TICKET_STATUS_LABELS, formatDate } from '@/lib/utils'
import type { TicketStatus } from '@/lib/types'

export type StatusEvent = {
  id: string
  from_status: TicketStatus | null
  to_status: TicketStatus | null
  created_at: string
  actor: { full_name: string } | null
}

export function TicketStatusTimeline({ events }: { events: StatusEvent[] }) {
  if (events.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-600" />
            <div className="min-w-0">
              <p className="text-[13px] text-zinc-300">
                {event.from_status
                  ? `${TICKET_STATUS_LABELS[event.from_status]} → ${TICKET_STATUS_LABELS[event.to_status as TicketStatus]}`
                  : TICKET_STATUS_LABELS[event.to_status as TicketStatus]}
              </p>
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
