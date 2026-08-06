-- `tickets.updated_at` é usado como sinal de atividade (lista, dashboard, sino de
-- notificações, portal), mas só era atualizado em mudanças no próprio chamado e,
-- por efeito colateral do trg_mark_first_response, em respostas públicas do analista.
-- Resposta do colaborador e nota interna não contavam. Este trigger fecha a lacuna.

create or replace function public.touch_ticket_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tickets
    set updated_at = now()
    where id = new.ticket_id;
  return new;
end;
$$;

revoke all on function public.touch_ticket_on_comment() from public, anon, authenticated;

drop trigger if exists trg_touch_ticket_on_comment on public.ticket_comments;
create trigger trg_touch_ticket_on_comment
  after insert on public.ticket_comments
  for each row execute function public.touch_ticket_on_comment();
