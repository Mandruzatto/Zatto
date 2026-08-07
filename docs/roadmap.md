# Roadmap do zaTTo (ITSM)

Documento vivo. Atualize ao final de cada sessão de trabalho.

Última atualização: 2026-08-06

## Princípios firmados

**E-mail é recurso escasso.** Notificar por e-mail só quem *não* está dentro do sistema
e só quando precisa agir. Volume alto faz a pessoa filtrar tudo — inclusive o que
importava. Analista vive no sistema: recebe sino, nunca e-mail de rotina. Ninguém é
notificado da própria ação, e eventos repetidos no mesmo chamado colapsam em um só.

Ciclo de vida típico: **2 e-mails** para o solicitante, **1** para o aprovador (se
houver aprovação), **zero** para o analista.

## Entregue

| | Detalhe |
|---|---|
| Aprovador livre | Deixa de ser obrigatório na abertura; card próprio com "Adicionar/Trocar aprovador", seleção livre de qualquer colaborador. Gestor é valor inicial de conveniência, nunca trava |
| CSAT | Nota 1–5 + comentário após finalizar, corrigível; analista vê no chamado |
| Ordenação por atividade | Coluna "Atualizado" ordenável; trigger passou a contar qualquer comentário como atividade (antes resposta de colaborador não contava) |
| Notificações in-app | Tabela `notifications` + 5 triggers, RLS por usuário, sino com realtime, sino também no portal do colaborador |

## Pendente

### Bloco 1 — E-mail no chamado
Composer estendendo a conversa existente (responder o chamado **é** mandar e-mail, como
no Freshservice): destinatários com Cc/Cco entre colaboradores cadastrados, rodapé
automático com link do chamado, envio por rota server-side com verificação de analista,
log entrando na conversa como mensagem pública.

- **Trava:** conta Resend + domínio verificado + `RESEND_API_KEY`
- **Modo teste:** redireciona todo envio para um endereço único até o domínio verificar

### Bloco 2 — Notificações por e-mail
Dispara os eventos acima pelo transporte do Bloco 1, respeitando o princípio de escassez.

- **SLA em risco/vencido** ficou de fora: é baseado em tempo passando, não em ação de
  alguém, então precisa de job agendado (pg_cron) em vez de trigger. Decisão pendente

### Bloco 3 — Relatórios e deflection
`/reports` com SLA compliance, tempo médio de resolução, volume por período, aging.
Sugestão de artigo da base antes de abrir chamado.

- **Trava real:** base vazia (ver "Conteúdo" abaixo)

### Bloco 4 — E-mail de entrada
Resposta de e-mail volta para o chamado; abrir chamado por e-mail. Sem isso, o
`Responder Para` do composer não fecha o ciclo. **Trava:** DNS/MX + inbound no provedor.

### Bloco 5 — Acabamento do composer
Rich text, respostas prontas, autosave de rascunho, "enviar e mudar status", anexos.

### Bloco 6 — Endurecimento
Três funções `SECURITY DEFINER` expostas via RPC para `anon`
(`is_ticket_approver`, `is_ticket_requester`, `log_ticket_status_change`) e proteção
contra senha vazada desligada no Auth.

## Conteúdo — o gargalo que não é código

Estado em 2026-08-06: **0 artigos** na base de conhecimento, **0 ativos** no inventário,
**0 perfis com gestor** definido.

Três funcionalidades prontas não entregam valor por causa disso: a busca do portal não
acha nada, o deflection não teria o que sugerir, os relatórios não teriam amostra, e o
auto-aprovador por gestor nunca dispara. Popular provavelmente vale mais que qualquer
bloco acima. Ajuda possível: importador de CSV para inventário, rascunho de artigos a
partir dos itens do catálogo.

## Fora do plano

- **Problem/Change Management** — só com volume de incidentes recorrentes que justifique
- **Acesso remoto** — pausado, ver `docs/remote-access.md`
