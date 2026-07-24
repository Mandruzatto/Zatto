import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Monitor, Ticket } from 'lucide-react'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'collaborator')
    .order('full_name')

  const { data: assignments } = await supabase
    .from('asset_assignments')
    .select('user_id, asset_id')
    .is('returned_at', null)

  const { data: openTickets } = await supabase
    .from('tickets')
    .select('requester_id')
    .in('status', ['open', 'in_progress', 'waiting'])

  const assetCountMap = new Map<string, number>()
  assignments?.forEach((a) => {
    assetCountMap.set(a.user_id, (assetCountMap.get(a.user_id) ?? 0) + 1)
  })

  const ticketCountMap = new Map<string, number>()
  openTickets?.forEach((t) => {
    ticketCountMap.set(t.requester_id, (ticketCountMap.get(t.requester_id) ?? 0) + 1)
  })

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Colaboradores</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">{users?.length ?? 0} colaboradores cadastrados</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Nome</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">E-mail</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Departamento</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Equipamentos</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Chamados abertos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {users?.map((user) => {
                const assets = assetCountMap.get(user.id) ?? 0
                const tickets = ticketCountMap.get(user.id) ?? 0
                return (
                  <tr key={user.id} className="hover:bg-zinc-900/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-200">{user.full_name}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{user.email}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {user.department ?? <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <Monitor className="h-3.5 w-3.5 text-zinc-600" />
                        {assets}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tickets > 0 ? (
                        <Badge className="bg-orange-500/10 text-orange-400">
                          <Ticket className="h-3 w-3 mr-1" />
                          {tickets}
                        </Badge>
                      ) : (
                        <span className="text-zinc-600">0</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-600">
                    Nenhum colaborador cadastrado.
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
