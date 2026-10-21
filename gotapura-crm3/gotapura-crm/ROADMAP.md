# Plano de evolução — Gotapura CRM

## Fase 1 — Entregue nesta versão
Núcleo completo (Leads, Contactos, Organizações, Oportunidades Kanban, Projectos, Tarefas recorrentes, Produtos, Cotações), gestão documental, utilizadores ilimitados com funções e permissões, motor de automações, importação em massa a partir de Excel/CSV, softphone SIP/WebRTC com registo de chamadas, caixa WhatsApp, calendário de redes sociais, construtor de website, integrações/API/webhooks, interface PT/EN, auditoria.

## Fase 2 — Activação das integrações (requer contas externas)
- Central telefónica: activar WebRTC, criar extensões, testar chamadas de e para o CRM; gravações associadas às chamadas.
- WhatsApp Business: conta Meta verificada, modelos de mensagem aprovados, envio de ficheiros e imagens.
- Facturação: escolha do software certificado AGT e adaptação da função `invoicing-sync`; recepção de estados de pagamento.
- E-mail: envio a partir do CRM (SMTP) e registo de e-mails recebidos nas fichas (IMAP).
- Redes sociais: tokens de página e aprovação das apps Meta/LinkedIn; TikTok e X quando necessário.

## Fase 3 — Produtividade e análise
- Relatórios configuráveis e exportação (Excel/PDF): vendas por período, por comercial, por produto, por origem; tempo de resposta a leads.
- Campos personalizados por módulo (já suportados na base de dados em `custom`), listas guardadas e filtros avançados.
- Modelos de cotação e propostas em PDF bilingues com a identidade Gotapura.
- Calendário partilhado (visitas, instalações, manutenções) e aplicação móvel (PWA instalável).

## Fase 4 — Inteligência artificial (10.º módulo)
- Agentes por departamento: qualificação automática de leads vindos do website e WhatsApp, resumo de chamadas, sugestão da próxima acção, respostas iniciais no WhatsApp fora do horário.
- Tradução automática PT↔EN de documentos, páginas e publicações.
- Previsão de fecho de oportunidades e alertas de inactividade de clientes.

## Fase 5 — Website público
- Alojamento das páginas exportadas (Vercel, no mesmo projecto ou num segundo) com domínio próprio gotapura.ao, formulários ligados ao CRM, versões PT e EN, catálogo de produtos sincronizado.
