'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, Copy, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { cn, formatDateShort } from '@/lib/utils'

export type PendingInvite = {
  id: string
  email: string
  role: string
  grants_tenant_admin: boolean
  expires_at: string
}

export type TenantRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  pessoas: number
  convites: PendingInvite[]
}

const ECOSYSTEMS = [
  { value: 'microsoft', label: 'Microsoft 365', hint: 'Base geral + SharePoint, Teams, Outlook, licenças' },
  { value: 'google', label: 'Google Workspace', hint: 'Base geral + Drive, Gmail, Meet, licenças' },
  { value: 'minimal', label: 'Mínimo', hint: 'Só incidente e solicitação — o cliente monta do zero' },
] as const

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function LinkBox({ link }: { link: string }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-xs text-zinc-500">Link de ativação</p>
      <p className="break-all font-mono text-[11px] text-zinc-300">{link}</p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          void navigator.clipboard.writeText(link)
          toast('Link copiado')
        }}
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  )
}

function InviteRow({ invite, onChanged }: { invite: PendingInvite; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  async function resend() {
    setBusy(true)
    const response = await fetch(`/api/invitations/${invite.id}`, { method: 'POST' })
    const payload = await response.json()
    setBusy(false)

    if (!response.ok && response.status !== 207) {
      return toast(payload.error || 'Não foi possível reenviar', 'error')
    }
    setLink(payload.link ?? '')
    toast(
      payload.warning
        ? payload.warning
        : payload.mode === 'dry-run'
          ? 'Link renovado. Sem e-mail configurado — copie abaixo.'
          : 'Convite reenviado com link novo'
    )
    onChanged()
  }

  async function cancel() {
    if (!confirmCancel) return setConfirmCancel(true)
    setBusy(true)
    const response = await fetch(`/api/invitations/${invite.id}`, { method: 'DELETE' })
    const payload = await response.json()
    setBusy(false)
    setConfirmCancel(false)

    if (!response.ok) return toast(payload.error || 'Não foi possível cancelar', 'error')
    toast('Convite cancelado')
    onChanged()
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] text-zinc-300">{invite.email}</p>
          <p className="text-[11px] text-zinc-600">
            {invite.role === 'analyst' ? 'Analista' : 'Colaborador'}
            {invite.grants_tenant_admin && ' · administrador'}
            {' · expira '}
            {formatDateShort(invite.expires_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            title="Gera um link novo e invalida o anterior"
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={cancel}
            onBlur={() => setConfirmCancel(false)}
            disabled={busy}
            title="Cancelar convite"
            className={cn(
              'rounded p-1.5 disabled:opacity-40',
              confirmCancel
                ? 'bg-red-500/15 text-red-400'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-red-400'
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {confirmCancel && (
        <p className="text-[11px] text-red-400/90">Clique de novo para confirmar o cancelamento.</p>
      )}
      {link && <LinkBox link={link} />}
    </div>
  )
}

function TenantCard({ tenant, onChanged }: { tenant: TenantRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tenant.name)
  const [slug, setSlug] = useState(tenant.slug)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function patch(body: Record<string, unknown>, okMessage: string) {
    setBusy(true)
    const response = await fetch(`/api/tenants/${tenant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) return toast(payload.error || 'Não foi possível salvar', 'error')
    toast(okMessage)
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    setBusy(true)
    const response = await fetch(`/api/tenants/${tenant.id}`, { method: 'DELETE' })
    const payload = await response.json()
    setBusy(false)
    setConfirmDelete(false)
    if (!response.ok) return toast(payload.error || 'Não foi possível excluir', 'error')
    toast('Cliente excluído')
    onChanged()
  }

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border p-3',
        tenant.is_active ? 'border-zinc-800/70' : 'border-amber-500/25 bg-amber-500/[0.03]'
      )}
    >
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />

        {editing ? (
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              label="Nome"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (slug === slugify(tenant.name)) setSlug(slugify(e.target.value))
              }}
            />
            <Input label="Identificador" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" loading={busy} onClick={() => patch({ name, slug }, 'Cliente atualizado')}>
                <Check className="h-3.5 w-3.5" />
                Salvar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setName(tenant.name)
                  setSlug(tenant.slug)
                  setEditing(false)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[13px] font-medium text-zinc-200">{tenant.name}</p>
                {!tenant.is_active && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    Suspenso
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-zinc-600">{tenant.slug}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {tenant.pessoas} pessoa(s)
                {tenant.convites.length > 0 && (
                  <span className="text-amber-400/90">
                    {' · '}{tenant.convites.length} convite(s) pendente(s)
                  </span>
                )}
                {' · desde '}{formatDateShort(tenant.created_at)}
              </p>
            </div>

            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Editar"
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  patch(
                    { isActive: !tenant.is_active },
                    tenant.is_active ? 'Acesso suspenso' : 'Acesso reativado'
                  )
                }
                title={tenant.is_active ? 'Suspender acesso' : 'Reativar acesso'}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-amber-400 disabled:opacity-40"
              >
                {tenant.is_active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={remove}
                onBlur={() => setConfirmDelete(false)}
                disabled={busy}
                title="Excluir cliente"
                className={cn(
                  'rounded p-1.5 disabled:opacity-40',
                  confirmDelete
                    ? 'bg-red-500/15 text-red-400'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-red-400'
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {confirmDelete && (
        <p className="text-[11px] text-red-400/90">
          Clique de novo para confirmar. Cliente com pessoas dentro não pode ser excluído —
          nesse caso, suspenda.
        </p>
      )}

      {tenant.convites.length > 0 && (
        <div className="space-y-2 border-t border-zinc-800/70 pt-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            Convites pendentes
          </p>
          {tenant.convites.map((invite) => (
            <InviteRow key={invite.id} invite={invite} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TenantsManager({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [email, setEmail] = useState('')
  const [ecosystem, setEcosystem] = useState<'minimal' | 'microsoft' | 'google'>('minimal')
  const [loading, setLoading] = useState(false)
  const [lastLink, setLastLink] = useState('')

  const refresh = () => router.refresh()

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
      body: JSON.stringify({ name, slug, focalPointEmail: email, ecosystem }),
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
    setEcosystem('minimal')

    if (payload.warning) toast(payload.warning, 'error')
    else if (payload.mode === 'dry-run') toast('Cliente criado. Sem e-mail configurado — copie o link.')
    else if (payload.redirectedTo) toast('Cliente criado. Convite foi para a caixa de teste.')
    else toast('Cliente criado e convite enviado')

    refresh()
  }

  return (
    <div className="max-w-5xl space-y-5 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Clientes</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Cada cliente é um ambiente isolado. Você cria e convida o ponto focal — ele
          administra o time dele a partir daí.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="h-fit">
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

              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-zinc-400">Ambiente do cliente</p>
                <div className="grid gap-1.5">
                  {ECOSYSTEMS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEcosystem(option.value)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left transition-colors',
                        ecosystem === option.value
                          ? 'border-zinc-600 bg-zinc-900'
                          : 'border-zinc-800 hover:border-zinc-700'
                      )}
                    >
                      <span className="block text-[13px] font-medium text-zinc-200">
                        {option.label}
                      </span>
                      <span className="block text-[11px] text-zinc-600">{option.hint}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-600">
                  Define o catálogo inicial. O cliente ajusta depois.
                </p>
              </div>
              <Button type="submit" size="sm" loading={loading}>
                <Plus className="h-3.5 w-3.5" />
                Criar cliente e convidar
              </Button>

              {lastLink && <LinkBox link={lastLink} />}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{tenants.length} cliente(s)</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {tenants.map((tenant) => (
              <TenantCard key={tenant.id} tenant={tenant} onChanged={refresh} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
