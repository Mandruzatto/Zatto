'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Paperclip,
  Send,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { cn, formatDate } from '@/lib/utils'
import type { TicketCommentAttachment } from '@/lib/types'

export type ChatMessage = {
  id: string
  content: string
  is_internal: boolean
  created_at: string
  author: { full_name: string; role?: string } | null
  attachments: (TicketCommentAttachment & { url?: string | null })[]
}

const MAX_FILES = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mime: string) {
  return mime.startsWith('image/')
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120)
}

export function TicketChat({
  ticketId,
  messages,
  mode,
  closed = false,
}: {
  ticketId: string
  messages: ChatMessage[]
  mode: 'analyst' | 'collaborator'
  closed?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)

  const canSend = content.trim().length > 0 || files.length > 0
  const title = mode === 'analyst' ? 'Conversa' : 'Atualizações'

  function addFiles(list: FileList | null) {
    if (!list) return
    const next = [...files]
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        toast(`Máximo de ${MAX_FILES} arquivos por mensagem`, 'error')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend || closed) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSending(false)
      return
    }

    const body = content.trim()
    const { data: comment, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        author_id: user.id,
        content: body || (files.length ? '(anexo)' : ''),
        is_internal: mode === 'analyst' ? isInternal : false,
      })
      .select('id')
      .single()

    if (error || !comment) {
      setSending(false)
      toast(error?.message || 'Não foi possível enviar a mensagem', 'error')
      return
    }

    for (const file of files) {
      const path = `${ticketId}/${comment.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })

      if (uploadError) {
        toast(`Falha ao anexar ${file.name}`, 'error')
        continue
      }

      const { error: metaError } = await supabase.from('ticket_comment_attachments').insert({
        comment_id: comment.id,
        ticket_id: ticketId,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      })

      if (metaError) toast(`Anexo ${file.name} enviado, mas não registrado`, 'error')
    }

    setSending(false)
    toast(mode === 'analyst' && isInternal ? 'Nota interna salva' : 'Mensagem enviada')
    setContent('')
    setFiles([])
    setIsInternal(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-zinc-800/70 px-5 py-4">
        <h3 className="text-sm font-semibold text-zinc-100">
          {title} ({messages.length})
        </h3>
      </div>

      {messages.length > 0 ? (
        <div className="divide-y divide-zinc-800/70">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('px-5 py-4', message.is_internal && 'bg-amber-500/[0.04]')}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[13px] font-medium text-zinc-200">
                  {message.author?.full_name ?? 'Usuário'}
                </span>
                {message.is_internal && (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-400">
                    Interno
                  </span>
                )}
                {mode === 'collaborator' && message.author?.role === 'analyst' && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-950">
                    Suporte
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-600">{formatDate(message.created_at)}</span>
              </div>
              {message.content && message.content !== '(anexo)' && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                  {message.content}
                </p>
              )}
              {message.attachments.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <AttachmentChip key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 text-center text-[13px] text-zinc-600">
          {mode === 'collaborator'
            ? 'Nenhuma atualização ainda. Nossa equipe irá entrar em contato em breve.'
            : 'Nenhuma mensagem ainda.'}
        </div>
      )}

      {!closed ? (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-800/70 px-5 py-4">
          <Textarea
            placeholder={
              mode === 'analyst'
                ? isInternal
                  ? 'Nota interna (visível só para analistas)...'
                  : 'Responder ao solicitante...'
                : 'Escreva sua resposta...'
            }
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={isInternal ? 'border-amber-500/30 bg-amber-500/[0.03]' : ''}
          />

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-300"
                >
                  {isImage(file.type) ? (
                    <ImageIcon className="h-3.5 w-3.5 text-zinc-500" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                  <span className="max-w-[10rem] truncate">{file.name}</span>
                  <span className="text-zinc-600">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    className="text-zinc-600 hover:text-zinc-200"
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Anexar
              </button>
              {mode === 'analyst' && (
                <button
                  type="button"
                  onClick={() => setIsInternal(!isInternal)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    isInternal
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  )}
                >
                  {isInternal ? <Lock className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                  {isInternal ? 'Nota interna' : 'Resposta pública'}
                </button>
              )}
            </div>
            <Button type="submit" size="sm" loading={sending} disabled={!canSend}>
              <Send className="h-3.5 w-3.5" />
              Enviar
            </Button>
          </div>
        </form>
      ) : (
        <div className="border-t border-zinc-800/70 px-5 py-3 text-center text-[12px] text-zinc-600">
          Este chamado está finalizado e não recebe novas mensagens.
        </div>
      )}
    </div>
  )
}

function AttachmentChip({
  attachment,
}: {
  attachment: TicketCommentAttachment & { url?: string | null }
}) {
  const image = isImage(attachment.mime_type)

  if (image && attachment.url) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="group block overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition-colors hover:border-zinc-600"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.file_name}
          className="max-h-48 max-w-full object-contain bg-zinc-950"
        />
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-zinc-400 group-hover:text-zinc-200">
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span className="max-w-[12rem] truncate">{attachment.file_name}</span>
          <span className="text-zinc-600">{formatBytes(attachment.file_size)}</span>
        </span>
      </a>
    )
  }

  const content = (
    <>
      {image ? (
        <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-400" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      )}
      <span className="max-w-[12rem] truncate">{attachment.file_name}</span>
      <span className="text-zinc-600">{formatBytes(attachment.file_size)}</span>
    </>
  )

  if (!attachment.url) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-[12px] text-zinc-400">
        {content}
      </span>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
    >
      {content}
    </a>
  )
}
