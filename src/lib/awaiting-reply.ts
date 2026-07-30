export const ACTIVE_TICKET_STATUSES = [
  'open',
  'awaiting_approval',
  'in_progress',
  'pending',
  'scheduled',
] as const

type TicketRef = { id: string; requester_id: string }
type CommentRef = { ticket_id: string; author_id: string; created_at: string }

/** Tickets whose last public comment was written by the requester. */
export function findAwaitingReplyTicketIds(
  tickets: TicketRef[],
  comments: CommentRef[]
): Set<string> {
  const lastComment = new Map<string, { author_id: string; created_at: string }>()
  for (const comment of comments) {
    lastComment.set(comment.ticket_id, {
      author_id: comment.author_id,
      created_at: comment.created_at,
    })
  }

  const ids = new Set<string>()
  for (const ticket of tickets) {
    const last = lastComment.get(ticket.id)
    if (last && last.author_id === ticket.requester_id) ids.add(ticket.id)
  }
  return ids
}
