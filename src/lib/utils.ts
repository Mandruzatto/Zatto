import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { TicketPriority, TicketStatus, AssetStatus, AssetType, TicketCategory } from './types'

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

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em Atendimento',
  waiting: 'Aguardando',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  waiting: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-700',
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export const TICKET_PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Rede',
  access: 'Acesso',
  other: 'Outro',
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  maintenance: 'Manutenção',
  retired: 'Aposentado',
}

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  maintenance: 'bg-yellow-100 text-yellow-800',
  retired: 'bg-red-100 text-red-800',
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
