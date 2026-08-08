'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { cn, formatDate } from '@/lib/utils'
import {
  ACTION_LABELS,
  FIELD_SPECS,
  OPERATOR_LABELS,
  TRIGGER_HINTS,
  TRIGGER_LABELS,
  actionAllowsEmpty,
  actionChoices,
  choicesFor,
  describeRule,
  operatorNeedsValue,
  operatorsFor,
} from '@/lib/automations'
import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationField,
  AutomationOperator,
  AutomationRule,
  AutomationTrigger,
} from '@/lib/types'

type Ctx = {
  teams: { id: string; name: string }[]
  analysts: { id: string; full_name: string }[]
  people: { id: string; full_name: string }[]
  catalog: { id: string; title: string }[]
}

type Draft = {
  id: string
  name: string
  trigger_on: AutomationTrigger
  match_mode: 'all' | 'any'
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  is_active: boolean
  position: string
}

const emptyDraft: Draft = {
  id: '',
  name: '',
  trigger_on: 'ticket_created',
  match_mode: 'all',
  conditions: [],
  actions: [{ type: 'set_team', value: null }],
  is_active: true,
  position: '100',
}

/** Campos que só existem quando o gatilho é resposta no chamado. */
function fieldsFor(trigger: AutomationTrigger): AutomationField[] {
  return (Object.keys(FIELD_SPECS) as AutomationField[]).filter(
    (f) => !FIELD_SPECS[f].commentOnly || trigger === 'comment_added'
  )
}

