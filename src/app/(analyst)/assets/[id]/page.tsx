import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS, TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  formatDate, formatDateShort
} from '@/lib/utils'
import { User, Tag, Calendar, Ticket } from 'lucide-react'
import Link from 'next/link'

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

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500 font-mono">{asset.asset_tag}</span>
            <Badge className={ASSET_STATUS_COLORS[asset.status as keyof typeof ASSET_STATUS_COLORS]}>
              {ASSET_STATUS_LABELS[asset.status as keyof typeof ASSET_STATUS_LABELS]}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{asset.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS]}
            {asset.brand && ` · ${asset.brand}`}
            {asset.model && ` ${asset.model}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          <Card>
            <CardHeader><CardTitle>Informações do Ativo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Número de série</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5 font-mono">
                  {asset.serial_number ?? <span className="text-gray-400 font-sans">—</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Data de aquisição</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {asset.purchase_date ? formatDateShort(asset.purchase_date) : <span className="text-gray-400">—</span>}
                </p>
              </div>
              {asset.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Observações</p>
                  <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{asset.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico de Atribuições</CardTitle></CardHeader>
            <CardContent className="p-0">
              {assignments && assignments.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {assignments.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3 px-6 py-4">
                      <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{a.user?.full_name}</p>
                        <p className="text-xs text-gray-500">{a.user?.department}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(a.assigned_at)}
                          {a.returned_at ? ` → ${formatDate(a.returned_at)}` : ' → atual'}
                        </p>
                      </div>
                      {!a.returned_at && (
                        <Badge className="bg-green-100 text-green-800">Atual</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-6 text-sm text-gray-400 text-center">Sem atribuições.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Responsável Atual</CardTitle></CardHeader>
            <CardContent>
              {currentAssignment ? (
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{(currentAssignment.user as any)?.full_name}</p>
                    <p className="text-xs text-gray-500">{(currentAssignment.user as any)?.department}</p>
                    <p className="text-xs text-gray-400 mt-1">{(currentAssignment.user as any)?.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Sem responsável atribuído.</p>
              )}
            </CardContent>
          </Card>

          {ticketAssets && ticketAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  Chamados Relacionados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {ticketAssets.map((ta) => {
                    const ticket = ta.ticket as any
                    return (
                      <Link
                        key={ticket.id}
                        href={`/tickets/${ticket.id}`}
                        className="block px-6 py-3 hover:bg-gray-50"
                      >
                        <p className="text-sm font-medium text-gray-900">{ticket.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">{ticket.ticket_number}</span>
                          <Badge className={TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS]}>
                            {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS]}
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
