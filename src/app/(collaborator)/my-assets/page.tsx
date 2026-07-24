import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS, formatDateShort
} from '@/lib/utils'
import { Monitor, Laptop, Smartphone, Printer, Tablet } from 'lucide-react'

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
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Meus Equipamentos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {assignments?.length ?? 0} equipamentos sob sua responsabilidade
        </p>
      </div>

      {assignments && assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignments.map((assignment) => {
            const asset = assignment.asset as any
            const Icon = AssetIcons[asset.type] ?? Monitor
            return (
              <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 shrink-0">
                      <Icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{asset.name}</p>
                        <Badge className={ASSET_STATUS_COLORS[asset.status as keyof typeof ASSET_STATUS_COLORS]}>
                          {ASSET_STATUS_LABELS[asset.status as keyof typeof ASSET_STATUS_LABELS]}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS]}
                        {asset.brand && ` · ${asset.brand}`}
                        {asset.model && ` ${asset.model}`}
                      </p>
                      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-400">Patrimônio</p>
                          <p className="text-xs font-mono font-medium text-gray-700">{asset.asset_tag}</p>
                        </div>
                        {asset.serial_number && (
                          <div>
                            <p className="text-xs text-gray-400">Série</p>
                            <p className="text-xs font-mono font-medium text-gray-700">{asset.serial_number}</p>
                          </div>
                        )}
                        {asset.purchase_date && (
                          <div className="ml-auto">
                            <p className="text-xs text-gray-400">Aquisição</p>
                            <p className="text-xs text-gray-700">{formatDateShort(asset.purchase_date)}</p>
                          </div>
                        )}
                      </div>
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
            <Monitor className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum equipamento atribuído</p>
            <p className="text-sm text-gray-400 mt-1">
              Entre em contato com o suporte caso precise de um equipamento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
