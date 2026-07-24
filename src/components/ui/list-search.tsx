'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface ListSearchProps {
  placeholder?: string
  className?: string
}

/** Campo de busca que sincroniza com o parâmetro ?q= da URL (com debounce). */
export function ListSearch({ placeholder = 'Buscar...', className }: ListSearchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function apply(q: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (q.trim()) {
      params.set('q', q.trim())
    } else {
      params.delete('q')
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`)
  }

  function handleChange(q: string) {
    setValue(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => apply(q), 300)
  }

  return (
    <div className={`relative ${className ?? 'w-72'}`}>
      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
      {value && (
        <button
          onClick={() => handleChange('')}
          className="absolute right-2.5 top-2.5 text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-8 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 transition-colors focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
      />
    </div>
  )
}
