import { createClient } from '@/lib/supabase/server'
import type { ChatMessage } from '@/components/ticket-chat'

export async function loadTicketChat(
  ticketId: string,
  options: { includeInternal: boolean }
): Promise<ChatMessage[]> {
  const supabase = await createClient()

  let query = supabase
    .from('ticket_comments')
    .select(`
      id, content, is_internal, created_at, email_recipients,
      author:profiles!author_id(full_name, role),
      attachments:ticket_comment_attachments(*)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (!options.includeInternal) {
    query = query.eq('is_internal', false)
  }

  const { data } = await query

  const messages: ChatMessage[] = []
  for (const row of data ?? []) {
    const attachmentsRaw = (row.attachments ?? []) as Array<{
      id: string
      comment_id: string
      ticket_id: string
      uploaded_by?: string | null
      file_name: string
      file_path: string
      file_size: number
      mime_type: string
      created_at: string
    }>

    const attachments = await Promise.all(
      attachmentsRaw.map(async (attachment) => {
        const { data: signed } = await supabase.storage
          .from('ticket-attachments')
          .createSignedUrl(attachment.file_path, 60 * 60)
        return { ...attachment, url: signed?.signedUrl ?? null }
      })
    )

    messages.push({
      id: row.id,
      content: row.content,
      is_internal: row.is_internal,
      created_at: row.created_at,
      author: row.author as unknown as { full_name: string; role?: string } | null,
      email_recipients: row.email_recipients,
      attachments,
    })
  }

  return messages
}
