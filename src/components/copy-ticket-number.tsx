'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CopyTicketNumber({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be blocked; ignore silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copiado' : 'Copiar número'}
      aria-label={copied ? 'Número copiado' : `Copiar ${value}`}
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[13px] text-zinc-600 transition-colors hover:text-zinc-300',
        className
      )}
    >
      {value}
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-60" />
      )}
    </button>
  )
}
