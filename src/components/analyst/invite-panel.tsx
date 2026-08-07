'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'

type Tenant = { id: string; name: string }

export function InvitePanel({
  isPlatformAdmin,
  tenants,
}: {
  isPlatformAdmin: boolean
  /** Só preenchido para administrador da plataforma, que convida para qualquer cliente. */
  tenants: Tenant[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'analyst' | 'collaborator'>('collaborator')
  const [tenantId, setTenantId] = useState('')
  const [grantsAdmin, setGrantsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastLink, setLastLink] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLastLink('')

    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        role,
        tenantId: tenantId || undefined,
        grantsTenantAdmin: grantsAdmin,
      }),
    })

    const payload = await response.json()
    setLoading(false)

    if (!response.ok && response.status !== 207) {
      return toast(payload.error || 'Não foi possível criar o convite', 'error')
    }

    setLastLink(payload.link ?? '')
    setEmail('')

    if (payload.warning) {
      toast(payload.warning, 'error')
    } else if (payload.mode === 'dry-run') {
      toast('Convite criado. Sem e-mail configurado — copie o link abaixo.')
    } else if (payload.redirectedTo) {
      toast(`Convite enviado para a caixa de teste (${payload.redirectedTo})`)
    } else {
      toast('Convite enviado')
    }

    router.refresh()
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Mail className="h-3.5 w-3.5" />
        Convidar pessoa
      </Button>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader><CardTitle>Convidar pessoa</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3.5">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@empresa.com.br"
            required
          />

          {isPlatformAdmin && tenants.length > 0 && (
            <Select
              label="Cliente"
              placeholder="Meu próprio ambiente"
              options={tenants.map((t) => ({ value: t.id, label: t.name }))}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          )}

          <Select
            label="Papel"
            options={[
              { value: 'collaborator', label: 'Colaborador' },
              { value: 'analyst', label: 'Analista' },
            ]}
            value={role}
            onChange={(e) => setRole(e.target.value as 'analyst' | 'collaborator')}
          />

          <label className="flex items-start gap-2.5 text-[13px] text-zinc-300">
            <input
              type="checkbox"
              checked={grantsAdmin}
              onChange={(e) => setGrantsAdmin(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Conta administradora do cliente
              <span className="block text-xs text-zinc-600">
                Pode convidar outras pessoas daquela empresa.
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={loading}>
              <Send className="h-3.5 w-3.5" />
              Enviar convite
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>

          {lastLink && (
            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-xs text-zinc-500">Link de ativação</p>
              <p className="break-all font-mono text-[11px] text-zinc-300">{lastLink}</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(lastLink)
                  toast('Link copiado')
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
