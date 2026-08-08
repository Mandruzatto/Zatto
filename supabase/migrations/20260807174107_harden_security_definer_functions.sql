-- Endurecimento das funções privilegiadas apontadas pelo verificador do Supabase.
--
-- Três problemas, todos anteriores ao trabalho recente:
--
-- 1. is_ticket_approver e is_ticket_requester rodavam com privilégio elevado e
--    estavam expostas via RPC para visitante não autenticado. Elas só existem
--    para serem chamadas de dentro das políticas de acesso, e política é sempre
--    avaliada como usuário autenticado.
--
-- 2. log_ticket_status_change é função de gatilho — não deveria ser chamável por
--    ninguém — e mesmo assim estava aberta para visitante e para autenticado.
--
-- 3. A mesma função tinha search_path fixado em "public" em vez de vazio. Com
--    privilégio elevado, isso é o vetor clássico de sequestro: quem conseguisse
--    criar um objeto num schema à frente na busca faria a função executar código
--    dele. O corpo já usa nomes qualificados, então esvaziar é seguro.
--
-- invitation_preview segue aberta para visitante de propósito: quem clica no
-- link do convite ainda não tem conta. Ela devolve o mínimo e exige um token
-- aleatório de 32 bytes.

revoke all on function public.is_ticket_approver(uuid) from public, anon;
grant execute on function public.is_ticket_approver(uuid) to authenticated;

revoke all on function public.is_ticket_requester(uuid) from public, anon;
grant execute on function public.is_ticket_requester(uuid) to authenticated;

create or replace function public.log_ticket_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.ticket_events (ticket_id, actor_id, event_type, from_status, to_status)
    values (new.id, auth.uid(), 'status_change', old.status, new.status);
  end if;
  return new;
end;
$$;

revoke all on function public.log_ticket_status_change() from public, anon, authenticated;
