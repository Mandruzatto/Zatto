# Subir o zaTTo num ambiente novo

Passos que não são automáticos e, se esquecidos, deixam o ambiente quebrado de
formas silenciosas.

## 1. Migrations

```bash
supabase link --project-ref <ref-do-projeto>
supabase db push
```

## 2. Modelos de catálogo — obrigatório

```bash
supabase db execute --file supabase/seed/catalog_templates.sql
```

Sem isso a tabela `catalog_templates` nasce vazia e **todo cliente criado recebe
catálogo vazio** — o portal não oferece nada para abrir chamado. Não dá para
perceber olhando a tela de administração, só quando um colaborador tenta abrir
chamado e não encontra nada.

## 3. Agendador das automações por tempo

A migration liga a extensão `pg_cron` e agenda a rotina. Confira que o agendamento
existe:

```sql
select jobname, schedule, active from cron.job where jobname = 'zatto-time-automations';
```

Sem essa linha, fechamento automático e escalonamento de SLA simplesmente nunca
rodam — e não há erro em lugar nenhum, porque ninguém está chamando. As duas
automações nascem desligadas por cliente, então o silêncio é indistinguível do
comportamento normal até alguém ligar e continuar sem ver efeito.

## 4. Variáveis de ambiente

| Variável | Para quê | Se faltar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Conexão | Nada funciona |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexão | Nada funciona |
| `NEXT_PUBLIC_SITE_URL` | Monta o link do convite | Convite sai apontando para o endereço de onde a requisição veio — em desenvolvimento, `localhost`, que não abre na máquina de ninguém |
| `RESEND_API_KEY` | Envio de e-mail | Modo seco: nada é enviado, só registrado no log |
| `EMAIL_FROM` | Remetente | Cai em `onboarding@resend.dev`, que só entrega no dono da conta Resend |
| `EMAIL_TEST_INBOX` | Desvia todo envio para um endereço só | Sem ela o envio vai para os destinatários reais — **remova apenas quando o domínio estiver verificado** |
| `INBOUND_WEBHOOK_SECRET` | Assina o webhook de e-mail de entrada | A rota recusa tudo, por segurança |

## 5. Configuração do Supabase Auth

**Desligar "Confirm email"** em Authentication → Sign In / Providers → Email.

O convite já prova que o endereço é válido. Com a confirmação ligada, o Supabase
cria a conta, guarda a senha e **recusa o login** até o endereço ser confirmado —
o cliente ativa o convite e mesmo assim não entra.

Vale também ligar **Leaked password protection** na mesma tela.

## 6. Primeiro administrador da plataforma

Depois que a sua conta existir:

```sql
update public.profiles
set is_platform_admin = true, is_tenant_admin = true
where email = 'seu@email';
```

Sem isso ninguém consegue criar cliente — a tela "Clientes" nem aparece.

## Conferência rápida

```sql
select
  (select count(*) from public.catalog_templates) as modelos,      -- espera 36
  (select count(*) from public.profiles where is_platform_admin) as admins,  -- espera 1+
  (select count(*) from cron.job where jobname = 'zatto-time-automations') as agendador,  -- espera 1
  (select count(*) from public.teams) as filas;  -- espera 3 por cliente
```
