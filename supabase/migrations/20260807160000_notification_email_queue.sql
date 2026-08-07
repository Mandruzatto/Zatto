-- Marca quais notificações já viraram e-mail. Nulo significa pendente.
-- Serve de fila: se o envio falhar, a notificação continua pendente e é
-- tentada de novo, em vez de sumir.
alter table public.notifications add column email_sent_at timestamptz;

create index notifications_pending_email_idx
  on public.notifications (created_at)
  where email_sent_at is null;
