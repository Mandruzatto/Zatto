import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS, formatDateShort,
  getWarrantyStatus, WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS,
  cn,
} from '@/lib/utils'
import { Plus } from 'lucide-react'
import { ListSearch } from '@/components/ui/list-search'
import type { AssetType } from '@/lib/types'

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>
}) {
  const supabase = await createClient()
  const { type: typeFilter, q } = await searchParams

  const { data: allAssets } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: assignments } = await supabase
    .from('asset_assignments')
    .select('asset_id, user:profiles!user_id(full_name, department)')
    .is('returned_at', null)

  const holderMap = new Map(
    assignments?.map((a) => [a.asset_id, a.user as unknown as { full_name: string; department?: string }]) ?? []
  )

  const typeCounts = new Map<string, number>()
  allAssets?.forEach((a) => {
    typeCounts.set(a.type, (typeCounts.get(a.type) ?? 0) + 1)
  })

  const tabs: { key: string; label: string; count: number }[] = [
    { key: '', label: 'Todos', count: allAssets?.length ?? 0 },
    ...(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][])
      .filter(([key]) => (typeCounts.get(key) ?? 0) > 0)
      .map(([key, label]) => ({ key, label, count: typeCounts.get(key) ?? 0 })),
  ]

  const term = q?.trim().toLowerCase()
  const assets = allAssets?.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false
    if (!term) return true
    return [a.name, a.asset_tag, a.brand, a.model, a.serial_number, a.phone_line, a.notes]
      .filter(Boolean)
      .some((field: string) => field.toLowerCase().includes(term))
  })

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Inventário</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">{assets?.length ?? 0} ativos</p>
        </div>
        <div className="flex items-center gap-3">
          <ListSearch placeholder="Buscar por nome, tag, série, linha..." />
          <Link
            href="/assets/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3.5 py-2 text-[13px] font-medium text-zinc-950 hover:bg-zinc-300 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Ativo
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-800/80 -mb-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = (typeFilter ?? '') === tab.key
          const params = new URLSearchParams()
          if (tab.key) params.set('type', tab.key)
          if (q) params.set('q', q)
          return (
            <Link
              key={tab.key}
              href={`/assets${params.size ? `?${params}` : ''}`}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                active
                  ? 'border-zinc-100 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              {tab.label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                active ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800/80 text-zinc-500'
              )}>
                {tab.count}
              </span>
            </Link>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Ativo</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Garantia</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Responsável</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Aquisição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {assets?.map((asset) => {
                const holder = holderMap.get(asset.id)
                const warranty = getWarrantyStatus(asset.warranty_end_date)
                return (
                  <tr key={asset.id} className="hover:bg-zinc-900/60 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/assets/${asset.id}`} className="group">
                        <p className="font-medium text-zinc-200 group-hover:text-white">{asset.name}</p>
                        <p className="text-xs text-zinc-600 mt-0.5 font-mono">
                          {asset.asset_tag}
                          {asset.phone_line && ` · ${asset.phone_line}`}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS]}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ASSET_STATUS_COLORS[asset.status as keyof typeof ASSET_STATUS_COLORS]}>
                        {ASSET_STATUS_LABELS[asset.status as keyof typeof ASSET_STATUS_LABELS]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={WARRANTY_STATUS_COLORS[warranty]}>
                        {WARRANTY_STATUS_LABELS[warranty]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {holder ? (
                        <div>
                          <p className="text-zinc-300">{holder.full_name}</p>
                          {holder.department && <p className="text-xs text-zinc-600">{holder.department}</p>}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {asset.purchase_date ? formatDateShort(asset.purchase_date) : '—'}
                    </td>
                  </tr>
                )
              })}
              {(!assets || assets.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-600">
                    Nenhum ativo nesta categoria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
