import { createClient } from '@/lib/supabase/server'
import { ApprovalQueue } from '@/components/collaborator/approval-queue'
import type { TicketApproval } from '@/lib/types'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('can_approve').eq('id', user!.id).single()

  const { data } = await supabase
    .from('ticket_approvals')
    .select('*, ticket:tickets(*, requester:profiles!requester_id(*), catalog_item:service_catalog_items(title))')
    .eq('approver_id', user!.id)
    .order('requested_at', { ascending: false })

  return <ApprovalQueue approvals={(data ?? []) as unknown as TicketApproval[]} enabled={profile?.can_approve ?? false} />
}
