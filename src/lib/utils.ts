import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { TicketPriority, TicketStatus, TicketType, TicketArea, AssetStatus, AssetType, WarrantyStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// ---------- Warranty ----------

export const WARRANTY_EXPIRING_DAYS = 60

export function getWarrantyStatus(warrantyEndDate?: string | null): WarrantyStatus {
  if (!warrantyEndDate) return 'none'
  const end = new Date(warrantyEndDate + 'T23:59:59')
  const now = new Date()
  if (end < now) return 'expired'
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= WARRANTY_EXPIRING_DAYS) return 'expiring'
  return 'active'
}

export function daysUntil(date: string): number {
  const end = new Date(date + 'T23:59:59')
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  none: 'Sem garantia',
  active: 'Em garantia',
  expiring: 'Garantia acabando',
  expired: 'Garantia expirada',
}

export const WARRANTY_STATUS_COLORS: Record<WarrantyStatus, string> = {
  none: 'bg-zinc-500/10 text-zinc-500',
  active: 'bg-emerald-500/10 text-emerald-400',
  expiring: 'bg-amber-500/10 text-amber-400',
  expired: 'bg-red-500/10 text-red-400',
}

// ---------- Tickets ----------

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Aberto',
  awaiting_approval: 'Aguardando Aprovação',
  in_progress: 'Em Atendimento',
  pending: 'Pendente',
  scheduled: 'Agendado',
  resolved: 'Resolvido',
  closed: 'Encerrado',
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-500/10 text-blue-400',
  awaiting_approval: 'bg-cyan-500/10 text-cyan-400',
  in_progress: 'bg-amber-500/10 text-amber-400',
  pending: 'bg-orange-500/10 text-orange-400',
  scheduled: 'bg-violet-500/10 text-violet-400',
  resolved: 'bg-emerald-500/10 text-emerald-400',
  closed: 'bg-zinc-500/10 text-zinc-400',
}

// Solid colors for progress bars / charts
export const TICKET_STATUS_BAR_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-500',
  awaiting_approval: 'bg-cyan-500',
  in_progress: 'bg-amber-500',
  pending: 'bg-orange-500',
  scheduled: 'bg-violet-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-zinc-600',
}

// Hex colors for SVG charts
export const TICKET_STATUS_HEX: Record<TicketStatus, string> = {
  open: '#3b82f6',
  awaiting_approval: '#06b6d4',
  in_progress: '#f59e0b',
  pending: '#f97316',
  scheduled: '#8b5cf6',
  resolved: '#10b981',
  closed: '#52525b',
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export const TICKET_PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-zinc-500/10 text-zinc-400',
  medium: 'bg-blue-500/10 text-blue-400',
  high: 'bg-orange-500/10 text-orange-400',
  critical: 'bg-red-500/10 text-red-400',
}

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  incident: 'Incidente',
  request: 'Solicitação',
}

export const TICKET_TYPE_COLORS: Record<TicketType, string> = {
  incident: 'bg-rose-500/10 text-rose-400',
  request: 'bg-sky-500/10 text-sky-400',
}

export const TICKET_AREA_LABELS: Record<TicketArea, string> = {
  systems: 'Sistemas',
  infrastructure: 'Infraestrutura',
}

export const TICKET_AREA_COLORS: Record<TicketArea, string> = {
  systems: 'bg-indigo-500/10 text-indigo-400',
  infrastructure: 'bg-teal-500/10 text-teal-400',
}

// ---------- Assets ----------

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_use: 'Em Uso',
  stock: 'Estoque',
  returned: 'Devolvido',
  maintenance: 'Manutenção',
  disposed: 'Descarte',
}

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  in_use: 'bg-emerald-500/10 text-emerald-400',
  stock: 'bg-blue-500/10 text-blue-400',
  returned: 'bg-zinc-500/10 text-zinc-400',
  maintenance: 'bg-amber-500/10 text-amber-400',
  disposed: 'bg-red-500/10 text-red-400',
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  laptop: 'Notebook',
  desktop: 'Desktop',
  monitor: 'Monitor',
  phone: 'Celular',
  printer: 'Impressora',
  tablet: 'Tablet',
  other: 'Outro',
}

export function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function getScheduleState(scheduledFor?: string | null) {
  if (!scheduledFor) return { label: 'Sem data', className: 'bg-zinc-500/10 text-zinc-500' }
  const target = new Date(scheduledFor)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const daysAhead = Math.round((targetDay - startOfToday) / 86_400_000)

  if (target.getTime() < now.getTime()) return { label: 'Atrasado', className: 'bg-red-500/10 text-red-400' }
  if (daysAhead === 0) return { label: 'Hoje', className: 'bg-amber-500/10 text-amber-400' }
  if (daysAhead === 1) return { label: 'Amanhã', className: 'bg-violet-500/10 text-violet-400' }
  return { label: `Em ${daysAhead} dias`, className: 'bg-zinc-500/10 text-zinc-400' }
}

export function getSlaState(dueAt?: string | null, completedAt?: string | null) {
  if (!dueAt) return { label: 'Sem SLA', className: 'bg-zinc-500/10 text-zinc-500' }
  const due = new Date(dueAt).getTime()
  const reference = completedAt ? new Date(completedAt).getTime() : Date.now()
  const remaining = due - reference
  if (remaining < 0) return { label: 'SLA vencido', className: 'bg-red-500/10 text-red-400' }
  const hours = Math.ceil(remaining / 3_600_000)
  if (hours <= 4) return { label: `${hours}h restantes`, className: 'bg-amber-500/10 text-amber-400' }
  return { label: `${hours}h restantes`, className: 'bg-emerald-500/10 text-emerald-400' }
}
