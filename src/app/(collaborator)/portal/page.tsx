import { createClient } from '@/lib/supabase/server'
import { PortalHome } from '@/components/collaborator/portal-home'
import type { Asset, KnowledgeArticle, ServiceCatalogItem, Ticket } from '@/lib/types'

const ACTIVE_STATUSES = ['open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled']

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // The resolved counter is relative to the request clock.
  // eslint-disable-next-line react-hooks/purity
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [
    { data: profile },
    { data: catalog },
    { data: articles },
    { data: activeTickets },
    { count: resolvedCount },
    { data: assignments },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).single(),
    supabase.from('service_catalog_items').select('*').eq('is_published', true).order('title'),
    supabase
      .from('knowledge_articles')
      .select('*, category:knowledge_categories(*)')
      .eq('status', 'published')
      .order('view_count', { ascending: false }),
    supabase
      .from('tickets')
      .select('*')
      .eq('requester_id', user!.id)
      .in('status', ACTIVE_STATUSES)
      .order('updated_at', { ascending: false }),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', user!.id)
      .in('status', ['resolved', 'closed'])
      .gte('updated_at', monthAgo),
    supabase
      .from('asset_assignments')
      .select('*, asset:assets(*)')
      .eq('user_id', user!.id)
      .is('returned_at', null)
      .order('assigned_at', { ascending: false })
      .limit(3),
    supabase
      .from('ticket_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('approver_id', user!.id)
      .eq('decision', 'pending'),
  ])

  const tickets = (activeTickets ?? []) as Ticket[]

  // Tickets whose last public message came from the support team are waiting on
  // the collaborator, and that is the main reason a ticket stalls.
  let waitingOnMe: Ticket[] = []
  if (tickets.length > 0) {
    const { data: comments } = await supabase
      .from('ticket_comments')
      .select('ticket_id, author_id, created_at')
      .in('ticket_id', tickets.map((ticket) => ticket.id))
      .eq('is_internal', false)
      .order('created_at', { ascending: true })

    const lastAuthor = new Map<string, string>()
    comments?.forEach((comment) => lastAuthor.set(comment.ticket_id, comment.author_id))
    waitingOnMe = tickets.filter((ticket) => {
      const author = lastAuthor.get(ticket.id)
      return author !== undefined && author !== user!.id
    })
  }

  return (
    <PortalHome
      name={profile?.full_name ?? 'Colaborador'}
      catalog={(catalog ?? []) as ServiceCatalogItem[]}
      articles={(articles ?? []) as unknown as KnowledgeArticle[]}
      tickets={tickets}
      waitingOnMe={waitingOnMe}
      resolvedCount={resolvedCount ?? 0}
      pendingApprovals={pendingApprovals ?? 0}
      assets={(assignments ?? []).map((row) => row.asset as unknown as Asset).filter(Boolean)}
    />
  )
}
