'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'
import type { TicketApproval } from '@/lib/types'
import { Check, X } from 'lucide-react'

export function ApprovalQueue({ approvals, enabled }: { approvals: TicketApproval[]; enabled: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [comments, setComments] = useState<Record<string, string>>({})
  const [working, setWorking] = useState<string | null>(null)

  async function decide(approval: TicketApproval, decision: 'approved' | 'rejected') {
    const comment = comments[approval.id]?.trim() ?? ''
    if (decision === 'rejected' && !comment) {
      toast('Informe o motivo da rejeição', 'error')
      return
    }
    setWorking(approval.id)
    const { error } = await supabase.from('ticket_approvals').update({
      decision,
      comment: comment || null,
      decided_at: new Date().toISOString(),
    }).eq('id', approval.id)
    setWorking(null)
    if (error) return toast('Não foi possível registrar a decisão', 'error')
    toast(decision === 'approved' ? 'Solicitação aprovada' : 'Solicitação rejeitada')
    router.refresh()
  }

  if (!enabled) return <div className="p-6 text-sm text-zinc-500">Você não possui permissão de aprovador.</div>

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Aprovações</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">Solicitações que aguardam sua decisão.</p>
      </div>
      {approvals.length ? approvals.map((approval) => {
        const ticket = approval.ticket!
        const catalogTitle = (ticket as unknown as { catalog_item?: { title: string } }).catalog_item?.title
        return (
          <Card key={approval.id} className={approval.decision === 'pending' ? 'border-cyan-500/20' : ''}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{catalogTitle ?? ticket.title}</CardTitle>
                <p className="mt-1 text-xs text-zinc-600">
                  {ticket.requester?.full_name} · <span className="font-mono">{ticket.ticket_number}</span> · {formatDate(approval.requested_at)}
                </p>
              </div>
              <Badge className={
                approval.decision === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                approval.decision === 'rejected' ? 'bg-red-500/10 text-red-400' :
                'bg-cyan-500/10 text-cyan-400'
              }>{approval.decision === 'approved' ? 'Aprovado' : approval.decision === 'rejected' ? 'Rejeitado' : 'Pendente'}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[13px] text-zinc-300 whitespace-pre-wrap">{ticket.description}</p>
              {ticket.form_responses && Object.keys(ticket.form_responses).length > 0 && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-900/70 p-3">
                  {Object.entries(ticket.form_responses).map(([key, value]) => (
                    <div key={key}><p className="text-[11px] uppercase text-zinc-600">{key.replaceAll('_', ' ')}</p><p className="text-[13px] text-zinc-300">{value}</p></div>
                  ))}
                </div>
              )}
              {approval.decision === 'pending' ? (
                <>
                  <Textarea placeholder="Comentário ou motivo da rejeição..." value={comments[approval.id] ?? ''} onChange={(e) => setComments({ ...comments, [approval.id]: e.target.value })} rows={3} />
                  <div className="flex gap-2">
                    <Button loading={working === approval.id} onClick={() => decide(approval, 'approved')}><Check className="h-4 w-4" />Aprovar</Button>
                    <Button loading={working === approval.id} variant="danger" onClick={() => decide(approval, 'rejected')}><X className="h-4 w-4" />Rejeitar</Button>
                  </div>
                </>
              ) : approval.comment ? <p className="text-xs text-zinc-500">Comentário: {approval.comment}</p> : null}
            </CardContent>
          </Card>
        )
      }) : <Card><CardContent className="py-10 text-center text-sm text-zinc-600">Nenhuma aprovação atribuída a você.</CardContent></Card>}
    </div>
  )
}
