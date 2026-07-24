'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ASSET_TYPE_LABELS, ASSET_STATUS_LABELS } from '@/lib/utils'
import type { AssetType, AssetStatus } from '@/lib/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewAssetPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    asset_tag: '',
    name: '',
    type: 'laptop' as AssetType,
    status: 'stock' as AssetStatus,
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    warranty_end_date: '',
    notes: '',
  })

  const typeOptions = Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => ({ value, label }))
  const statusOptions = Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => ({ value, label }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.from('assets').insert({
      asset_tag: form.asset_tag,
      name: form.name,
      type: form.type,
      status: form.status,
      brand: form.brand || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      warranty_end_date: form.warranty_end_date || null,
      notes: form.notes || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/assets')
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <Link href="/assets" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Inventário
      </Link>

      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Novo Ativo</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">Cadastre um novo equipamento no inventário.</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tag de Patrimônio"
                placeholder="Ex: NB-001"
                value={form.asset_tag}
                onChange={(e) => setForm({ ...form, asset_tag: e.target.value })}
                required
              />
              <Select
                label="Tipo"
                options={typeOptions}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AssetType })}
              />
            </div>

            <Input
              label="Nome / Descrição"
              placeholder="Ex: Notebook Dell Latitude 5420"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Marca"
                placeholder="Ex: Dell"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
              <Input
                label="Modelo"
                placeholder="Ex: Latitude 5420"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Número de Série"
                placeholder="Ex: SN123456"
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              />
              <Select
                label="Status"
                options={statusOptions}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data de Aquisição"
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              />
              <Input
                label="Fim da Garantia"
                type="date"
                value={form.warranty_end_date}
                onChange={(e) => setForm({ ...form, warranty_end_date: e.target.value })}
                hint="Deixe vazio se não houver garantia"
              />
            </div>

            <Textarea
              label="Observações"
              placeholder="Informações adicionais sobre o equipamento..."
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            {error && (
              <p className="text-[13px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={loading}>
                Cadastrar Ativo
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
