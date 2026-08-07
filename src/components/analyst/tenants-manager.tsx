'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Copy, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { formatDateShort } from '@/lib/utils'

type TenantRow = {
  id: string
  name: string
  slug: string
  created_at: string
  pessoas: number
  convites_pendentes: number
}

/** Sugere o identificador a partir do nome, sem impedir a edição manual. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function TenantsManager({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastLink, setLastLink] = useState('')

  function changeName(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLastLink('')

    const response = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, focalPointEmail: email }),
    })
    const payload = await response.json()
    setLoading(false)

    if (!response.ok && response.status !== 207) {
      return toast(payload.error || 'Não foi possível criar o cliente', 'error')
    }

    setLastLink(payload.link ?? '')
    setName('')
    setSlug('')
    setSlugTouched(false)
    setEmail('')

    if (payload.warning) toast(payload.warning, 'error')
    else if (payload.mode === 'dry-run') toast('Cliente criado. Sem e-mail configurado — copie o link.')
    else if (payload.redirectedTo) toast(`Cliente criado. Convite foi para a caixa de teste.`)
    else toast('Cliente criado e convite enviado')

    router.refresh()
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Clientes</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Cada cliente é um ambiente isolado. Você cria e convida o ponto focal — ele
          administra o time dele a partir daí.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Novo cliente</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3.5">
              <Input
                label="Nome da empresa"
                value={name}
                onChange={(e) => changeName(e.target.value)}
                placeholder="OCP Brasil"
                required
              />
              <Input
                label="Identificador"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                placeholder="ocpbrasil"
                hint="Vira o endereço do ambiente no futuro. Letras minúsculas, números e hífen."
                required
              />
              <Input
                label="E-mail do ponto focal"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="responsavel@empresa.com.br"
                hint="Recebe o link e vira a conta administradora do cliente."
                required
              />
              <Button type="submit" size="sm" loading={loading}>
                <Plus className="h-3.5 w-3.5" />
                Criar cliente e convidar
              </Button>

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

        <Card>
          <CardHeader><CardTitle>{tenants.length} cliente(s)</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-800/70 p-3"
              >
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-zinc-200">{tenant.name}</p>
                  <p className="font-mono text-[11px] text-zinc-600">{tenant.slug}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {tenant.pessoas} pessoa(s)
                    {tenant.convites_pendentes > 0 && (
                      <span className="text-amber-400/90">
                        {' · '}{tenant.convites_pendentes} convite(s) pendente(s)
                      </span>
                    )}
                    {' · desde '}{formatDateShort(tenant.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
