-- Marca quais mensagens da conversa também saíram por e-mail e para quem.
-- Nulo significa que a mensagem ficou só no portal.
alter table public.ticket_comments add column email_recipients text[];
