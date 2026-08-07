# Acesso remoto nativo (zaTTo)

Documento vivo. Atualize ao final de cada sessão de trabalho sobre este tema, para não perder o fio em outro chat.

## Status atual

| Item | Estado |
|---|---|
| Decisão de produto | **Reaberta em 2026-08-06** — ver "Revisão da abordagem" |
| Agendamento no chamado | Feito (MVP UI + tabela `remote_sessions`) |
| Viewer WebRTC / agente / TURN / UAC | **Não iniciado** |
| Próxima fase | **Pausado** — foco no ITSM. Retomar decidindo motor (próprio × pronto) |

Última atualização: 2026-08-06

> **Atenção:** o plano em `.cursor/plans/built-in_remote_access_2bdb4478.plan.md`, citado
> mais abaixo, **não existe no repositório** — nunca foi commitado ou foi perdido.

## Revisão da abordagem (2026-08-06)

A decisão de construir o motor do zero foi questionada e **não deve ser retomada sem
antes avaliar embutir um motor pronto**. O que motivou:

**A estimativa de UAC estava errada por uma ordem de grandeza.** O roadmap abaixo prevê
3–6 semanas para a Fase 3. O MeshCentral — projeto maduro, anos de desenvolvimento,
agente Windows próprio rodando como serviço — ainda tem issues abertas exatamente aí:
a sessão congela no prompt de UAC e o controle se perde no Secure Desktop
([#7291](https://github.com/Ylianst/MeshCentral/issues/7291),
[#3167](https://github.com/Ylianst/MeshCentral/issues/3167),
[#1616](https://github.com/Ylianst/MeshCentral/issues/1616)).

**O valor do zaTTo não está nos pixels.** Está no que já existe: sessão agendada dentro
do chamado, consentimento, janela de autorização, auditoria, status no kanban. Capturar
tela, codificar vídeo, injetar input e lidar com Secure Desktop é commodity resolvida.

**Segurança:** um agente SYSTEM escrito do zero, sem auditoria externa, em todas as
máquinas da empresa, é superfície de ataque para comprometimento de domínio. As
alternativas também falham — mas falham em público, com CVE e correção.

### Opções levantadas

| Opção | UAC | Licença | Observação |
|---|---|---|---|
| **RustDesk auto-hospedado** | Elevação [documentada e funcionando](https://rustdesk.com/docs/en/client/windows/windows-portable-elevation/) | AGPL-3.0 ([comercial disponível](https://github.com/rustdesk/rustdesk/wiki/FAQ)) | Recomendado. AGPL contamina se o zaTTo virar produto vendido |
| **MeshCentral** | Ponto fraco (issues acima) | Apache 2.0, livre p/ uso proprietário | Licença melhor, mas falha no requisito nº 1 |
| **Guacamole + RDP** | Nativo do Windows | Apache 2.0 | Sem agente, mas RDP abre sessão separada; suporte assistido exige shadowing + Win Pro + domínio |
| **Construir do zero** | — | — | Só se acesso remoto for o produto, não uma funcionalidade |

### O que se mantém do plano original
Tudo que é específico do zaTTo: modelo de sessão, token com janela válida, presença do
agente, viewer embutido no chamado, kill switch, auditoria. Muda só o motor por trás do
viewer.

### Pergunta em aberto
Acesso remoto é o produto ou uma funcionalidade do ITSM? A resposta define se vale
reabrir a construção própria.

## Objetivo

Colaborador agenda sessão no chamado → autoriza no horário → analista entra **dentro do zaTTo** e controla o PC (incluindo prompts de admin/UAC). Agente instalado no Windows do colaborador.

## Decisões fechadas

1. **Produto próprio** integrado ao chamado (não só abrir AnyDesk).
2. **Controle total** no MVP (mouse + teclado). Só visualizar não serve.
3. **Admin/UAC é requisito** — agente Windows com **serviço elevado** (não só app de bandeja).
4. **Instalar agente nos PCs** é aceitável / desejável.
5. **Windows primeiro**; macOS/Linux depois.
6. Stack alvo: WebRTC + sinalização Supabase + TURN + serviço Windows + viewer no Next.js.
7. Não clonar protocolo AnyDesk do zero.

## O que já existe no código

- Migration: `supabase/migrations/20260729230000_remote_sessions.sql`
- UI: `src/components/remote-session-panel.tsx` (analista + colaborador)
- Helpers: `src/lib/remote-sessions.ts`, tipos em `src/lib/types.ts`
- Chips/filtros: header, lista (`?remote=`), dashboard widget
- Hoje o painel ainda fala em AnyDesk/link — isso será trocado por WebRTC na fase 1

Fluxo de status atual da sessão:

`proposed → confirmed → ready → in_progress → done | cancelled`

## Arquitetura alvo (resumo)

```
Colaborador (agente Windows elevado)
        |  WebRTC (+ TURN se necessário)
        v
Analista (browser no zaTTo)
        |
        v
Supabase (auth, remote_sessions, Realtime signaling, tokens)
```

Componentes do agente:

| Peça | Papel |
|---|---|
| Serviço Windows (SYSTEM/elevado) | Captura (incl. UAC), input, sessão |
| App tray | “Conectado”, autorizar/encerrar para o usuário |
| Instalador MSI | Requer admin na instalação |

## Roadmap — próximos passos para iniciar

### Fase 0 — Kickoff (esta semana)
- [ ] Congelar escopo MVP (este doc)
- [ ] Criar pasta `apps/remote-agent/` (placeholder do agente)
- [ ] Evoluir `remote_sessions`: `access_method` default `webrtc`, campos de token/presence se preciso
- [ ] Remover dependência de UX “AnyDesk” no painel (copy → “agente zaTTo”)
- [ ] Definir provedor TURN para testes (coturn self-host **ou** serviço gerenciado)

### Fase 1 — Sessão + signaling (sem tela ainda)
- [ ] Edge Function / API: emitir token de sessão curto só se `ready|in_progress` + janela válida
- [ ] Tabela/canal Realtime `remote_session_signals` (SDP/ICE)
- [ ] Página viewer: `/tickets/[id]/remote/[sessionId]` (UI + peer connection stub)
- [ ] Agente mínimo: autentica, registra “online”, troca signaling fake/local

### Fase 2 — Tela + controle (sessão do usuário)
- [ ] Captura de tela no agente
- [ ] Stream WebRTC para o viewer
- [ ] Input remoto (mouse/teclado) na sessão do usuário logado
- [ ] Kill switch nos dois lados

### Fase 3 — Elevação / UAC (requisito corporativo)
- [ ] Serviço Windows elevado
- [ ] Captura/input no Secure Desktop (UAC)
- [ ] Instalador MSI
- [ ] Teste: instalar app que pede admin + digitar senha via sessão remota

### Fase 4 — Rede e endurecimento
- [ ] TURN em produção
- [ ] Testes em NAT/firewall corporativo
- [ ] Reconexão, logs de auditoria, qualidade adaptativa

## Estimativa

| Bloco | Tempo |
|---|---|
| Fase 0–1 | 1–2 semanas |
| Fase 2 | 3–5 semanas |
| Fase 3 (UAC) | 3–6 semanas |
| Fase 4 | 1–4 semanas |
| **MVP usável com admin** | **~3–5 meses** |

## Fora do MVP

- macOS/Linux
- Gravação de sessão
- Transferência de arquivo
- Sessão desatendida sem usuário na frente
- Deploy em massa GPO/Intune (desejável cedo, não bloqueia protótipo)

## Como continuar em outro chat

Cole isto (ou aponte o arquivo):

> Continuar o acesso remoto nativo do zaTTo. Ler `docs/remote-access.md` e o plano em `.cursor/plans/built-in_remote_access_2bdb4478.plan.md`. Não reinventar decisões fechadas. Atualizar `docs/remote-access.md` ao final do trabalho.

## Log de sessões

### 2026-08-06
- Abordagem reaberta: avaliar motor pronto antes de construir do zero (ver "Revisão da abordagem").
- Evidência decisiva: MeshCentral, projeto maduro, ainda tem UAC/Secure Desktop quebrado.
- RustDesk auto-hospedado é a alternativa mais forte; ressalva de licença AGPL.
- Tema **pausado** — foco voltou para o ITSM (e-mail, relatórios, base de conhecimento).

### 2026-07-29
- Produto: remoto próprio, não bridge AnyDesk.
- Fechado: controle total + UAC via serviço elevado; instalação de agente ok.
- Já existe agendamento `remote_sessions` + UI.
- Próximo: Fase 0 kickoff (evoluir modelo/copy + pasta do agente + decisão TURN).
