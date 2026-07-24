'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { TICKET_PRIORITY_LABELS, cn } from '@/lib/utils'
import type { TicketPriority, TicketType } from '@/lib/types'
import { CheckCircle, AlertTriangle, FilePlus } from 'lucide-react'

export default function NewTicketPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ticketNumber, setTicketNumber] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
    type: 'incident' as TicketType,
  })

  const priorityOptions = Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        title: form.title,
        description: form.description,
        priority: form.priority,
        type: form.type,
        requester_id: user.id,
      })
      .select('ticket_number')
      .single()

    if (!error && data) {
      setTicketNumber(data.ticket_number)
      setSuccess(true)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="p-6 max-w-lg">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
            <h2 className="text-base font-semibold text-zinc-100">Chamado aberto!</h2>
            <p className="text-zinc-500 text-[13px]">
              Seu chamado <span className="font-mono font-semibold text-zinc-300">{ticketNumber}</span> foi registrado.
              Nossa equipe entrará em contato em breve.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => router.push('/my-tickets')}>
                Ver meus chamados
              </Button>
              <Button onClick={() => {
                setSuccess(false)
                setForm({ title: '', description: '', priority: 'medium', type: 'incident' })
              }}>
                Abrir outro
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Abrir Chamado</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">Descreva o problema e nossa equipe irá atendê-lo.</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="block text-[13px] font-medium text-zinc-400 mb-1.5">O que você precisa?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'incident' })}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-colors',
                    form.type === 'incident'
                      ? 'border-rose-500/40 bg-rose-500/[0.06]'
                      : 'border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <AlertTriangle className={cn('h-4 w-4', form.type === 'incident' ? 'text-rose-400' : 'text-zinc-600')} />
                  <span className="text-[13px] font-medium text-zinc-200">Incidente</span>
                  <span className="text-xs text-zinc-500">Algo parou de funcionar ou está com problema</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'request' })}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-colors',
                    form.type === 'request'
                      ? 'border-sky-500/40 bg-sky-500/[0.06]'
                      : 'border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <FilePlus className={cn('h-4 w-4', form.type === 'request' ? 'text-sky-400' : 'text-zinc-600')} />
                  <span className="text-[13px] font-medium text-zinc-200">Solicitação</span>
                  <span className="text-xs text-zinc-500">Preciso de um acesso, equipamento ou serviço</span>
                </button>
              </div>
            </div>

            <Input
              label="Assunto"
              placeholder={form.type === 'incident' ? 'Ex: Notebook não liga' : 'Ex: Acesso ao sistema financeiro'}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />

            <Select
              label="Prioridade"
              options={priorityOptions}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
            />

            <Textarea
              label="Descrição"
              placeholder="Descreva com o máximo de detalhes..."
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              hint="Inclua quando o problema começou e o que você já tentou fazer."
            />

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={loading}>
                Abrir Chamado
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
