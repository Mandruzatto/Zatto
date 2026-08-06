'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { TicketSatisfaction } from '@/lib/types'

const RATING_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente',
}

export function SatisfactionSurvey({
  ticketId,
  currentUserId,
  status,
  satisfaction,
}: {
  ticketId: string
  currentUserId: string
  status: string
  satisfaction?: TicketSatisfaction | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [rating, setRating] = useState(satisfaction?.rating ?? 0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState(satisfaction?.comment ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  if (status !== 'finalized') return null

  const answered = Boolean(satisfaction) && !editing
  const shown = hovered || rating

  async function submit() {
    if (!rating) return toast('Escolha uma nota de 1 a 5', 'error')
    setSaving(true)

    const { error } = await supabase.from('ticket_satisfaction').upsert({
      ticket_id: ticketId,
      respondent_id: currentUserId,
      rating,
      comment: comment.trim() || null,
    }, { onConflict: 'ticket_id' })

    setSaving(false)
    if (error) return toast(error.message || 'Não foi possível enviar sua avaliação', 'error')

    setEditing(false)
    toast('Obrigado pela avaliação!')
    router.refresh()
  }

  if (answered) {
    return (
      <Card className="border-zinc-700/60 bg-zinc-900/40">
        <CardHeader><CardTitle>Sua avaliação</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  className={cn(
                    'h-4 w-4',
                    value <= (satisfaction?.rating ?? 0)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-zinc-700'
                  )}
                />
              ))}
            </div>
            <span className="text-[13px] text-zinc-400">
              {RATING_LABELS[satisfaction?.rating ?? 0]}
            </span>
          </div>
          {satisfaction?.comment && (
            <p className="text-[13px] text-zinc-400 whitespace-pre-wrap">{satisfaction.comment}</p>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Alterar avaliação
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-500/20">
      <CardHeader><CardTitle>Como foi o atendimento?</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] text-zinc-400">
          Sua avaliação ajuda a equipe de TI a melhorar o suporte.
        </p>

        <div className="flex items-center gap-2">
          <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} de 5 — ${RATING_LABELS[value]}`}
                onMouseEnter={() => setHovered(value)}
                onFocus={() => setHovered(value)}
                onBlur={() => setHovered(0)}
                onClick={() => setRating(value)}
                className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                <Star
                  className={cn(
                    'h-6 w-6 transition-colors',
                    value <= shown ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'
                  )}
                />
              </button>
            ))}
          </div>
          {shown > 0 && <span className="text-[13px] text-zinc-400">{RATING_LABELS[shown]}</span>}
        </div>

        <Textarea
          label="Comentário (opcional)"
          rows={3}
          placeholder="Conte o que funcionou bem ou o que pode melhorar..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="flex gap-2">
          <Button type="button" size="sm" loading={saving} disabled={!rating} onClick={submit}>
            Enviar avaliação
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
