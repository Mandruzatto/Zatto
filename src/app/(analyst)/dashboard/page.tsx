import { createClient } from '@/lib/supabase/server'
import { DashboardView, DashboardData } from '@/components/analyst/dashboard-view'
import type { TicketStatus, Asset } from '@/lib/types'

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
    { data: activeTicketRows },
  ] = await Promise.all([
    supabase.from('tickets').select('status, resolution_due_at'),
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
      .in('status', ['open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('assets')
      .select('*')
      .not('warranty_end_date', 'is', null)
      .neq('status', 'disposed')
      .order('warranty_end_date', { ascending: true }),
    supabase
      .from('tickets')
      .select('id, ticket_number, title, status, requester_id, requester:profiles!requester_id(full_name)')
      .in('status', ['open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled']),
  ])

  // Tickets ativos cuja última mensagem pública na conversa foi do colaborador (solicitante)
  let awaitingReply: DashboardData['awaitingReply'] = []
  if (activeTicketRows && activeTicketRows.length > 0) {
    const { data: commentRows } = await supabase
      .from('ticket_comments')
      .select('ticket_id, author_id, created_at')
      .in('ticket_id', activeTicketRows.map((t) => t.id))
      .eq('is_internal', false)
      .order('created_at', { ascending: true })

    const lastComment = new Map<string, { author_id: string; created_at: string }>()
    commentRows?.forEach((c) => {
      lastComment.set(c.ticket_id, { author_id: c.author_id, created_at: c.created_at })
    })

    awaitingReply = activeTicketRows
      .filter((t) => {
        const last = lastComment.get(t.id)
        return last && last.author_id === t.requester_id
      })
      .map((t) => ({
        id: t.id,
        ticket_number: t.ticket_number,
        title: t.title,
        status: t.status as TicketStatus,
        requester_name: (t.requester as unknown as { full_name: string } | null)?.full_name ?? '',
        last_comment_at: lastComment.get(t.id)!.created_at,
      }))
      .sort((a, b) => a.last_comment_at.localeCompare(b.last_comment_at))
  }

  const statusCounts: Record<TicketStatus, number> = {
    open: 0,
    awaiting_approval: 0,
    in_progress: 0,
    pending: 0,
    scheduled: 0,
    resolved: 0,
    closed: 0,
  }
  statusRows?.forEach((r) => {
    statusCounts[r.status as TicketStatus] += 1
  })
  // SLA indicators intentionally use request-time clock.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const slaBreached = statusRows?.filter((r) =>
    r.resolution_due_at && !['resolved', 'closed'].includes(r.status) && new Date(r.resolution_due_at).getTime() < now
  ).length ?? 0
  const slaAtRisk = statusRows?.filter((r) => {
    if (!r.resolution_due_at || ['resolved', 'closed'].includes(r.status)) return false
    const diff = new Date(r.resolution_due_at).getTime() - now
    return diff >= 0 && diff <= 4 * 3_600_000
  }).length ?? 0

  const data: DashboardData = {
    statusCounts,
    assetsInUse: assetsInUse ?? 0,
    assetsStock: assetsStock ?? 0,
    totalUsers: totalUsers ?? 0,
    recentTickets: (recentTickets ?? []) as unknown as DashboardData['recentTickets'],
    criticalTickets: (criticalTickets ?? []) as unknown as DashboardData['criticalTickets'],
    warrantyAssets: (warrantyAssets ?? []) as unknown as Asset[],
    awaitingReply,
    slaBreached,
    slaAtRisk,
  }

  return <DashboardView data={data} />
}
