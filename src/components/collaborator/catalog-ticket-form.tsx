'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import type { ServiceCatalogItem, TicketPriority, TicketType } from '@/lib/types'
import { ArrowLeft, CheckCircle, Paperclip, ShieldCheck, X } from 'lucide-react'
import Link from 'next/link'

const MAX_FILES = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120)
}

export function CatalogTicketForm({ item }: { item: ServiceCatalogItem }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [responses, setResponses] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])

  const ticketType: TicketType = item.default_type ?? 'request'

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

    // Titles stay recognisable in the queue: the catalog item, qualified by the
    // first choice the requester made.
    const choice = item.form_schema.find(
      (field) => field.type === 'select' && responses[field.key]?.trim()
    )
    const subject =
      responses.subject?.trim() ||
      (choice ? `${item.title} — ${responses[choice.key].trim()}` : item.title)

    const { data, error } = await supabase.from('tickets').insert({
      requester_id: user.id,
      title: subject,
      description: description.trim() || responses.details?.trim() || item.description,
      type: ticketType,
      area: item.area ?? null,
      priority: (item.default_priority ?? 'medium') as TicketPriority,
      catalog_item_id: item.id,
      form_responses: responses,
    }).select('id, ticket_number').single()

    if (error || !data) {
      setLoading(false)
      toast(error?.message || 'Não foi possível abrir o chamado', 'error')
      return
    }

    // O anexo pertence a uma mensagem, então a abertura com arquivo cria a
    // primeira mensagem do chamado carregando os arquivos.
    if (files.length > 0) {
      const { data: comment } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: data.id,
          author_id: user.id,
          content: 'Anexos enviados na abertura do chamado.',
          is_internal: false,
        })
        .select('id')
        .single()

      if (comment) {
        for (const file of files) {
          const path = `${data.id}/${comment.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
          const { error: uploadError } = await supabase.storage
            .from('ticket-attachments')
            .upload(path, file, {
              contentType: file.type || 'application/octet-stream',
              upsert: false,
            })

          if (uploadError) {
            toast(`Falha ao anexar ${file.name}`, 'error')
            continue
          }

          await supabase.from('ticket_comment_attachments').insert({
            comment_id: comment.id,
            ticket_id: data.id,
            uploaded_by: user.id,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
          })
        }
      }
    }

    setLoading(false)
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
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              onChange={(e) => {
                const list = e.target.files
                if (list) {
                  const next = [...files]
                  for (const file of Array.from(list)) {
                    if (next.length >= MAX_FILES) {
                      toast(`Máximo de ${MAX_FILES} arquivos`, 'error')
                      break
                    }
                    if (file.size > MAX_FILE_BYTES) {
                      toast(`${file.name} ultrapassa 10 MB`, 'error')
                      continue
                    }
                    next.push(file)
                  }
                  setFiles(next)
                }
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Anexar print ou arquivo
            </button>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {files.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                  >
                    {file.name}
                    <span className="text-zinc-600">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      aria-label={`Remover ${file.name}`}
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="text-zinc-600 hover:text-zinc-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={loading}>Enviar solicitação</Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/new-ticket')}>Cancelar</Button>
          </div>
        </form>
      </CardContent></Card>
    </div>
  )
}
