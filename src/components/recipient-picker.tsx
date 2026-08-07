'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Person = { id: string; full_name: string; email: string }

/**
 * Escolha por nome, nunca por e-mail digitado: a pessoa é buscada no cadastro e
 * o endereço sai de lá. Evita erro de digitação e mantém o envio dentro do
 * ambiente do cliente.
 */
export function RecipientPicker({
  label,
  people,
  selected,
  onChange,
  exclude = [],
  placeholder = 'Digite um nome...',
}: {
  label: string
  people: Person[]
  selected: string[]
  onChange: (ids: string[]) => void
  exclude?: string[]
  placeholder?: string
}) {
  const [term, setTerm] = useState('')
  const [focused, setFocused] = useState(false)

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const matches = useMemo(() => {
    const taken = new Set([...selected, ...exclude])
    const needle = term.trim().toLowerCase()
    return people
      .filter((person) => !taken.has(person.id))
      .filter((person) =>
        !needle ||
        person.full_name.toLowerCase().includes(needle) ||
        person.email.toLowerCase().includes(needle)
      )
      .slice(0, 6)
  }, [people, selected, exclude, term])

  function add(id: string) {
    onChange([...selected, id])
    setTerm('')
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium text-zinc-400">{label}</p>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5">
        {selected.map((id) => {
          const person = byId.get(id)
          if (!person) return null
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800 py-0.5 pl-2 pr-1 text-[12px] text-zinc-200"
              title={person.email}
            >
              {person.full_name}
              <button
                type="button"
                aria-label={`Remover ${person.full_name}`}
                onClick={() => onChange(selected.filter((value) => value !== id))}
                className="rounded p-0.5 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}

        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => setFocused(true)}
          // Deixa o clique na sugestão acontecer antes de fechar a lista.
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder={selected.length ? '' : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>

      {focused && matches.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
          {matches.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => add(person.id)}
              className={cn(
                'flex w-full flex-col items-start px-3 py-2 text-left transition-colors',
                'hover:bg-zinc-900'
              )}
            >
              <span className="text-[13px] text-zinc-200">{person.full_name}</span>
              <span className="text-[11px] text-zinc-600">{person.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
