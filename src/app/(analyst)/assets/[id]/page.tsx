import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS, TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  getWarrantyStatus, WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS, daysUntil,
  formatDate, formatDateShort
} from '@/lib/utils'
import { User, Ticket, ShieldCheck, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { TicketStatus, WarrantyStatus } from '@/lib/types'

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const { data: asset } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single()

  if (!asset) notFound()

  const { data: assignments } = await supabase
    .from('asset_assignments')
    .select('*, user:profiles!user_id(id, full_name, email, department)')
    .eq('asset_id', id)
    .order('assigned_at', { ascending: false })

  const currentAssignment = assignments?.find((a) => !a.returned_at)

  const { data: ticketAssets } = await supabase
    .from('ticket_assets')
    .select('ticket:tickets(id, ticket_number, title, status, created_at)')
    .eq('asset_id', id)

  const warranty = getWarrantyStatus(asset.warranty_end_date)
  const warrantyDays = asset.warranty_end_date ? daysUntil(asset.warranty_end_date) : null

  type AssignmentRow = {
    id: string
    assigned_at: string
    returned_at: string | null
    user: { id: string; full_name: string; email: string; department?: string } | null
  }
  type TicketRow = {
    id: string
    ticket_number: string
    title: string
    status: TicketStatus
    created_at: string
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <Link href="/assets" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Inventário
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] text-zinc-600 font-mono">{asset.asset_tag}</span>
          <Badge className={ASSET_STATUS_COLORS[asset.status as keyof typeof ASSET_STATUS_COLORS]}>
            {ASSET_STATUS_LABELS[asset.status as keyof typeof ASSET_STATUS_LABELS]}
          </Badge>
          <Badge className={WARRANTY_STATUS_COLORS[warranty as WarrantyStatus]}>
            {WARRANTY_STATUS_LABELS[warranty as WarrantyStatus]}
          </Badge>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{asset.name}</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">
          {ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS]}
          {asset.brand && ` · ${asset.brand}`}
          {asset.model && ` ${asset.model}`}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <Card>
            <CardHeader><CardTitle>Informações do ativo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-600">Número de série</p>
                <p className="text-[13px] font-medium text-zinc-200 mt-0.5 font-mono">
                  {asset.serial_number ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-600">Data de aquisição</p>
                <p className="text-[13px] font-medium text-zinc-200 mt-0.5">
                  {asset.purchase_date ? formatDateShort(asset.purchase_date) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-600">Fim da garantia</p>
                <p className="text-[13px] font-medium text-zinc-200 mt-0.5">
                  {asset.warranty_end_date ? formatDateShort(asset.warranty_end_date) : 'Sem garantia registrada'}
                </p>
              </div>
              {warrantyDays !== null && warrantyDays > 0 && (
                <div>
                  <p className="text-xs text-zinc-600">Tempo restante</p>
                  <p className="text-[13px] font-medium text-zinc-200 mt-0.5">
                    {warrantyDays} dia{warrantyDays === 1 ? '' : 's'}
                  </p>
                </div>
              )}
              {asset.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-600">Observações</p>
                  <p className="text-[13px] text-zinc-300 mt-0.5 whitespace-pre-wrap">{asset.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico de atribuições</CardTitle></CardHeader>
            <CardContent className="p-0">
              {assignments && assignments.length > 0 ? (
                <div className="divide-y divide-zinc-800/70">
                  {(assignments as unknown as AssignmentRow[]).map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                      <User className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-zinc-200">{a.user?.full_name}</p>
                        {a.user?.department && <p className="text-xs text-zinc-600">{a.user.department}</p>}
                        <p className="text-xs text-zinc-600 mt-1">
                          {formatDate(a.assigned_at)}
                          {a.returned_at ? ` → ${formatDate(a.returned_at)}` : ' → atual'}
                        </p>
                      </div>
                      {!a.returned_at && (
                        <Badge className="bg-emerald-500/10 text-emerald-400">Atual</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-6 text-[13px] text-zinc-600 text-center">Sem atribuições.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Responsável atual</CardTitle></CardHeader>
            <CardContent>
              {currentAssignment ? (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">
                      {(currentAssignment as unknown as AssignmentRow).user?.full_name}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {(currentAssignment as unknown as AssignmentRow).user?.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-zinc-600">Sem responsável atribuído.</p>
              )}
            </CardContent>
          </Card>

          {warranty !== 'none' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-zinc-500" />
                  Garantia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={WARRANTY_STATUS_COLORS[warranty as WarrantyStatus]}>
                  {WARRANTY_STATUS_LABELS[warranty as WarrantyStatus]}
                </Badge>
                <p className="text-xs text-zinc-500 mt-2.5">
                  {warranty === 'expired'
                    ? `Expirou em ${formatDateShort(asset.warranty_end_date)}`
                    : `Válida até ${formatDateShort(asset.warranty_end_date)}`}
                </p>
              </CardContent>
            </Card>
          )}

          {ticketAssets && ticketAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-zinc-500" />
                  Chamados relacionados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-800/70">
                  {ticketAssets.map((ta) => {
                    const ticket = ta.ticket as unknown as TicketRow
                    return (
                      <Link
                        key={ticket.id}
                        href={`/tickets/${ticket.id}`}
                        className="block px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                      >
                        <p className="text-[13px] font-medium text-zinc-200 truncate">{ticket.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-zinc-600 font-mono">{ticket.ticket_number}</span>
                          <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                            {TICKET_STATUS_LABELS[ticket.status]}
                          </Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
