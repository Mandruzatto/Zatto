'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TICKET_PRIORITY_LABELS, TICKET_CATEGORY_LABELS } from '@/lib/utils'
import type { TicketPriority, TicketCategory } from '@/lib/types'
import { CheckCircle } from 'lucide-react'

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
    category: 'other' as TicketCategory,
  })

  const priorityOptions = Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))
  const categoryOptions = Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))

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
        category: form.category,
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
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900">Chamado aberto!</h2>
            <p className="text-gray-500 text-sm">
              Seu chamado <span className="font-mono font-semibold text-gray-700">{ticketNumber}</span> foi registrado.
              Nossa equipe entrará em contato em breve.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => router.push('/my-tickets')}>
                Ver meus chamados
              </Button>
              <Button onClick={() => {
                setSuccess(false)
                setForm({ title: '', description: '', priority: 'medium', category: 'other' })
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
        <h1 className="text-xl font-bold text-gray-900">Abrir Chamado</h1>
        <p className="text-sm text-gray-500 mt-0.5">Descreva o problema e nossa equipe irá atendê-lo.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Assunto"
              placeholder="Ex: Notebook não liga"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Categoria"
                options={categoryOptions}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TicketCategory })}
              />
              <Select
                label="Prioridade"
                options={priorityOptions}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
              />
            </div>

            <Textarea
              label="Descrição"
              placeholder="Descreva o problema com o máximo de detalhes..."
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              hint="Inclua quando o problema começou e o que você já tentou fazer."
            />

            <div className="flex gap-3 pt-2">
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
