import { createClient } from '@/lib/supabase/server'
import { ApprovalQueue } from '@/components/collaborator/approval-queue'
import type { TicketApproval } from '@/lib/types'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from('profiles').select('can_approve, full_name, email').eq('id', user!.id).single(),
    supabase
      .from('ticket_approvals')
      .select('*, ticket:tickets(*, requester:profiles!requester_id(*), catalog_item:service_catalog_items(title))')
      .eq('approver_id', user!.id)
      .order('requested_at', { ascending: false }),
  ])

  const approvals = (data ?? []) as unknown as TicketApproval[]
  const enabled = (profile?.can_approve ?? false) || approvals.length > 0

  return (
    <ApprovalQueue
      approvals={approvals}
      enabled={enabled}
      viewer={{
        fullName: profile?.full_name || user?.email || 'Usuário',
        email: profile?.email || user?.email || '',
      }}
    />
  )
}
