import { createClient } from '@/lib/supabase/server'
import { DashboardView, DashboardData } from '@/components/analyst/dashboard-view'
import type { Ticket, TicketStatus, Asset } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: statusRows },
    { count: assetsInUse },
    { count: assetsStock },
    { count: totalUsers },
    { data: recentTickets },
    { data: criticalTickets },
    { data: warrantyAssets },
  ] = await Promise.all([
    supabase.from('tickets').select('status'),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'in_use'),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'stock'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'collaborator'),
    supabase
      .from('tickets')
      .select('*, requester:profiles!requester_id(full_name, department)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('tickets')
      .select('*, requester:profiles!requester_id(full_name)')
      .eq('priority', 'critical')
      .in('status', ['open', 'in_progress', 'pending_response', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('assets')
      .select('*')
      .not('warranty_end_date', 'is', null)
      .neq('status', 'disposed')
      .order('warranty_end_date', { ascending: true }),
  ])

  const statusCounts: Record<TicketStatus, number> = {
    open: 0,
    in_progress: 0,
    pending_response: 0,
    scheduled: 0,
    resolved: 0,
    closed: 0,
  }
  statusRows?.forEach((r) => {
    statusCounts[r.status as TicketStatus] += 1
  })

  const data: DashboardData = {
    statusCounts,
    assetsInUse: assetsInUse ?? 0,
    assetsStock: assetsStock ?? 0,
    totalUsers: totalUsers ?? 0,
    recentTickets: (recentTickets ?? []) as unknown as DashboardData['recentTickets'],
    criticalTickets: (criticalTickets ?? []) as unknown as DashboardData['criticalTickets'],
    warrantyAssets: (warrantyAssets ?? []) as unknown as Asset[],
  }

  return <DashboardView data={data} />
}
