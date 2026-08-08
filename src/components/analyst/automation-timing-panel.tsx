'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { AutomationSettings } from '@/lib/types'

export function AutomationTimingPanel({
  settings,
  teams,
  analysts,
}: {
  settings: AutomationSettings
  teams: { id: string; name: string }[]
  analysts: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    auto_close_enabled: settings.auto_close_enabled,
    auto_close_days: String(settings.auto_close_days),
    auto_close_message: settings.auto_close_message,
    sla_escalation_enabled: settings.sla_escalation_enabled,
    sla_escalation_at_percent: String(settings.sla_escalation_at_percent),
    sla_escalation_team_id: settings.sla_escalation_team_id ?? '',
    sla_escalation_assignee_id: settings.sla_escalation_assignee_id ?? '',
    sla_escalation_bump_priority: settings.sla_escalation_bump_priority,
  })
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('tenant_automation_settings')
      .update({
        auto_close_enabled: form.auto_close_enabled,
        auto_close_days: Number(form.auto_close_days) || 5,
        auto_close_message: form.auto_close_message.trim(),
        sla_escalation_enabled: form.sla_escalation_enabled,
        sla_escalation_at_percent: Number(form.sla_escalation_at_percent) || 80,
        sla_escalation_team_id: form.sla_escalation_team_id || null,
        sla_escalation_assignee_id: form.sla_escalation_assignee_id || null,
        sla_escalation_bump_priority: form.sla_escalation_bump_priority,
      })
      .eq('tenant_id', settings.tenant_id)

    setSaving(false)
    if (error) return toast(error.message, 'error')
    toast('Tempos atualizados')
    router.refresh()
  }

  async function runNow() {
    setRunning(true)
    const { data, error } = await supabase.rpc('run_my_time_automations')
    setRunning(false)
    if (error) return toast(error.message, 'error')
    toast(
      data === 0
        ? 'Nenhum chamado se encaixou agora'
        : `${data} chamado${data === 1 ? '' : 's'} atualizado${data === 1 ? '' : 's'}`
    )
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempos</CardTitle>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          As duas automações que dependem do relógio. O sistema confere a cada 15 minutos; as duas
          nascem desligadas.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <section
          className={cn(
            'space-y-3 rounded-lg border p-3.5 transition-colors',
            form.auto_close_enabled ? 'border-zinc-700' : 'border-zinc-800/80'
          )}
        >
          <label className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
            <input
              type="checkbox"
              checked={form.auto_close_enabled}
              onChange={(e) => setForm({ ...form, auto_close_enabled: e.target.checked })}
            />
            Fechar chamado parado
          </label>
          <p className="text-[12px] text-zinc-500">
            Chamados marcados como <span className="text-zinc-300">Pendente</span> que ficam sem
            nenhuma resposta são encerrados. O solicitante recebe o mesmo aviso de chamado
            finalizado que já existe — nenhum e-mail novo.
          </p>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <Input
              label="Dias sem resposta"
              type="number"
              min={1}
              max={365}
              value={form.auto_close_days}
              onChange={(e) => setForm({ ...form, auto_close_days: e.target.value })}
              disabled={!form.auto_close_enabled}
            />
            <Textarea
              label="Texto da resolução"
              rows={2}
              value={form.auto_close_message}
              onChange={(e) => setForm({ ...form, auto_close_message: e.target.value })}
              disabled={!form.auto_close_enabled}
            />
          </div>
        </section>

        <section
          className={cn(
            'space-y-3 rounded-lg border p-3.5 transition-colors',
            form.sla_escalation_enabled ? 'border-zinc-700' : 'border-zinc-800/80'
          )}
        >
          <label className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
            <input
              type="checkbox"
              checked={form.sla_escalation_enabled}
              onChange={(e) => setForm({ ...form, sla_escalation_enabled: e.target.checked })}
            />
            Escalonar antes de estourar o SLA
          </label>
          <p className="text-[12px] text-zinc-500">
            Quando o prazo de resolução chega perto do fim, o chamado muda de mãos. Não vale para
            chamado pendente ou em aprovação: nesses o relógio já está pausado.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Quando passar de (% do prazo)"
              type="number"
              min={10}
              max={100}
              value={form.sla_escalation_at_percent}
              onChange={(e) => setForm({ ...form, sla_escalation_at_percent: e.target.value })}
              disabled={!form.sla_escalation_enabled}
            />
            <Select
              label="Mandar para a fila"
              placeholder="Manter a fila atual"
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              value={form.sla_escalation_team_id}
              onChange={(e) => setForm({ ...form, sla_escalation_team_id: e.target.value })}
              disabled={!form.sla_escalation_enabled}
            />
            <Select
              label="Atribuir para"
              placeholder="Manter o responsável"
              options={analysts.map((a) => ({ value: a.id, label: a.full_name }))}
              value={form.sla_escalation_assignee_id}
              onChange={(e) => setForm({ ...form, sla_escalation_assignee_id: e.target.value })}
              disabled={!form.sla_escalation_enabled}
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-zinc-300">
            <input
              type="checkbox"
              checked={form.sla_escalation_bump_priority}
              disabled={!form.sla_escalation_enabled}
              onChange={(e) =>
                setForm({ ...form, sla_escalation_bump_priority: e.target.checked })
              }
            />
            Subir a prioridade um nível
          </label>
        </section>

        <div className="flex items-center gap-2">
          <Button size="sm" loading={saving} onClick={save}>
            Salvar tempos
          </Button>
          {/* Sem isto ninguém consegue conferir uma automação que só se manifesta em dias. */}
          <Button size="sm" variant="secondary" loading={running} onClick={runNow}>
            <Play className="h-3.5 w-3.5" />
            Rodar agora
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
