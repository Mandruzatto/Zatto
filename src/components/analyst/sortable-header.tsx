'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TicketSortKey =
  | 'ticket'
  | 'requester'
  | 'type'
  | 'area'
  | 'priority'
  | 'status'
  | 'sla'
  | 'assignee'
  | 'created_at'
  | 'updated_at'

export function SortableHeader({
  label,
  sortKey,
  className,
}: {
  label: string
  sortKey: TicketSortKey
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('sort')
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  const active = current === sortKey

  function toggle() {
    const params = new URLSearchParams(searchParams.toString())
    if (!active) {
      params.set('sort', sortKey)
      params.set('dir', 'asc')
    } else if (dir === 'asc') {
      params.set('dir', 'desc')
    } else {
      params.delete('sort')
      params.delete('dir')
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`)
  }

  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <th className={cn('px-4 py-2.5 text-left font-medium text-zinc-500', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-zinc-200',
          active && 'text-zinc-200'
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-zinc-300' : 'text-zinc-700')} />
      </button>
    </th>
  )
}
