import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS, formatDateShort,
  getWarrantyStatus, WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS,
} from '@/lib/utils'
import { Plus } from 'lucide-react'

export default async function AssetsPage() {
  const supabase = await createClient()

  const { data: assets } = await supabase
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

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Inventário</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">{assets?.length ?? 0} ativos cadastrados</p>
        </div>
        <Link
          href="/assets/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3.5 py-2 text-[13px] font-medium text-zinc-950 hover:bg-zinc-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Ativo
        </Link>
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
                        <p className="text-xs text-zinc-600 mt-0.5 font-mono">{asset.asset_tag}</p>
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
                    Nenhum ativo cadastrado.
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
