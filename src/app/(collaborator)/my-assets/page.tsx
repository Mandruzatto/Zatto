import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS, formatDateShort,
  getWarrantyStatus, WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS,
} from '@/lib/utils'
import { Monitor, Laptop, Smartphone, Printer, Tablet } from 'lucide-react'
import type { Asset, WarrantyStatus } from '@/lib/types'

const AssetIcons: Record<string, React.ElementType> = {
  laptop: Laptop,
  desktop: Monitor,
  monitor: Monitor,
  phone: Smartphone,
  printer: Printer,
  tablet: Tablet,
  other: Monitor,
}

export default async function MyAssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: assignments } = await supabase
    .from('asset_assignments')
    .select('*, asset:assets(*)')
    .eq('user_id', user!.id)
    .is('returned_at', null)
    .order('assigned_at', { ascending: false })

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Meus Equipamentos</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">
          {assignments?.length ?? 0} equipamentos sob sua responsabilidade
        </p>
      </div>

      {assignments && assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assignments.map((assignment) => {
            const asset = assignment.asset as unknown as Asset
            const Icon = AssetIcons[asset.type] ?? Monitor
            const warranty = getWarrantyStatus(asset.warranty_end_date)
            return (
              <Card key={assignment.id} className="hover:border-zinc-700 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800/80 shrink-0">
                      <Icon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-zinc-100 leading-snug">{asset.name}</p>
                        <Badge className={ASSET_STATUS_COLORS[asset.status]}>
                          {ASSET_STATUS_LABELS[asset.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {ASSET_TYPE_LABELS[asset.type]}
                        {asset.brand && ` · ${asset.brand}`}
                        {asset.model && ` ${asset.model}`}
                      </p>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/70">
                        <div>
                          <p className="text-[11px] text-zinc-600">Patrimônio</p>
                          <p className="text-xs font-mono text-zinc-300">{asset.asset_tag}</p>
                        </div>
                        {asset.serial_number && (
                          <div>
                            <p className="text-[11px] text-zinc-600">Série</p>
                            <p className="text-xs font-mono text-zinc-300">{asset.serial_number}</p>
                          </div>
                        )}
                        <div className="ml-auto">
                          <Badge className={WARRANTY_STATUS_COLORS[warranty as WarrantyStatus]}>
                            {WARRANTY_STATUS_LABELS[warranty as WarrantyStatus]}
                          </Badge>
                        </div>
                      </div>
                      {asset.warranty_end_date && (
                        <p className="text-[11px] text-zinc-600 mt-1.5">
                          Garantia até {formatDateShort(asset.warranty_end_date)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Monitor className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 text-[13px] font-medium">Nenhum equipamento atribuído</p>
            <p className="text-[13px] text-zinc-600 mt-1">
              Entre em contato com o suporte caso precise de um equipamento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