export function AutomationRulesPanel({ rules, ctx }: { rules: AutomationRule[]; ctx: Ctx }) {
  const router = useRouter()
  const supabase = createClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const editing = Boolean(draft?.id)

  function startNew() {
    setDraft({ ...emptyDraft, actions: [{ type: 'set_team', value: null }] })
  }

  function startEdit(rule: AutomationRule) {
    setDraft({
      id: rule.id,
      name: rule.name,
      trigger_on: rule.trigger_on,
      match_mode: rule.match_mode,
      conditions: rule.conditions ?? [],
      actions: rule.actions ?? [],
      is_active: rule.is_active,
      position: String(rule.position),
    })
  }

  async function save() {
    if (!draft) return
    if (!draft.name.trim()) return toast('Dê um nome para a regra', 'error')
    if (draft.actions.length === 0) return toast('A regra precisa de ao menos uma ação', 'error')

    const incomplete = draft.conditions.some(
      (c) => operatorNeedsValue(c.op) && (c.value === null || c.value === undefined || c.value === '')
    )
    if (incomplete) return toast('Há condição sem valor', 'error')

    setSaving(true)
    const payload = {
      name: draft.name.trim(),
      trigger_on: draft.trigger_on,
      match_mode: draft.match_mode,
      conditions: draft.conditions,
      actions: draft.actions,
      is_active: draft.is_active,
      position: Number(draft.position) || 100,
    }

    const { error } = editing
      ? await supabase.from('automation_rules').update(payload).eq('id', draft.id)
      : await supabase.from('automation_rules').insert(payload)

    setSaving(false)
    // A validação de verdade está no banco; a mensagem dele já vem em português.
    if (error) return toast(error.message, 'error')
    toast(editing ? 'Regra atualizada' : 'Regra criada')
    setDraft(null)
    router.refresh()
  }

  async function toggleActive(rule: AutomationRule) {
    const { error } = await supabase
      .from('automation_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id)
    if (error) return toast('Erro ao atualizar a regra', 'error')
    toast(rule.is_active ? 'Regra pausada' : 'Regra ativada')
    router.refresh()
  }

  async function remove(rule: AutomationRule) {
    const { error } = await supabase.from('automation_rules').delete().eq('id', rule.id)
    if (error) return toast('Erro ao excluir a regra', 'error')
    toast('Regra excluída')
    if (draft?.id === rule.id) setDraft(null)
    router.refresh()
  }

  const byTrigger = (Object.keys(TRIGGER_LABELS) as AutomationTrigger[]).map((trigger) => ({
    trigger,
    items: rules.filter((r) => r.trigger_on === trigger),
  }))

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>Regras</CardTitle>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Quando algo acontece, se as condições baterem, o sistema age sozinho.
          </p>
        </div>
        {!draft && (
          <Button size="sm" variant="secondary" onClick={startNew}>
            <Plus className="h-3.5 w-3.5" />
            Nova regra
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {draft && (
          <RuleEditor
            draft={draft}
            setDraft={setDraft}
            ctx={ctx}
            saving={saving}
            onSave={save}
            onCancel={() => setDraft(null)}
          />
        )}

        {rules.length === 0 && !draft && (
          <p className="py-6 text-center text-[13px] text-zinc-600">
            Nenhuma regra ainda. Um bom começo é mandar chamado de rede para a fila de
            Infraestrutura.
          </p>
        )}

        {byTrigger.map(({ trigger, items }) =>
          items.length === 0 ? null : (
            <div key={trigger} className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                {TRIGGER_LABELS[trigger]}
              </p>
              {items.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'rounded-lg border border-zinc-800/80 px-3 py-2.5',
                    !rule.is_active && 'opacity-55'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-zinc-100">{rule.name}</span>
                        {!rule.is_active && (
                          <Badge className="bg-zinc-800 text-zinc-400">Pausada</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                        {describeRule(
                          rule.conditions ?? [],
                          rule.actions ?? [],
                          rule.match_mode,
                          ctx
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-600">
                        {rule.run_count === 0
                          ? 'Ainda não rodou'
                          : `Rodou ${rule.run_count}x · última vez ${formatDate(rule.last_run_at!)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(rule)}>
                        {rule.is_active ? 'Pausar' : 'Ativar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => remove(rule)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}

function RuleEditor({
  draft,
  setDraft,
  ctx,
  saving,
  onSave,
  onCancel,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  ctx: Ctx
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const availableFields = fieldsFor(draft.trigger_on)

  function addCondition() {
    setDraft({
      ...draft,
      conditions: [...draft.conditions, { field: 'text', op: 'contains', value: '' }],
    })
  }

  function updateCondition(index: number, patch: Partial<AutomationCondition>) {
    setDraft({
      ...draft,
      conditions: draft.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    })
  }

  function changeField(index: number, field: AutomationField) {
    // Trocar o campo pode invalidar o operador ("contém" numa prioridade).
    const ops = operatorsFor(field)
    const current = draft.conditions[index]
    const op = ops.includes(current.op) ? current.op : ops[0]
    updateCondition(index, { field, op, value: '' })
  }

  function removeCondition(index: number) {
    setDraft({ ...draft, conditions: draft.conditions.filter((_, i) => i !== index) })
  }

  function addAction() {
    setDraft({ ...draft, actions: [...draft.actions, { type: 'set_priority', value: 'high' }] })
  }

  function updateAction(index: number, patch: Partial<AutomationAction>) {
    setDraft({
      ...draft,
      actions: draft.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    })
  }

  function changeActionType(index: number, type: AutomationActionType) {
    const first = actionChoices(type, ctx)[0]?.value ?? null
    updateAction(index, { type, value: actionAllowsEmpty(type) ? null : first })
  }

  function removeAction(index: number) {
    setDraft({ ...draft, actions: draft.actions.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-900/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Nome da regra"
          placeholder="ex: Chamado de rede vai para Infra"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Select
          label="Quando"
          options={Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }))}
          value={draft.trigger_on}
          onChange={(e) => {
            const trigger = e.target.value as AutomationTrigger
            // Condição de "quem respondeu" não existe fora do gatilho de resposta.
            setDraft({
              ...draft,
              trigger_on: trigger,
              conditions: draft.conditions.filter((c) =>
                fieldsFor(trigger).includes(c.field)
              ),
            })
          }}
        />
      </div>
      <p className="-mt-1 text-[12px] text-zinc-600">{TRIGGER_HINTS[draft.trigger_on]}</p>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-zinc-400">Se</span>
          {draft.conditions.length > 1 && (
            <Select
              options={[
                { value: 'all', label: 'todas as condições' },
                { value: 'any', label: 'qualquer condição' },
              ]}
              value={draft.match_mode}
              onChange={(e) =>
                setDraft({ ...draft, match_mode: e.target.value as 'all' | 'any' })
              }
              className="!py-1 text-[13px]"
            />
          )}
        </div>

        {draft.conditions.length === 0 && (
          <p className="text-[12px] text-zinc-600">
            Sem condição a regra vale para todos os chamados deste gatilho.
          </p>
        )}

        {draft.conditions.map((condition, index) => {
          const spec = FIELD_SPECS[condition.field]
          const ops = operatorsFor(condition.field)
          return (
            <div key={index} className="flex items-start gap-2">
              <Select
                options={availableFields.map((f) => ({ value: f, label: FIELD_SPECS[f].label }))}
                value={condition.field}
                onChange={(e) => changeField(index, e.target.value as AutomationField)}
                className="flex-1"
              />
              <Select
                options={ops.map((op) => ({ value: op, label: OPERATOR_LABELS[op] }))}
                value={condition.op}
                onChange={(e) =>
                  updateCondition(index, { op: e.target.value as AutomationOperator })
                }
                className="w-36 shrink-0"
              />
              {operatorNeedsValue(condition.op) &&
                (spec.kind === 'text' ? (
                  <Input
                    placeholder="texto"
                    value={String(condition.value ?? '')}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="flex-1"
                  />
                ) : (
                  <Select
                    placeholder="escolha..."
                    options={choicesFor(condition.field, ctx)}
                    value={String(condition.value ?? '')}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="flex-1"
                  />
                ))}
              <Button size="sm" variant="ghost" onClick={() => removeCondition(index)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        })}

        <Button size="sm" variant="ghost" onClick={addCondition}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar condição
        </Button>
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <span className="text-[13px] font-medium text-zinc-400">Então</span>

        {draft.actions.map((action, index) => (
          <div key={index} className="flex items-start gap-2">
            <Select
              options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
              value={action.type}
              onChange={(e) => changeActionType(index, e.target.value as AutomationActionType)}
              className="flex-1"
            />
            <Select
              placeholder={actionAllowsEmpty(action.type) ? 'nada (limpar)' : 'escolha...'}
              options={actionChoices(action.type, ctx)}
              value={action.value ?? ''}
              onChange={(e) => updateAction(index, { value: e.target.value || null })}
              className="flex-1"
            />
            {draft.actions.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => removeAction(index)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}

        <Button size="sm" variant="ghost" onClick={addAction}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar ação
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
        <label className="flex items-center gap-2 text-[13px] text-zinc-300">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
          />
          Regra ativa
        </label>
        <Input
          label="Ordem"
          type="number"
          value={draft.position}
          onChange={(e) => setDraft({ ...draft, position: e.target.value })}
          className="w-24"
          hint="Menor roda antes"
        />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" loading={saving} onClick={onSave}>
            Salvar regra
          </Button>
        </div>
      </div>
    </div>
  )
}
