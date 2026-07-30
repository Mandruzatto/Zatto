'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Check, Copy, ExternalLink, MonitorSmartphone, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import type { RemoteAccessMethod, RemoteSession } from '@/lib/types'
import {
  REMOTE_SESSION_STATUS_COLORS,
  REMOTE_SESSION_STATUS_LABELS,
  canRevealRemoteAccess,
  formatDate,
  isRemoteSessionWindowOpen,
} from '@/lib/utils'

const DURATION_OPTIONS = [
  { value: '30', label: '30 minutos' },
  { value: '45', label: '45 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1h30' },
]

type Mode = 'analyst' | 'collaborator'

export function RemoteSessionPanel({
  ticketId,
  currentUserId,
  mode,
  sessions,
  defaultAccessPayload = '',
  ticketFinalized = false,
}: {
  ticketId: string
  currentUserId: string
  mode: Mode
  sessions: RemoteSession[]
  defaultAccessPayload?: string
  ticketFinalized?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [scheduledFor, setScheduledFor] = useState('')
  const [duration, setDuration] = useState('30')
  const [accessPayload, setAccessPayload] = useState(defaultAccessPayload)
  const [accessMethod, setAccessMethod] = useState<RemoteAccessMethod>('anydesk')

  const active = sessions.filter((session) => !['done', 'cancelled'].includes(session.status))
  const history = sessions.filter((session) => ['done', 'cancelled'].includes(session.status)).slice(0, 3)

  async function logComment(content: string) {
    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author_id: currentUserId,
      content,
      is_internal: false,
    })
  }

  async function propose() {
    if (!scheduledFor) {
      toast('Informe data e horário da sessão', 'error')
      return
    }
    setLoading('propose')
    const { error } = await supabase.from('remote_sessions').insert({
      ticket_id: ticketId,
      proposed_by: currentUserId,
      analyst_id: mode === 'analyst' ? currentUserId : null,
      scheduled_for: new Date(scheduledFor).toISOString(),
      duration_minutes: Number(duration),
      status: 'proposed',
      access_method: accessMethod,
      access_payload: accessPayload.trim() || null,
    })
    if (error) {
      setLoading(null)
      toast(error.message || 'Não foi possível propor a sessão', 'error')
      return
    }
    await logComment(
      `Propôs uma sessão remota para ${formatDate(new Date(scheduledFor).toISOString())} (${duration} min).`
    )
    setLoading(null)
    setScheduledFor('')
    toast('Sessão proposta')
    router.refresh()
  }

  async function confirm(session: RemoteSession) {
    setLoading(session.id)
    const updates: Record<string, unknown> = { status: 'confirmed' }
    if (mode === 'analyst') updates.analyst_id = currentUserId
    if (accessPayload.trim() && !session.access_payload) {
      updates.access_payload = accessPayload.trim()
      updates.access_method = accessMethod
    }
    const { error } = await supabase.from('remote_sessions').update(updates).eq('id', session.id)
    if (error) {
      setLoading(null)
      toast(error.message || 'Não foi possível confirmar', 'error')
      return
    }
    await logComment(`Confirmou a sessão remota de ${formatDate(session.scheduled_for)}.`)
    setLoading(null)
    toast('Sessão confirmada')
    router.refresh()
  }

  async function authorize(session: RemoteSession) {
    if (mode !== 'collaborator') return
    if (!isRemoteSessionWindowOpen(session.scheduled_for, session.duration_minutes)) {
      toast('A autorização só fica disponível perto do horário marcado', 'error')
      return
    }
    const payload = accessPayload.trim() || session.access_payload?.trim()
    if (!payload) {
      toast('Informe o ID do AnyDesk (ou link) para autorizar', 'error')
      return
    }
    setLoading(session.id)
    const { error } = await supabase
      .from('remote_sessions')
      .update({
        status: 'ready',
        consent_at: new Date().toISOString(),
        access_payload: payload,
        access_method: accessMethod,
      })
      .eq('id', session.id)
    if (error) {
      setLoading(null)
      toast(error.message || 'Não foi possível autorizar', 'error')
      return
    }
    await logComment('Autorizei o acesso remoto nesta janela de horário.')
    setLoading(null)
    toast('Acesso autorizado para o suporte')
    router.refresh()
  }

  async function start(session: RemoteSession) {
    if (mode !== 'analyst') return
    setLoading(session.id)
    const { error } = await supabase
      .from('remote_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        analyst_id: currentUserId,
      })
      .eq('id', session.id)
    if (error) {
      setLoading(null)
      toast(error.message || 'Não foi possível iniciar', 'error')
      return
    }
    await logComment('Iniciou a sessão remota.')
    setLoading(null)
    toast('Sessão em andamento')
    router.refresh()
  }

  async function end(session: RemoteSession) {
    setLoading(session.id)
    const { error } = await supabase
      .from('remote_sessions')
      .update({
        status: 'done',
        ended_at: new Date().toISOString(),
      })
      .eq('id', session.id)
    if (error) {
      setLoading(null)
      toast(error.message || 'Não foi possível encerrar', 'error')
      return
    }
    await logComment('Encerrou a sessão remota.')
    setLoading(null)
    toast('Sessão encerrada')
    router.refresh()
  }

  async function cancel(session: RemoteSession) {
    setLoading(session.id)
    const { error } = await supabase
      .from('remote_sessions')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', session.id)
    if (error) {
      setLoading(null)
      toast(error.message || 'Não foi possível cancelar', 'error')
      return
    }
    await logComment('Cancelou a sessão remota.')
    setLoading(null)
    toast('Sessão cancelada')
    router.refresh()
  }

  function copyPayload(value: string) {
    void navigator.clipboard.writeText(value)
    toast('Copiado')
  }

  function openAnydesk(value: string) {
    const id = value.replace(/\D/g, '')
    if (!id) {
      toast('ID do AnyDesk inválido', 'error')
      return
    }
    window.location.href = `anydesk:${id}`
  }

  if (ticketFinalized && active.length === 0 && history.length === 0) return null

  return (
    <Card className="border-sky-500/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-sky-400" />
          Sessão remota
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.map((session) => {
          const waitingOnMe = session.status === 'proposed' && session.proposed_by !== currentUserId
          const waitingOnOther = session.status === 'proposed' && session.proposed_by === currentUserId
          const inWindow = isRemoteSessionWindowOpen(session.scheduled_for, session.duration_minutes)
          const reveal = mode === 'analyst' && canRevealRemoteAccess(session) && Boolean(session.access_payload)
          const canAuthorize = mode === 'collaborator' && session.status === 'confirmed' && inWindow

          return (
            <div key={session.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={REMOTE_SESSION_STATUS_COLORS[session.status]}>
                  {REMOTE_SESSION_STATUS_LABELS[session.status]}
                </Badge>
                <span className="text-[13px] text-zinc-300">
                  {formatDate(session.scheduled_for)} · {session.duration_minutes} min
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                Proposto por {session.proposer?.full_name ?? 'usuário'}
                {waitingOnOther && ' · aguardando confirmação da outra parte'}
                {waitingOnMe && ' · sua confirmação é necessária'}
                {session.status === 'confirmed' && !inWindow && ' · autorize perto do horário marcado'}
                {session.status === 'confirmed' && inWindow && mode === 'collaborator' && ' · você já pode autorizar o acesso'}
                {session.status === 'ready' && mode === 'analyst' && ' · colaborador autorizou — entre na sessão'}
              </p>

              {(mode === 'collaborator' || reveal) && (
                <div className="space-y-2">
                  {mode === 'collaborator' && ['proposed', 'confirmed', 'ready'].includes(session.status) && (
                    <Input
                      label={accessMethod === 'anydesk' ? 'ID do AnyDesk' : 'Link ou código de acesso'}
                      value={accessPayload || session.access_payload || ''}
                      onChange={(e) => setAccessPayload(e.target.value)}
                      placeholder={accessMethod === 'anydesk' ? 'Ex: 1 234 567 890' : 'Cole o link aqui'}
                    />
                  )}
                  {reveal && session.access_payload && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wide text-emerald-400/80">Acesso liberado</p>
                        <p className="font-mono text-[13px] text-zinc-100 truncate">{session.access_payload}</p>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => copyPayload(session.access_payload!)}>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      {session.access_method === 'anydesk' && (
                        <Button type="button" size="sm" onClick={() => openAnydesk(session.access_payload!)}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir AnyDesk
                        </Button>
                      )}
                    </div>
                  )}
                  {mode === 'analyst' && !reveal && ['confirmed', 'ready', 'in_progress'].includes(session.status) && (
                    <p className="text-xs text-zinc-600">
                      O ID/link só aparece após o colaborador autorizar na janela do horário.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {waitingOnMe && (
                  <Button type="button" size="sm" loading={loading === session.id} onClick={() => confirm(session)}>
                    <Check className="h-3.5 w-3.5" />
                    Confirmar horário
                  </Button>
                )}
                {canAuthorize && (
                  <Button type="button" size="sm" loading={loading === session.id} onClick={() => authorize(session)}>
                    <Check className="h-3.5 w-3.5" />
                    Estou disponível — autorizar acesso
                  </Button>
                )}
                {mode === 'analyst' && session.status === 'ready' && (
                  <Button type="button" size="sm" loading={loading === session.id} onClick={() => start(session)}>
                    Entrar na sessão
                  </Button>
                )}
                {(session.status === 'ready' || session.status === 'in_progress') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={loading === session.id}
                    onClick={() => end(session)}
                  >
                    Encerrar
                  </Button>
                )}
                {['proposed', 'confirmed', 'ready'].includes(session.status) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={loading === session.id}
                    onClick={() => cancel(session)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )
        })}

        {!ticketFinalized && active.length === 0 && (
          <div className="space-y-3">
            <p className="text-[13px] text-zinc-400">
              Agende um horário de acesso remoto como uma reunião neste chamado.
            </p>
            <Input
              label="Data e horário"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              required
            />
            <Select
              label="Duração"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              options={DURATION_OPTIONS}
            />
            <Select
              label="Método"
              value={accessMethod}
              onChange={(e) => setAccessMethod(e.target.value as RemoteAccessMethod)}
              options={[
                { value: 'anydesk', label: 'AnyDesk' },
                { value: 'link', label: 'Link de acesso' },
                { value: 'other', label: 'Outro' },
              ]}
            />
            <Input
              label={accessMethod === 'anydesk' ? 'ID do AnyDesk (opcional agora)' : 'Link ou código (opcional agora)'}
              value={accessPayload}
              onChange={(e) => setAccessPayload(e.target.value)}
              placeholder={accessMethod === 'anydesk' ? 'Ex: 1 234 567 890' : 'Cole o link aqui'}
              hint={
                mode === 'collaborator'
                  ? 'Pode informar agora ou só na hora de autorizar.'
                  : 'O colaborador pode completar o ID na hora da sessão.'
              }
            />
            <Button type="button" size="sm" loading={loading === 'propose'} onClick={propose}>
              <CalendarClock className="h-3.5 w-3.5" />
              Propor sessão
            </Button>
          </div>
        )}

        {active.length > 0 && !ticketFinalized && (
          <p className="text-[11px] text-zinc-600">
            Encerre ou cancele a sessão atual para propor um novo horário.
          </p>
        )}

        {history.length > 0 && (
          <div className="border-t border-zinc-800/80 pt-3 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-zinc-600">Histórico</p>
            {history.map((session) => (
              <p key={session.id} className="text-xs text-zinc-600">
                {formatDate(session.scheduled_for)} · {REMOTE_SESSION_STATUS_LABELS[session.status]}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
