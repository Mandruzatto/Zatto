'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import type { ServiceCatalogItem, TicketPriority, TicketType } from '@/lib/types'
import { ArrowLeft, CheckCircle, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export function CatalogTicketForm({ item }: { item: ServiceCatalogItem }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [responses, setResponses] = useState<Record<string, string>>({})

  const ticketType: TicketType = item.slug.includes('incidente') ? 'incident' : 'request'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const missing = item.form_schema.find((field) => field.required && !responses[field.key]?.trim())
    if (missing) {
      toast(`Preencha o campo “${missing.label}”`, 'error')
      setLoading(false)
      return
    }

    const subject =
      responses.subject?.trim() ||
      responses.details?.trim()?.slice(0, 80) ||
      item.title

    const { data, error } = await supabase.from('tickets').insert({
      requester_id: user.id,
      title: subject,
      description: description.trim() || responses.details?.trim() || item.description,
      type: ticketType,
      area: item.area ?? null,
      priority: (item.default_priority ?? 'medium') as TicketPriority,
      catalog_item_id: item.id,
      form_responses: responses,
    }).select('ticket_number').single()

    setLoading(false)
    if (error) {
      toast(error.message || 'Não foi possível abrir o chamado', 'error')
      return
    }
    setCreated(data.ticket_number)
    toast('Chamado aberto')
  }

  if (created) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card><CardContent className="py-12 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-emerald-400" />
          <h1 className="mt-3 text-base font-semibold text-zinc-100">Solicitação registrada</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            O chamado <span className="font-mono text-zinc-300">{created}</span> foi criado.
            {item.requires_approval && ' Ele seguirá para aprovação do seu gestor.'}
          </p>
          <Button className="mt-5" onClick={() => router.push('/portal')}>Voltar ao início</Button>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <Link href="/new-ticket" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Catálogo
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">{item.title}</h1>
        <p className="mt-1 text-[13px] text-zinc-500">{item.instructions ?? item.description}</p>
      </div>
      {item.requires_approval && (
        <div className="flex gap-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3.5 py-3 text-[13px] text-cyan-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Esta solicitação precisa da aprovação do seu gestor antes do atendimento.
        </div>
      )}
      <Card><CardContent className="pt-5">
        <form onSubmit={submit} className="space-y-4">
          {item.form_schema.map((field) => {
            const props = {
              label: field.label,
              value: responses[field.key] ?? '',
              required: field.required,
              placeholder: field.placeholder,
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                setResponses({ ...responses, [field.key]: e.target.value }),
            }
            if (field.type === 'textarea') return <Textarea key={field.key} {...props} rows={4} />
            if (field.type === 'select') {
              return <Select key={field.key} {...props} options={(field.options ?? []).map((value) => ({ value, label: value }))} placeholder="Selecione..." />
            }
            return <Input key={field.key} {...props} />
          })}
          <Textarea
            label="Informações adicionais"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <div className="flex gap-3">
            <Button type="submit" loading={loading}>Enviar solicitação</Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/new-ticket')}>Cancelar</Button>
          </div>
        </form>
      </CardContent></Card>
    </div>
  )
}
