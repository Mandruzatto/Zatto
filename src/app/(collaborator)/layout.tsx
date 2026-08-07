import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CollaboratorSidebar } from '@/components/collaborator/sidebar'
import { SessionTimeout } from '@/components/session-timeout'

const ACTIVE_STATUSES = ['open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled']

export default async function CollaboratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count }, { data: activeTickets }] = await Promise.all([
    supabase
      .from('profiles')
      .select('can_approve, full_name, email')
      .eq('id', user.id)
      .single(),
    supabase
      .from('ticket_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('approver_id', user.id)
      .eq('decision', 'pending'),
    supabase
      .from('tickets')
      .select('id')
      .eq('requester_id', user.id)
      .in('status', ACTIVE_STATUSES),
  ])

  let waitingOnMe = 0
  if (activeTickets && activeTickets.length > 0) {
    const { data: comments } = await supabase
      .from('ticket_comments')
      .select('ticket_id, author_id, created_at')
      .in('ticket_id', activeTickets.map((ticket) => ticket.id))
      .eq('is_internal', false)
      .order('created_at', { ascending: true })

    const lastAuthor = new Map<string, string>()
    comments?.forEach((comment) => lastAuthor.set(comment.ticket_id, comment.author_id))
    waitingOnMe = activeTickets.filter((ticket) => {
      const author = lastAuthor.get(ticket.id)
      return author !== undefined && author !== user.id
    }).length
  }

  const canApprove = (profile?.can_approve ?? false) || (count ?? 0) > 0

  return (
    <div className="flex h-screen bg-zinc-950">
      <SessionTimeout />
      <CollaboratorSidebar
        canApprove={canApprove}
        pendingApprovals={count ?? 0}
        waitingOnMe={waitingOnMe}
        userId={user.id}
        user={{
          fullName: profile?.full_name || user.email || 'Usuário',
          email: profile?.email || user.email || '',
        }}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
