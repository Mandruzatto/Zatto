'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS } from '@/lib/utils'
import type { Asset, AssetStatus, AssetType } from '@/lib/types'
import { User, UserMinus } from 'lucide-react'

interface AssetEditProps {
  asset: Asset
  hasHolder: boolean
}

export function AssetEdit({ asset, hasHolder }: AssetEditProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: asset.name,
    type: asset.type,
    status: asset.status,
    brand: asset.brand ?? '',
    model: asset.model ?? '',
    serial_number: asset.serial_number ?? '',
    phone_line: asset.phone_line ?? '',
    purchase_date: asset.purchase_date ?? '',
    warranty_end_date: asset.warranty_end_date ?? '',
    notes: asset.notes ?? '',
  })

  const original = {
    name: asset.name,
    type: asset.type,
    status: asset.status,
    brand: asset.brand ?? '',
    model: asset.model ?? '',
    serial_number: asset.serial_number ?? '',
    phone_line: asset.phone_line ?? '',
    purchase_date: asset.purchase_date ?? '',
    warranty_end_date: asset.warranty_end_date ?? '',
    notes: asset.notes ?? '',
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(original)
  const inUseWithoutHolder = form.status === 'in_use' && !hasHolder

  async function handleSave() {
    setSaving(true)

    const { error } = await supabase
      .from('assets')
      .update({
        name: form.name,
        type: form.type,
        status: form.status,
        brand: form.brand || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        phone_line: form.phone_line || null,
        purchase_date: form.purchase_date || null,
        warranty_end_date: form.warranty_end_date || null,
        notes: form.notes || null,
      })
      .eq('id', asset.id)

    setSaving(false)
    if (error) {
      toast('Erro ao salvar ativo', 'error')
      return
    }
    toast('Alterações salvas')
    router.refresh()
  }

  const typeOptions = Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => ({ value, label }))
  const statusOptions = Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => ({ value, label }))

  return (
    <Card>
      <CardHeader><CardTitle>Informações do ativo</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        <Input
          label="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            options={typeOptions}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as AssetType })}
          />
          <div>
            <Select
              label="Status"
              options={statusOptions}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}
            />
            {inUseWithoutHolder && (
              <p className="text-xs text-amber-400 mt-1.5">
                Defina um responsável no painel ao lado para salvar como &ldquo;Em Uso&rdquo;.
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Marca"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
          <Input
            label="Modelo"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Número de série"
            value={form.serial_number}
            onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
          />
          <Input
            label="Linha / Chip"
            placeholder="Ex: 11911249394"
            value={form.phone_line}
            onChange={(e) => setForm({ ...form, phone_line: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data de aquisição"
            type="date"
            value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
          />
          <Input
            label="Fim da garantia"
            type="date"
            value={form.warranty_end_date}
            onChange={(e) => setForm({ ...form, warranty_end_date: e.target.value })}
          />
        </div>
        <Textarea
          label="Observações"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!dirty || !form.name.trim() || inUseWithoutHolder}
          className="w-full"
          size="sm"
        >
          Salvar alterações
        </Button>
      </CardContent>
    </Card>
  )
}

interface AssetAssignmentPanelProps {
  assetId: string
  currentAssignment: {
    id: string
    user: { id: string; full_name: string; email: string } | null
  } | null
  users: { id: string; full_name: string; department?: string | null }[]
}

export function AssetAssignmentPanel({ assetId, currentAssignment, users }: AssetAssignmentPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedUser, setSelectedUser] = useState('')
  const [working, setWorking] = useState(false)

  const userOptions = users.map((u) => ({
    value: u.id,
    label: u.department ? `${u.full_name} · ${u.department}` : u.full_name,
  }))

  async function handleAssign() {
    if (!selectedUser) return
    setWorking(true)

    // Encerra a atribuição atual, se houver
    if (currentAssignment) {
      await supabase
        .from('asset_assignments')
        .update({ returned_at: new Date().toISOString() })
        .eq('id', currentAssignment.id)
    }

    const { error } = await supabase.from('asset_assignments').insert({
      asset_id: assetId,
      user_id: selectedUser,
    })

    if (!error) {
      await supabase.from('assets').update({ status: 'in_use' }).eq('id', assetId)
    }

    setWorking(false)
    if (error) {
      toast('Erro ao atribuir ativo', 'error')
      return
    }
    toast('Ativo atribuído')
    setSelectedUser('')
    router.refresh()
  }

  async function handleReturn() {
    if (!currentAssignment) return
    setWorking(true)

    const { error } = await supabase
      .from('asset_assignments')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', currentAssignment.id)

    if (!error) {
      await supabase.from('assets').update({ status: 'returned' }).eq('id', assetId)
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
      <CardHeader><CardTitle>Responsável atual</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        {currentAssignment?.user ? (
          <>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-zinc-200">{currentAssignment.user.full_name}</p>
                <p className="text-xs text-zinc-600 mt-0.5 truncate">{currentAssignment.user.email}</p>
              </div>
            </div>
            <Button
              onClick={handleReturn}
              loading={working}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              <UserMinus className="h-3.5 w-3.5 mr-1.5" />
              Registrar devolução
            </Button>
            <div className="border-t border-zinc-800/70 pt-3.5 space-y-3">
              <Select
                label="Transferir para"
                options={userOptions.filter((o) => o.value !== currentAssignment.user?.id)}
                placeholder="Selecionar colaborador..."
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              />
              <Button
                onClick={handleAssign}
                loading={working}
                disabled={!selectedUser}
                size="sm"
                className="w-full"
              >
                Transferir ativo
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-zinc-600">Sem responsável atribuído.</p>
            <Select
              label="Atribuir a"
              options={userOptions}
              placeholder="Selecionar colaborador..."
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            />
            <Button
              onClick={handleAssign}
              loading={working}
              disabled={!selectedUser}
              size="sm"
              className="w-full"
            >
              Atribuir ativo
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
