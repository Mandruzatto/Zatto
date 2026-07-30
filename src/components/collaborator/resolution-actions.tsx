'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'

export function CollaboratorResolutionActions({
  ticketId,
  status,
}: {
  ticketId: string
  status: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  if (status !== 'finalized') return null

  async function reopen() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'open',
        resolution: null,
        resolved_at: null,
      })
      .eq('id', ticketId)

    if (error) {
      setLoading(false)
      toast(error.message || 'Não foi possível reabrir o chamado', 'error')
      return
    }

    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author_id: user.id,
      content: 'Reabri o chamado: a resolução ainda não atendeu o que eu precisava.',
      is_internal: false,
    })

    setLoading(false)
    toast('Chamado reaberto. O suporte foi notificado.')
    router.refresh()
  }

  return (
    <Card className="border-zinc-700/60 bg-zinc-900/40">
      <CardHeader>
        <CardTitle>Este chamado foi finalizado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] text-zinc-400">
          Se o problema ainda não foi solucionado, você pode reabrir o chamado.
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={loading}
          disabled={loading}
          onClick={reopen}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Ainda não resolvido
        </Button>
      </CardContent>
    </Card>
  )
}
