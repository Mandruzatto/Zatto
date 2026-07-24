import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS, ASSET_TYPE_LABELS, ASSET_STATUS_COLORS,
  formatDate
} from '@/lib/utils'
import { Monitor, User, Calendar, Tag } from 'lucide-react'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      *,
      requester:profiles!requester_id(*),
      assignee:profiles!assignee_id(*)
    `)
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const { data: ticketAssets } = await supabase
    .from('ticket_assets')
    .select('asset:assets(*)')
    .eq('ticket_id', id)

  const { data: requesterAssets } = await supabase
    .from('asset_assignments')
    .select('asset:assets(*)')
    .eq('user_id', ticket.requester_id)
    .is('returned_at', null)

  const { data: comments } = await supabase
    .from('ticket_comments')
    .select('*, author:profiles!author_id(full_name, role)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500 font-mono">{ticket.ticket_number}</span>
            <Badge className={TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS]}>
              {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS]}
            </Badge>
            <Badge className={TICKET_PRIORITY_COLORS[ticket.priority as keyof typeof TICKET_PRIORITY_COLORS]}>
              {TICKET_PRIORITY_LABELS[ticket.priority as keyof typeof TICKET_PRIORITY_LABELS]}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          <Card>
            <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Equipamentos do Solicitante</CardTitle></CardHeader>
            <CardContent className="p-0">
              {requesterAssets && requesterAssets.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {requesterAssets.map((ra) => {
                    const asset = ra.asset as any
                    return (
                      <div key={asset.id} className="flex items-center gap-3 px-6 py-3">
                        <Monitor className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{asset.name}</p>
                          <p className="text-xs text-gray-500">{asset.asset_tag} · {ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS]}</p>
                        </div>
                        <Badge className={ASSET_STATUS_COLORS[asset.status as keyof typeof ASSET_STATUS_COLORS]}>
                          {asset.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-6 py-6 text-sm text-gray-400 text-center">
                  Nenhum equipamento sob responsabilidade.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Comentários ({comments?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {comments && comments.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className={`px-6 py-4 ${comment.is_internal ? 'bg-amber-50' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{comment.author?.full_name}</span>
                        {comment.is_internal && (
                          <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">Interno</span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-6 text-sm text-gray-400 text-center">Nenhum comentário ainda.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Solicitante</p>
                  <p className="text-sm font-medium text-gray-900">{(ticket.requester as any)?.full_name}</p>
                  {(ticket.requester as any)?.department && (
                    <p className="text-xs text-gray-400">{(ticket.requester as any).department}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Atribuído a</p>
                  <p className="text-sm font-medium text-gray-900">
                    {(ticket.assignee as any)?.full_name ?? <span className="text-gray-400 italic">Não atribuído</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Categoria</p>
                  <p className="text-sm font-medium text-gray-900">{TICKET_CATEGORY_LABELS[ticket.category as keyof typeof TICKET_CATEGORY_LABELS]}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Criado em</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(ticket.created_at)}</p>
                </div>
              </div>

              {ticket.resolved_at && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Resolvido em</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(ticket.resolved_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {ticketAssets && ticketAssets.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Ativos Vinculados</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-4">
                {ticketAssets.map((ta) => {
                  const asset = ta.asset as any
                  return (
                    <div key={asset.id} className="flex items-center gap-2 text-sm">
                      <Monitor className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-gray-700">{asset.name}</span>
                      <span className="text-gray-400 text-xs ml-auto">{asset.asset_tag}</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
