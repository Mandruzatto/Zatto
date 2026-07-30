'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { ASSET_TYPE_LABELS } from '@/lib/utils'
import type { Profile, AssetType } from '@/lib/types'
import { Monitor, Search, Loader2, Plus, KeyRound, UserMinus } from 'lucide-react'

// ---------- Edição de dados ----------

export function UserEdit({ profile, managers }: { profile: Profile; managers: { id: string; full_name: string }[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: profile.full_name,
    job_title: profile.job_title ?? '',
    department: profile.department ?? '',
    phone: profile.phone ?? '',
    manager_id: profile.manager_id ?? '',
    can_approve: profile.can_approve ?? false,
  })

  const dirty =
    form.full_name !== profile.full_name ||
    form.job_title !== (profile.job_title ?? '') ||
    form.department !== (profile.department ?? '') ||
    form.phone !== (profile.phone ?? '') ||
    form.manager_id !== (profile.manager_id ?? '') ||
    form.can_approve !== (profile.can_approve ?? false)

  async function handleSave() {
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        job_title: form.job_title || null,
        department: form.department || null,
        phone: form.phone || null,
        manager_id: form.manager_id || null,
        can_approve: form.can_approve,
      })
      .eq('id', profile.id)

    setSaving(false)
    if (error) {
      toast('Erro ao salvar alterações', 'error')
      return
    }
    toast('Alterações salvas')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Dados do colaborador</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        <Input
          label="Nome completo"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <Input
          label="E-mail"
          value={profile.email}
          disabled
          hint="O e-mail de acesso não pode ser alterado."
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Cargo"
            placeholder="Ex: Analista Financeiro"
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
          />
          <Input
            label="Departamento"
            placeholder="Ex: Financeiro"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </div>
        <Input
          label="Telefone / WhatsApp"
          placeholder="Ex: 11999998888"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          hint="Usado pelo suporte para contato rápido no chamado."
        />
        <Select
          label="Gestor padrão"
          options={managers.filter((manager) => manager.id !== profile.id).map((manager) => ({ value: manager.id, label: manager.full_name }))}
          placeholder="Sem gestor definido"
          value={form.manager_id}
          onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
        />
        <label className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-[13px] text-zinc-300">
          <input type="checkbox" checked={form.can_approve} onChange={(e) => setForm({ ...form, can_approve: e.target.checked })} className="accent-zinc-100" />
          Pode aprovar solicitações de colaboradores
        </label>
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!dirty || !form.full_name.trim()}
          className="w-full"
          size="sm"
        >
          Salvar alterações
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------- Reset de senha ----------

export function PasswordReset({ userId }: { userId: string }) {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)

  async function handleReset() {
    setWorking(true)

    const { error } = await supabase.rpc('reset_user_password', {
      p_user_id: userId,
      p_password: password,
    })

    setWorking(false)
    if (error) {
      toast(error.message.includes('senha') ? error.message : 'Erro ao redefinir senha', 'error')
      return
    }
    toast('Senha redefinida')
    setPassword('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-zinc-500" />
          Redefinir senha
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          type="password"
          placeholder="Nova senha (mín. 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
        />
        <Button
          onClick={handleReset}
          loading={working}
          disabled={password.length < 6}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          Redefinir senha
        </Button>
        <p className="text-xs text-zinc-600">
          Compartilhe a nova senha com o colaborador.
        </p>
      </CardContent>
    </Card>
  )
}

// ---------- Ativos do colaborador ----------

interface HeldAsset {
  assignmentId: string
  id: string
  asset_tag: string
  name: string
  type: AssetType
}

interface SearchedAsset {
  id: string
  asset_tag: string
  name: string
  type: AssetType
  phone_line: string | null
  status: string
}

export function UserAssetsPanel({ userId, heldAssets }: { userId: string; heldAssets: HeldAsset[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchedAsset[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [working, setWorking] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const heldIds = new Set(heldAssets.map((a) => a.id))

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      const term = `%${value.trim()}%`
      setSearching(true)
      const { data } = await supabase
        .from('assets')
        .select('id, asset_tag, name, type, phone_line, status')
        .or(`asset_tag.ilike.${term},name.ilike.${term},serial_number.ilike.${term},phone_line.ilike.${term}`)
        .neq('status', 'disposed')
        .limit(8)
      setResults(((data ?? []) as SearchedAsset[]).filter((a) => !heldIds.has(a.id)))
      setSearching(false)
    }, 250)
  }

  async function handleAssign(asset: SearchedAsset) {
    setWorking(true)

    // Encerra atribuição ativa do ativo (se estiver com outra pessoa)
    await supabase
      .from('asset_assignments')
      .update({ returned_at: new Date().toISOString() })
      .eq('asset_id', asset.id)
      .is('returned_at', null)

    const { error } = await supabase.from('asset_assignments').insert({
      asset_id: asset.id,
      user_id: userId,
    })

    if (!error) {
      await supabase.from('assets').update({ status: 'in_use' }).eq('id', asset.id)
    }

    setWorking(false)
    if (error) {
      toast('Erro ao atribuir ativo', 'error')
      return
    }
    toast(`${asset.name} atribuído`)
    setQuery('')
    setResults([])
    setOpen(false)
    router.refresh()
  }

  async function handleReturn(asset: HeldAsset) {
    setWorking(true)

    const { error } = await supabase
      .from('asset_assignments')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', asset.assignmentId)

    if (!error) {
      await supabase.from('assets').update({ status: 'returned' }).eq('id', asset.id)
    }

    setWorking(false)
    if (error) {
      toast('Erro ao registrar devolução', 'error')
      return
    }
    toast('Devolução registrada')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Ativos sob responsabilidade</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        {heldAssets.length > 0 ? (
          <div className="space-y-2">
            {heldAssets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 group">
                <Monitor className="h-4 w-4 text-zinc-600 shrink-0" />
                <Link
                  href={`/assets/${asset.id}`}
                  className="text-[13px] text-zinc-300 hover:text-zinc-50 transition-colors truncate flex-1 min-w-0"
                >
                  {asset.name}
                  <span className="text-zinc-600 text-xs ml-1.5 font-mono">
                    {asset.asset_tag} · {ASSET_TYPE_LABELS[asset.type]}
                  </span>
                </Link>
                <button
                  onClick={() => handleReturn(asset)}
                  disabled={working}
                  className="text-zinc-700 hover:text-amber-400 transition-colors shrink-0"
                  title="Registrar devolução"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-zinc-600">Nenhum ativo atribuído.</p>
        )}

        <div ref={containerRef} className="relative border-t border-zinc-800/70 pt-3.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
            {searching && (
              <Loader2 className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-600 animate-spin" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder="Buscar ativo para atribuir..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-8 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 transition-colors focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          {open && query.trim().length >= 2 && results.length > 0 && (
            <div className="absolute top-full mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden z-40 max-h-64 overflow-y-auto">
              {results.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssign(asset)}
                  disabled={working}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-900 transition-colors text-left disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{asset.name}</p>
                    <p className="text-xs text-zinc-600 font-mono truncate">
                      {asset.asset_tag} · {ASSET_TYPE_LABELS[asset.type]}
                      {asset.phone_line && ` · ${asset.phone_line}`}
                      {asset.status === 'in_use' && ' · em uso por outra pessoa'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {open && query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="absolute top-full mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 z-40">
              <p className="px-3 py-4 text-center text-[13px] text-zinc-600">
                Nenhum ativo encontrado para &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
