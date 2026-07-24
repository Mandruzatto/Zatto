import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
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
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Colaboradores</h1>
        <p className="text-sm text-gray-500 mt-0.5">{users?.length ?? 0} colaboradores cadastrados</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">E-mail</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Departamento</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Equipamentos</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chamados Abertos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users?.map((user) => {
                const assets = assetCountMap.get(user.id) ?? 0
                const tickets = ticketCountMap.get(user.id) ?? 0
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.department ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/assets?user=${user.id}`}
                        className="inline-flex items-center gap-1.5 text-gray-600 hover:text-indigo-600"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        {assets}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/tickets?requester=${user.id}`}
                        className="inline-flex items-center gap-1.5"
                      >
                        {tickets > 0 ? (
                          <Badge className="bg-orange-100 text-orange-800">
                            <Ticket className="h-3 w-3 mr-1" />
                            {tickets}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
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
