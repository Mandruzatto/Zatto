import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS, formatDateShort
} from '@/lib/utils'

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
    assignments?.map((a) => [a.asset_id, a.user as any]) ?? []
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventário</h1>
          <p className="text-sm text-gray-500 mt-0.5">{assets?.length ?? 0} ativos cadastrados</p>
        </div>
        <Link
          href="/assets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          + Novo Ativo
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ativo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Marca / Modelo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Responsável</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Aquisição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {assets?.map((asset) => {
                const holder = holderMap.get(asset.id)
                return (
                  <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/assets/${asset.id}`} className="hover:text-indigo-600">
                        <p className="font-medium text-gray-900">{asset.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{asset.asset_tag}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS]}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {[asset.brand, asset.model].filter(Boolean).join(' · ') || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ASSET_STATUS_COLORS[asset.status as keyof typeof ASSET_STATUS_COLORS]}>
                        {ASSET_STATUS_LABELS[asset.status as keyof typeof ASSET_STATUS_LABELS]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {holder ? (
                        <div>
                          <p className="text-gray-700">{holder.full_name}</p>
                          {holder.department && <p className="text-xs text-gray-400">{holder.department}</p>}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Sem responsável</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {asset.purchase_date ? formatDateShort(asset.purchase_date) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                )
              })}
              {(!assets || assets.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
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
