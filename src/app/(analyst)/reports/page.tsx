import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  formatDateShort,
} from '@/lib/utils'
import type { TicketPriority, TicketStatus, TicketType } from '@/lib/types'

const ACTIVE = ['open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled']

type Row = {
  status: TicketStatus
  priority: TicketPriority
  type: TicketType
  created_at: string
  resolved_at: string | null
  resolution_due_at: string | null
}

function hoursBetween(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000
}

function formatHours(value: number) {
  if (value < 1) return `${Math.round(value * 60)} min`
  if (value < 48) return `${value.toFixed(1)} h`
  return `${(value / 24).toFixed(1)} dias`
}

/** Barra simples: uma tela de relatório não justifica biblioteca de gráfico. */
function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-500">
          {value} <span className="text-zinc-700">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-[13px] text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-zinc-600">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const [{ data: tickets }, { data: ratings }] = await Promise.all([
    supabase
      .from('tickets')
      .select('status, priority, type, created_at, resolved_at, resolution_due_at'),
    supabase.from('ticket_satisfaction').select('rating'),
  ])

  const rows = (tickets ?? []) as Row[]
  const total = rows.length
  const finalized = rows.filter((row) => row.status === 'finalized' && row.resolved_at)
  const active = rows.filter((row) => ACTIVE.includes(row.status))

  // SLA só faz sentido sobre chamados que fecharam e tinham prazo definido.
  const withDeadline = finalized.filter((row) => row.resolution_due_at)
  const onTime = withDeadline.filter((row) => row.resolved_at! <= row.resolution_due_at!)
  const slaRate = withDeadline.length
    ? Math.round((onTime.length / withDeadline.length) * 100)
    : null

  const resolutionHours = finalized.map((row) => hoursBetween(row.created_at, row.resolved_at!))
  const avgResolution = resolutionHours.length
    ? resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length
    : null

  // Data, não duração: calcular "há quanto tempo" exigiria ler o relógio durante
  // a renderização, o que o React trata como impuro.
  const oldestOpen = active.length
    ? active.reduce((min, row) => (row.created_at < min ? row.created_at : min), active[0].created_at)
    : null

  const notes = (ratings ?? []).map((row) => row.rating as number)
  const csat = notes.length ? notes.reduce((sum, value) => sum + value, 0) / notes.length : null

  const byStatus = Object.keys(TICKET_STATUS_LABELS).map((status) => ({
    label: TICKET_STATUS_LABELS[status as TicketStatus],
    value: rows.filter((row) => row.status === status).length,
  }))
  const byPriority = Object.keys(TICKET_PRIORITY_LABELS).map((priority) => ({
    label: TICKET_PRIORITY_LABELS[priority as TicketPriority],
    value: rows.filter((row) => row.priority === priority).length,
  }))
  const byType = Object.keys(TICKET_TYPE_LABELS).map((type) => ({
    label: TICKET_TYPE_LABELS[type as TicketType],
    value: rows.filter((row) => row.type === type).length,
  }))

  return (
    <div className="max-w-5xl space-y-5 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Relatórios</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          {total} chamado(s) registrado(s).
        </p>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-[13px] font-medium text-zinc-400">Ainda sem dados</p>
            <p className="mt-1 text-[13px] text-zinc-600">
              Os números aparecem conforme os chamados forem sendo atendidos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="SLA cumprido"
              value={slaRate === null ? '—' : `${slaRate}%`}
              hint={
                withDeadline.length
                  ? `${onTime.length} de ${withDeadline.length} finalizados no prazo`
                  : 'Nenhum finalizado com prazo definido'
              }
            />
            <Stat
              label="Tempo médio de resolução"
              value={avgResolution === null ? '—' : formatHours(avgResolution)}
              hint={`${finalized.length} finalizado(s)`}
            />
            <Stat
              label="Aberto há mais tempo"
              value={oldestOpen === null ? '—' : formatDateShort(oldestOpen)}
              hint={`${active.length} em aberto`}
            />
            <Stat
              label="Satisfação"
              value={csat === null ? '—' : `${csat.toFixed(1)} / 5`}
              hint={notes.length ? `${notes.length} avaliação(ões)` : 'Sem avaliações ainda'}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Por status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {byStatus.map((item) => (
                  <Bar key={item.label} label={item.label} value={item.value} total={total} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Por prioridade</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {byPriority.map((item) => (
                  <Bar key={item.label} label={item.label} value={item.value} total={total} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Por tipo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {byType.map((item) => (
                  <Bar key={item.label} label={item.label} value={item.value} total={total} />
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
