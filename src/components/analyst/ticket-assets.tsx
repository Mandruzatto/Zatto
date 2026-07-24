'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { Monitor, X } from 'lucide-react'

interface AssetOption {
  id: string
  asset_tag: string
  name: string
}

interface TicketAssetsManagerProps {
  ticketId: string
  linkedAssets: AssetOption[]
  allAssets: AssetOption[]
  requesterAssetIds: string[]
}

export function TicketAssetsManager({
  ticketId,
  linkedAssets,
  allAssets,
  requesterAssetIds,
}: TicketAssetsManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [selected, setSelected] = useState('')
  const [working, setWorking] = useState(false)

  const linkedIds = new Set(linkedAssets.map((a) => a.id))
  const available = allAssets.filter((a) => !linkedIds.has(a.id))

  // Ativos do solicitante primeiro
  const requesterSet = new Set(requesterAssetIds)
  const sorted = [...available].sort((a, b) => {
    const ra = requesterSet.has(a.id) ? 0 : 1
    const rb = requesterSet.has(b.id) ? 0 : 1
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })

  const options = sorted.map((a) => ({
    value: a.id,
    label: `${a.asset_tag} · ${a.name}${requesterSet.has(a.id) ? ' (do solicitante)' : ''}`,
  }))

  async function handleAdd() {
    if (!selected) return
    setWorking(true)

    const { error } = await supabase.from('ticket_assets').insert({
      ticket_id: ticketId,
      asset_id: selected,
    })

    setWorking(false)
    if (error) {
      toast('Erro ao vincular ativo', 'error')
      return
    }
    toast('Ativo vinculado ao chamado')
    setSelected('')
    router.refresh()
  }

  async function handleRemove(assetId: string) {
    setWorking(true)

    const { error } = await supabase
      .from('ticket_assets')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('asset_id', assetId)

    setWorking(false)
    if (error) {
      toast('Erro ao desvincular ativo', 'error')
      return
    }
    toast('Ativo desvinculado')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Ativos vinculados</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        {linkedAssets.length > 0 ? (
          <div className="space-y-2">
            {linkedAssets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 group">
                <Monitor className="h-4 w-4 text-zinc-600 shrink-0" />
                <Link
                  href={`/assets/${asset.id}`}
                  className="text-[13px] text-zinc-300 hover:text-white transition-colors truncate flex-1 min-w-0"
                >
                  {asset.name}
                  <span className="text-zinc-600 text-xs ml-1.5 font-mono">{asset.asset_tag}</span>
                </Link>
                <button
                  onClick={() => handleRemove(asset.id)}
                  disabled={working}
                  className="text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                  title="Desvincular"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-zinc-600">Nenhum ativo vinculado.</p>
        )}

        <div className="border-t border-zinc-800/70 pt-3.5 space-y-3">
          <Select
            options={options}
            placeholder="Selecionar ativo..."
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          />
          <Button
            onClick={handleAdd}
            loading={working}
            disabled={!selected}
            size="sm"
            className="w-full"
            variant="secondary"
          >
            Vincular ativo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
