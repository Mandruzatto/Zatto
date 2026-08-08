import {
  TICKET_AREA_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
} from '@/lib/utils'
import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationField,
  AutomationOperator,
  AutomationTrigger,
} from '@/lib/types'

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  ticket_created: 'Um chamado é aberto',
  ticket_updated: 'Um chamado é alterado',
  comment_added: 'Alguém responde no chamado',
}

export const TRIGGER_HINTS: Record<AutomationTrigger, string> = {
  ticket_created: 'Roda uma vez, na abertura. É onde mora o roteamento.',
  ticket_updated: 'Roda toda vez que status, prioridade, tipo, área, fila, responsável, título ou descrição mudam.',
  comment_added: 'Roda a cada resposta visível ao solicitante. Notas internas não contam.',
}

export const OPERATOR_LABELS: Record<AutomationOperator, string> = {
  eq: 'é',
  neq: 'não é',
  in: 'está entre',
  contains: 'contém',
  not_contains: 'não contém',
  is_empty: 'está vazio',
  is_not_empty: 'está preenchido',
}

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  set_team: 'Mandar para a fila',
  set_assignee: 'Atribuir para',
  set_priority: 'Mudar a prioridade para',
  set_status: 'Mudar o status para',
  set_type: 'Mudar o tipo para',
  set_area: 'Mudar a área para',
}

/**
 * Cada campo diz de que tipo ele é, e o tipo decide dois comportamentos da
 * tela: quais operadores fazem sentido e se o valor é um texto livre ou uma
 * lista. Sem isso a tela ofereceria "contém" para prioridade.
 */
type FieldSpec = {
  label: string
  kind: 'enum' | 'reference' | 'text'
  /** Só aparece quando o gatilho é resposta no chamado. */
  commentOnly?: boolean
}

export const FIELD_SPECS: Record<AutomationField, FieldSpec> = {
  text: { label: 'Título ou descrição', kind: 'text' },
  title: { label: 'Título', kind: 'text' },
  description: { label: 'Descrição', kind: 'text' },
  type: { label: 'Tipo', kind: 'enum' },
  priority: { label: 'Prioridade', kind: 'enum' },
  status: { label: 'Status', kind: 'enum' },
  area: { label: 'Área', kind: 'enum' },
  team_id: { label: 'Fila', kind: 'reference' },
  assignee_id: { label: 'Responsável', kind: 'reference' },
  requester_id: { label: 'Quem abriu', kind: 'reference' },
  catalog_item_id: { label: 'Item do catálogo', kind: 'reference' },
  comment_author_role: { label: 'Quem respondeu', kind: 'enum', commentOnly: true },
}

const TEXT_OPERATORS: AutomationOperator[] = ['contains', 'not_contains', 'eq', 'neq']
const CHOICE_OPERATORS: AutomationOperator[] = ['eq', 'neq']
const NULLABLE_OPERATORS: AutomationOperator[] = ['is_empty', 'is_not_empty']

/** Prioridade, status e tipo nunca são nulos: não faz sentido perguntar. */
const NEVER_EMPTY: AutomationField[] = ['type', 'priority', 'status', 'title', 'description', 'text']

export function operatorsFor(field: AutomationField): AutomationOperator[] {
  const base = FIELD_SPECS[field].kind === 'text' ? TEXT_OPERATORS : CHOICE_OPERATORS
  return NEVER_EMPTY.includes(field) ? base : [...base, ...NULLABLE_OPERATORS]
}

export function operatorNeedsValue(op: AutomationOperator) {
  return op !== 'is_empty' && op !== 'is_not_empty'
}

export const COMMENT_AUTHOR_LABELS: Record<string, string> = {
  requester: 'Quem abriu o chamado',
  agent: 'Alguém do time',
}

/**
 * Valores possíveis dos campos de lista. Fila, responsável, quem abriu e item
 * do catálogo dependem do cliente, então chegam de fora.
 */
export function choicesFor(
  field: AutomationField,
  ctx: {
    teams: { id: string; name: string }[]
    analysts: { id: string; full_name: string }[]
    people: { id: string; full_name: string }[]
    catalog: { id: string; title: string }[]
  }
): { value: string; label: string }[] {
  const fromLabels = (labels: Record<string, string>) =>
    Object.entries(labels).map(([value, label]) => ({ value, label }))

  switch (field) {
    case 'type':
      return fromLabels(TICKET_TYPE_LABELS)
    case 'priority':
      return fromLabels(TICKET_PRIORITY_LABELS)
    case 'status':
      return fromLabels(TICKET_STATUS_LABELS)
    case 'area':
      return fromLabels(TICKET_AREA_LABELS)
    case 'comment_author_role':
      return fromLabels(COMMENT_AUTHOR_LABELS)
    case 'team_id':
      return ctx.teams.map((t) => ({ value: t.id, label: t.name }))
    case 'assignee_id':
      return ctx.analysts.map((a) => ({ value: a.id, label: a.full_name }))
    case 'requester_id':
      return ctx.people.map((p) => ({ value: p.id, label: p.full_name }))
    case 'catalog_item_id':
      return ctx.catalog.map((c) => ({ value: c.id, label: c.title }))
    default:
      return []
  }
}

export function actionChoices(
  type: AutomationActionType,
  ctx: {
    teams: { id: string; name: string }[]
    analysts: { id: string; full_name: string }[]
  }
): { value: string; label: string }[] {
  switch (type) {
    case 'set_team':
      return ctx.teams.map((t) => ({ value: t.id, label: t.name }))
    case 'set_assignee':
      return ctx.analysts.map((a) => ({ value: a.id, label: a.full_name }))
    case 'set_priority':
      return Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))
    case 'set_status':
      return Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label }))
    case 'set_type':
      return Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => ({ value, label }))
    case 'set_area':
      return Object.entries(TICKET_AREA_LABELS).map(([value, label]) => ({ value, label }))
    default:
      return []
  }
}

/** Ações que aceitam "nada": limpar a fila, tirar o responsável, zerar a área. */
export function actionAllowsEmpty(type: AutomationActionType) {
  return type === 'set_team' || type === 'set_assignee' || type === 'set_area'
}

/**
 * Frase legível da regra, para a listagem. Sem isso o analista teria que abrir
 * cada regra para lembrar o que ela faz.
 */
export function describeRule(
  conditions: AutomationCondition[],
  actions: AutomationAction[],
  matchMode: 'all' | 'any',
  ctx: Parameters<typeof choicesFor>[1]
): string {
  const nameOf = (field: AutomationField, value: unknown) => {
    const found = choicesFor(field, ctx).find((c) => c.value === String(value))
    return found?.label ?? String(value ?? '')
  }

  const parts = conditions.map((c) => {
    const spec = FIELD_SPECS[c.field]
    const op = OPERATOR_LABELS[c.op]
    if (!operatorNeedsValue(c.op)) return `${spec.label} ${op}`
    const value = spec.kind === 'text' ? `"${String(c.value ?? '')}"` : nameOf(c.field, c.value)
    return `${spec.label} ${op} ${value}`
  })

  const when = parts.length === 0
    ? 'Sempre'
    : `Se ${parts.join(matchMode === 'any' ? ' ou ' : ' e ')}`

  const then = actions
    .map((a) => {
      const label = ACTION_LABELS[a.type]
      if (a.value === null || a.value === '') return `${label} nada`
      const choice = actionChoices(a.type, ctx).find((c) => c.value === a.value)
      return `${label} ${choice?.label ?? a.value}`
    })
    .join(', ')

  return `${when} → ${then}`
}
