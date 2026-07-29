'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const SORTS = [
  { value: '', label: 'Data de criação' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'sla', label: 'Prazo de SLA' },
]

export function BoardSort() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('sort') ?? ''

  function setSort(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('sort', value)
    else params.delete('sort')
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`)
  }

  return (
    <div className="relative">
      <ArrowUpDown className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-600" />
      <select
        value={current}
        onChange={(e) => setSort(e.target.value)}
        aria-label="Classificar por"
        className={cn(
          'cursor-pointer appearance-none rounded-lg border bg-zinc-900 py-2 pl-8 pr-3 text-[13px] transition-colors',
          'focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600',
          current ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-500'
        )}
      >
        {SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            Classificar: {sort.label}
          </option>
        ))}
      </select>
    </div>
  )
}
