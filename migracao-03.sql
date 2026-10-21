-- =====================================================================
--  GOTAPURA CRM — Migração 03 (executar uma única vez, depois da 02)
--  Acrescenta: parametrização de facturas, facturas com linhas,
--  pipelines editáveis, assistente de IA, chatbot público, histórico.
-- =====================================================================

-- Parametrização dos documentos (cotações, pró-formas, facturas)
insert into settings (key, value) values ('documents', '{
  "accent":"#0B3C5D","prefix_quote":"COT","prefix_proforma":"FP","prefix_invoice":"FT",
  "default_vat":14,"payment_terms":"Pagamento a 30 dias por transferência bancária.",
  "footer":"","legal":"Os bens/serviços foram colocados à disposição do adquirente na data do documento.",
  "show_logo":true,"show_bank":true,"banks":[{"bank":"","iban":"","account":"","swift":""}]
}'::jsonb) on conflict (key) do nothing;

-- Facturas com linhas próprias (espelho do software certificado ou emitidas em pró-forma)
alter table invoices
  add column if not exists lines jsonb default '[]'::jsonb,
  add column if not exists currency text default 'AOA',
  add column if not exists subtotal numeric(14,2) default 0,
  add column if not exists tax numeric(14,2) default 0,
  add column if not exists notes text,
  add column if not exists kind text default 'factura',        -- factura | proforma | recibo | nota_credito
  add column if not exists created_by uuid references profiles(id) default auth.uid();
create sequence if not exists invoice_seq;
alter table invoices alter column number set default ('FT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 4, '0'));

-- Pipelines editáveis: várias pipelines, fases com cor
alter table stages add column if not exists color text;
alter table pipelines add column if not exists position int default 0;

-- Assistente de IA e chatbot público
insert into integrations (provider, label) values ('ai', 'Assistente de IA (Anthropic Claude)') on conflict (provider) do nothing;
create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade default auth.uid(),
  role text not null,                -- user | assistant
  content text not null,
  created_at timestamptz default now()
);
alter table assistant_messages enable row level security;
drop policy if exists p_own on assistant_messages;
create policy p_own on assistant_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists chat_sessions (                   -- conversas do chatbot do website
  id uuid primary key default gen_random_uuid(),
  visitor text, name text, phone text, email text,
  lead_id uuid references leads(id) on delete set null,
  messages jsonb not null default '[]'::jsonb,
  language text default 'pt',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table chat_sessions enable row level security;
drop policy if exists p_select on chat_sessions;
create policy p_select on chat_sessions for select to authenticated using (true);

-- Conhecimento do chatbot (perguntas frequentes editáveis em Definições)
insert into settings (key, value) values ('chatbot', '{
  "enabled":true,"greeting":"Olá! Sou o assistente da Gotapura. Posso ajudar com filtros, purificadores, manutenção e orçamentos.",
  "instructions":"Responda de forma curta e cordial em português de Angola. Quando o visitante quiser um orçamento ou visita, peça nome e telefone.",
  "faq":[{"q":"Que produtos vendem?","a":"Equipamentos de filtragem e purificação de água para casas e empresas, filtros, recargas e manutenção."}]
}'::jsonb) on conflict (key) do nothing;
drop policy if exists p_select_anon on settings;
create policy p_select_anon on settings for select to anon using (key in ('company','chatbot'));
