'use client'

import { Download } from 'lucide-react'
import {
  TICKET_AREA_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  getSlaState,
} from '@/lib/utils'
import type { TicketArea, TicketPriority, TicketStatus, TicketType } from '@/lib/types'

export type ExportableTicket = {
  ticket_number: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  type: TicketType
  area?: TicketArea | null
  resolution_due_at?: string | null
  resolved_at?: string | null
  created_at: string
  requester_name: string
  assignee_name: string
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function ExportTicketsCsv({ tickets }: { tickets: ExportableTicket[] }) {
  function download() {
    const header = [
      'Número',
      'Título',
      'Solicitante',
      'Tipo',
      'Área',
      'Prioridade',
      'Status',
      'SLA',
      'Agente',
      'Criado em',
    ]
    const rows = tickets.map((ticket) => {
      const sla = getSlaState(ticket.resolution_due_at, ticket.resolved_at)
      return [
        ticket.ticket_number,
        ticket.title,
        ticket.requester_name,
        TICKET_TYPE_LABELS[ticket.type],
        ticket.area ? TICKET_AREA_LABELS[ticket.area] : '',
        TICKET_PRIORITY_LABELS[ticket.priority],
        TICKET_STATUS_LABELS[ticket.status],
        sla.label,
        ticket.assignee_name,
        new Date(ticket.created_at).toLocaleString('pt-BR'),
      ].map((cell) => csvEscape(String(cell ?? '')))
    })

    const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `chamados-${stamp}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={tickets.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-40"
    >
      <Download className="h-4 w-4" />
      Exportar CSV
    </button>
  )
}
