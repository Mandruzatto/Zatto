import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { TicketPriority, TicketStatus, AssetStatus, AssetType, TicketCategory, WarrantyStatus } from './types'

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
  in_progress: 'Em Atendimento',
  waiting: 'Aguardando',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-amber-500/10 text-amber-400',
  waiting: 'bg-orange-500/10 text-orange-400',
  resolved: 'bg-emerald-500/10 text-emerald-400',
  closed: 'bg-zinc-500/10 text-zinc-400',
}

// Solid colors for progress bars / charts
export const TICKET_STATUS_BAR_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  waiting: 'bg-orange-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-zinc-600',
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

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Rede',
  access: 'Acesso',
  other: 'Outro',
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
