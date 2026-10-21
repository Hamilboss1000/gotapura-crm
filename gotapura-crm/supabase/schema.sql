-- =====================================================================
--  GOTAPURA CRM — Esquema da base de dados (Supabase / PostgreSQL)
--  Executar integralmente no SQL Editor do Supabase (uma única vez).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
do $$ begin
  create type user_role as enum ('admin','manager','agent','viewer');
exception when duplicate_object then null; end $$;

-- ---------- Utilizadores (perfil ligado a auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role user_role not null default 'agent',
  department text,                 -- administrativo | apoio | comercial | tecnico
  extension text,                  -- extensão telefónica (100, 200, 300, 400…)
  sip_uri text,                    -- sip:200@central.gotapura.ao
  sip_password text,
  wss_url text,                    -- wss://central.gotapura.ao:8089/ws
  language text not null default 'pt',
  active boolean not null default true,
  created_at timestamptz default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          case when (select count(*) from profiles) = 0 then 'admin'::user_role else 'agent'::user_role end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function current_role_of() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function is_admin() returns boolean
language sql stable as $$ select current_role_of() = 'admin' $$;
create or replace function can_write() returns boolean
language sql stable as $$ select current_role_of() in ('admin','manager','agent') $$;
create or replace function can_delete() returns boolean
language sql stable as $$ select current_role_of() in ('admin','manager') $$;

-- ---------- Núcleo CRM ----------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nif text,
  phone text, email text, website text,
  address text, city text, province text, country text default 'Angola',
  industry text, category text,           -- cliente | fornecedor | parceiro
  owner_id uuid references profiles(id),
  notes text,
  custom jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null, last_name text,
  organization_id uuid references organizations(id) on delete set null,
  job_title text, department text,
  email text, phone text, mobile text, whatsapp text,
  address text, city text, province text,
  language text default 'pt',
  source text,
  owner_id uuid references profiles(id),
  notes text,
  custom jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- pessoa de contacto
  organization_name text,
  email text, phone text, whatsapp text,
  source text,                              -- website | whatsapp | telefone | referência | feira | redes sociais
  status text not null default 'novo',      -- novo | contactado | qualificado | convertido | perdido
  interest text,                            -- produto/equipamento de interesse
  estimated_value numeric(14,2) default 0,
  owner_id uuid references profiles(id),
  converted_contact_id uuid references contacts(id),
  converted_opportunity_id uuid,
  notes text,
  custom jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text not null default 'opportunity',   -- opportunity | project
  is_default boolean default false
);
create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references pipelines(id) on delete cascade,
  name text not null, position int not null default 0,
  probability int default 0,               -- 0–100
  is_won boolean default false, is_lost boolean default false
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pipeline_id uuid references pipelines(id),
  stage_id uuid references stages(id),
  contact_id uuid references contacts(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  value numeric(14,2) default 0, currency text default 'AOA',
  probability int,
  expected_close date,
  status text not null default 'aberta',    -- aberta | ganha | perdida | suspensa
  lost_reason text,
  owner_id uuid references profiles(id),
  notes text,
  custom jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pipeline_id uuid references pipelines(id), stage_id uuid references stages(id),
  contact_id uuid references contacts(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete set null,
  status text default 'em curso',          -- em curso | concluído | cancelado
  start_date date, due_date date,
  owner_id uuid references profiles(id),
  notes text, custom jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- Tarefas (com recorrência) ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,
  due_time time,
  priority text not null default 'normal',  -- baixa | normal | alta | urgente
  status text not null default 'pendente',  -- pendente | em curso | concluida | cancelada
  category text,                            -- chamada | reuniao | email | visita | entrega | manutencao | outro
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id) default auth.uid(),
  linked_table text, linked_id uuid,        -- contacts | organizations | leads | opportunities | projects
  recurrence jsonb not null default '{"freq":"none"}'::jsonb,
  -- {"freq":"daily|weekdays|weekly|monthly|yearly","interval":1,"until":"2026-12-31"}
  parent_task_id uuid references tasks(id) on delete set null,
  completed_at timestamptz,
  reminder_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create or replace function next_due(d date, rec jsonb) returns date
language plpgsql immutable as $$
declare n int := greatest(coalesce((rec->>'interval')::int,1),1);
        f text := rec->>'freq'; r date; u date;
begin
  if d is null or f is null or f = 'none' then return null; end if;
  case f
    when 'daily'    then r := d + n;
    when 'weekdays' then r := d + 1; while extract(isodow from r) in (6,7) loop r := r + 1; end loop;
    when 'weekly'   then r := d + 7*n;
    when 'monthly'  then r := (d + (n||' months')::interval)::date;
    when 'yearly'   then r := (d + (n||' years')::interval)::date;
    else return null;
  end case;
  u := nullif(rec->>'until','')::date;
  if u is not null and r > u then return null; end if;
  return r;
end $$;

create or replace function on_task_completed() returns trigger
language plpgsql security definer set search_path = public as $$
declare nd date;
begin
  if new.status = 'concluida' and (old.status is distinct from 'concluida') then
    new.completed_at := now();
    nd := next_due(new.due_date, new.recurrence);
    if nd is not null then
      insert into tasks (title, description, due_date, due_time, priority, category, assigned_to, created_by,
                         linked_table, linked_id, recurrence, parent_task_id, reminder_at)
      values (new.title, new.description, nd, new.due_time, new.priority, new.category, new.assigned_to, new.created_by,
              new.linked_table, new.linked_id, new.recurrence, coalesce(new.parent_task_id, new.id),
              case when new.reminder_at is not null then new.reminder_at + make_interval(days => nd - new.due_date) else null end);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_task_completed on tasks;
create trigger trg_task_completed before update on tasks
  for each row execute function on_task_completed();

-- ---------- Actividades, chamadas, mensagens ----------
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- nota | chamada | email | whatsapp | reuniao | visita | sistema
  subject text, body text,
  linked_table text, linked_id uuid,
  contact_id uuid references contacts(id) on delete set null,
  user_id uuid references profiles(id) default auth.uid(),
  occurred_at timestamptz default now(),
  meta jsonb default '{}'::jsonb
);

create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  direction text not null,                  -- saida | entrada
  number text not null,
  contact_id uuid references contacts(id) on delete set null,
  user_id uuid references profiles(id) default auth.uid(),
  extension text,
  started_at timestamptz default now(), ended_at timestamptz,
  duration_seconds int,
  outcome text,                             -- atendida | sem resposta | ocupado | falhada
  notes text, recording_url text
);

create table if not exists messages (                       -- WhatsApp / SMS / e-mail
  id uuid primary key default gen_random_uuid(),
  channel text not null,                    -- whatsapp | sms | email
  direction text not null,                  -- entrada | saida
  from_number text, to_number text,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  body text, media_url text,
  external_id text unique,
  status text default 'enviada',            -- recebida | enviada | entregue | lida | falhada
  user_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- ---------- Produtos, cotações e facturação ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text unique, name text not null, description text,
  category text,                            -- equipamento | filtro | recarga | consumivel | servico
  unit text default 'un', price numeric(14,2) default 0, currency text default 'AOA',
  tax_rate numeric(5,2) default 14,         -- IVA Angola
  stock numeric(14,2), active boolean default true,
  custom jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  number serial,
  opportunity_id uuid references opportunities(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  status text default 'rascunho',           -- rascunho | enviada | aceite | rejeitada | facturada
  valid_until date, currency text default 'AOA',
  subtotal numeric(14,2) default 0, tax numeric(14,2) default 0, total numeric(14,2) default 0,
  notes text, language text default 'pt',
  invoice_external_id text,                 -- referência na plataforma de facturação certificada
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade,
  product_id uuid references products(id),
  description text, quantity numeric(14,2) default 1,
  unit_price numeric(14,2) default 0, tax_rate numeric(5,2) default 14, position int default 0
);

create table if not exists invoices (                       -- espelho local das facturas emitidas externamente
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete set null,
  contact_id uuid references contacts(id), organization_id uuid references organizations(id),
  external_id text unique, number text, provider text,
  issued_at date, due_at date, total numeric(14,2), paid numeric(14,2) default 0,
  status text default 'emitida',            -- emitida | paga | parcial | anulada
  pdf_url text, raw jsonb, created_at timestamptz default now()
);

-- ---------- Gestão documental ----------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  name text not null, storage_path text not null,
  mime text, size_bytes bigint,
  folder text default '/',                  -- /contratos, /propostas, /manuais…
  language text default 'pt',
  version int default 1,
  linked_table text, linked_id uuid,
  tags text[] default '{}',
  uploaded_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

-- ---------- Redes sociais e website ----------
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  channel text not null,                    -- facebook | instagram | linkedin | tiktok | x
  content text, media_url text, language text default 'pt',
  scheduled_at timestamptz, published_at timestamptz,
  status text default 'rascunho',           -- rascunho | agendada | publicada | falhada
  external_id text, error text,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists website_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null, language text not null default 'pt',
  title text not null, blocks jsonb not null default '[]'::jsonb,
  published boolean default false,
  updated_at timestamptz default now(),
  unique (slug, language)
);

-- ---------- Automações ----------
create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_table text not null,              -- leads | contacts | opportunities | tasks | organizations
  trigger_event text not null default 'insert',   -- insert | update
  conditions jsonb not null default '[]'::jsonb,  -- [{"field":"status","op":"eq","value":"qualificado"}]
  actions jsonb not null default '[]'::jsonb,
  -- [{"type":"create_task","title":"Ligar ao cliente","days":1,"assign":"owner"},
  --  {"type":"set_field","field":"status","value":"contactado"},
  --  {"type":"notify","message":"Novo lead qualificado"}]
  active boolean default true,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create table if not exists automation_logs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  record_table text, record_id uuid, ok boolean, detail text,
  created_at timestamptz default now()
);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text, body text, link text,
  read boolean default false,
  created_at timestamptz default now()
);

create or replace function run_automations() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; c jsonb; act jsonb; rec jsonb := to_jsonb(new); ok boolean; v text; d int; target uuid;
begin
  if coalesce(current_setting('crm.in_automation', true), '') = '1' then return new; end if;
  for a in select * from automations
           where active and trigger_table = tg_table_name and trigger_event = lower(tg_op) loop
    ok := true;
    for c in select * from jsonb_array_elements(a.conditions) loop
      v := rec->>(c->>'field');
      case coalesce(c->>'op','eq')
        when 'eq'       then ok := ok and coalesce(v = c->>'value', false);
        when 'neq'      then ok := ok and (v is distinct from c->>'value');
        when 'contains' then ok := ok and coalesce(v ilike '%'||(c->>'value')||'%', false);
        when 'empty'    then ok := ok and (v is null or v = '');
        when 'not_empty' then ok := ok and (v is not null and v <> '');
        when 'changed'  then ok := ok and (tg_op = 'UPDATE' and (to_jsonb(old)->>(c->>'field')) is distinct from v);
        else ok := false;
      end case;
      exit when not ok;
    end loop;
    if not ok then continue; end if;
    perform set_config('crm.in_automation','1', true);
    begin
      for act in select * from jsonb_array_elements(a.actions) loop
        case act->>'type'
          when 'create_task' then
            d := coalesce((act->>'days')::int, 0);
            target := case when act->>'assign' = 'owner' then nullif(rec->>'owner_id','')::uuid
                           when act->>'assign' = 'assigned' then nullif(rec->>'assigned_to','')::uuid
                           else nullif(act->>'assign','')::uuid end;
            insert into tasks (title, description, due_date, priority, category, assigned_to, created_by, linked_table, linked_id)
            values (coalesce(act->>'title','Tarefa automática'), act->>'description', current_date + d,
                    coalesce(act->>'priority','normal'), act->>'category', target, a.created_by, tg_table_name, new.id);
          when 'set_field' then
            execute format('update %I set %I = %L where id = %L', tg_table_name, act->>'field', act->>'value', new.id);
          when 'notify' then
            insert into notifications (user_id, title, body, link)
            select p.id, a.name, coalesce(act->>'message', a.name), '/'||tg_table_name||'/'||new.id
            from profiles p where p.active and (act->>'to' is null or act->>'to' = 'all'
                 or (act->>'to' = 'owner' and p.id = nullif(rec->>'owner_id','')::uuid)
                 or (act->>'to' = 'admins' and p.role = 'admin'));
          when 'log_activity' then
            insert into activities (kind, subject, linked_table, linked_id, user_id)
            values ('sistema', coalesce(act->>'message', a.name), tg_table_name, new.id, a.created_by);
          else null;
        end case;
      end loop;
      insert into automation_logs (automation_id, record_table, record_id, ok) values (a.id, tg_table_name, new.id, true);
    exception when others then
      insert into automation_logs (automation_id, record_table, record_id, ok, detail) values (a.id, tg_table_name, new.id, false, sqlerrm);
    end;
    perform set_config('crm.in_automation','', true);
  end loop;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['leads','contacts','organizations','opportunities','tasks','projects'] loop
    execute format('drop trigger if exists trg_auto_%s on %I', t, t);
    execute format('create trigger trg_auto_%s after insert or update on %I for each row execute function run_automations()', t, t);
  end loop;
end $$;

-- ---------- Integrações e API ----------
create table if not exists integrations (
  provider text primary key,                -- whatsapp | facebook | instagram | linkedin | invoicing | email | pbx
  label text, config jsonb not null default '{}'::jsonb, active boolean default false,
  updated_at timestamptz default now()
);
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null, prefix text not null, key_hash text not null,
  scopes text[] default '{read}', active boolean default true,
  created_by uuid references profiles(id) default auth.uid(),
  last_used_at timestamptz, created_at timestamptz default now()
);
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  url text not null, events text[] not null,  -- lead.created, opportunity.won, quote.accepted…
  secret text, active boolean default true,
  created_at timestamptz default now()
);
create table if not exists audit_log (
  id bigserial primary key,
  table_name text, record_id uuid, action text, user_id uuid, diff jsonb,
  created_at timestamptz default now()
);

create or replace function audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, record_id, action, user_id, diff)
  values (tg_table_name, coalesce(new.id, old.id), tg_op, auth.uid(),
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['organizations','contacts','leads','opportunities','projects','tasks'] loop
    execute format('drop trigger if exists trg_touch_%s on %I', t, t);
    execute format('create trigger trg_touch_%s before update on %I for each row execute function touch_updated_at()', t, t);
    execute format('drop trigger if exists trg_audit_%s on %I', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;

-- ---------- Segurança (RLS) ----------
do $$ declare t text; begin
  foreach t in array array['profiles','organizations','contacts','leads','pipelines','stages','opportunities','projects',
    'tasks','activities','call_logs','messages','products','quotes','quote_items','invoices','documents','social_posts',
    'website_pages','automations','automation_logs','notifications','integrations','api_keys','webhooks','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists p_select on %I', t);
    execute format('create policy p_select on %I for select to authenticated using (true)', t);
    execute format('drop policy if exists p_insert on %I', t);
    execute format('create policy p_insert on %I for insert to authenticated with check (can_write())', t);
    execute format('drop policy if exists p_update on %I', t);
    execute format('create policy p_update on %I for update to authenticated using (can_write())', t);
    execute format('drop policy if exists p_delete on %I', t);
    execute format('create policy p_delete on %I for delete to authenticated using (can_delete())', t);
  end loop;
end $$;

-- Perfis: cada utilizador edita o seu; o administrador edita todos (funções, estado, extensões)
drop policy if exists p_update on profiles;
create policy p_update on profiles for update to authenticated using (id = auth.uid() or is_admin());
drop policy if exists p_delete on profiles;
create policy p_delete on profiles for delete to authenticated using (is_admin());
-- Só administradores alteram função e estado de um perfil
create or replace function guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) and not is_admin() then
    raise exception 'Apenas administradores alteram funções e estados';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile on profiles;
create trigger trg_guard_profile before update on profiles for each row execute function guard_profile();
-- Formulário do website (chave anónima): apenas cria leads com origem "website"
drop policy if exists p_anon_lead on leads;
create policy p_anon_lead on leads for insert to anon with check (source = 'website');
-- Integrações, chaves de API e webhooks: apenas administradores alteram
do $$ declare t text; begin
  foreach t in array array['integrations','api_keys','webhooks'] loop
    execute format('drop policy if exists p_insert on %I', t);
    execute format('create policy p_insert on %I for insert to authenticated with check (is_admin())', t);
    execute format('drop policy if exists p_update on %I', t);
    execute format('create policy p_update on %I for update to authenticated using (is_admin())', t);
    execute format('drop policy if exists p_delete on %I', t);
    execute format('create policy p_delete on %I for delete to authenticated using (is_admin())', t);
  end loop;
end $$;
-- Notificações: cada utilizador vê e actualiza apenas as suas
drop policy if exists p_select on notifications;
create policy p_select on notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists p_update on notifications;
create policy p_update on notifications for update to authenticated using (user_id = auth.uid());

-- ---------- Armazenamento de documentos ----------
insert into storage.buckets (id, name, public) values ('documents','documents', false)
on conflict (id) do nothing;
drop policy if exists "docs_read" on storage.objects;
create policy "docs_read" on storage.objects for select to authenticated using (bucket_id = 'documents');
drop policy if exists "docs_write" on storage.objects;
create policy "docs_write" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and can_write());
drop policy if exists "docs_delete" on storage.objects;
create policy "docs_delete" on storage.objects for delete to authenticated using (bucket_id = 'documents' and can_delete());

-- ---------- Tempo real ----------
do $$ begin
  alter publication supabase_realtime add table notifications;
  alter publication supabase_realtime add table messages;
  alter publication supabase_realtime add table tasks;
  alter publication supabase_realtime add table opportunities;
exception when others then null; end $$;

-- ---------- Dados iniciais ----------
insert into pipelines (id, name, kind, is_default)
values ('11111111-1111-1111-1111-111111111111','Vendas','opportunity',true)
on conflict (id) do nothing;
insert into stages (pipeline_id, name, position, probability, is_won, is_lost)
select '11111111-1111-1111-1111-111111111111'::uuid, s.name, s.pos, s.prob, s.won, s.lost from (values
  ('Qualificação',1,10,false,false),('Proposta enviada',2,40,false,false),('Negociação',3,70,false,false),
  ('Ganha',4,100,true,false),('Perdida',5,0,false,true)) as s(name,pos,prob,won,lost)
where not exists (select 1 from stages where pipeline_id = '11111111-1111-1111-1111-111111111111');

insert into integrations (provider, label) values
  ('pbx','Central telefónica (SIP/WebRTC)'),('whatsapp','WhatsApp Business (Cloud API)'),
  ('facebook','Facebook'),('instagram','Instagram'),('linkedin','LinkedIn'),
  ('invoicing','Facturação certificada (AGT)'),('email','E-mail (SMTP/IMAP)')
on conflict (provider) do nothing;

-- Automação de exemplo: lead qualificado → tarefa de contacto no dia seguinte + notificação
insert into automations (name, trigger_table, trigger_event, conditions, actions)
select 'Lead qualificado → tarefa de contacto', 'leads', 'update',
  '[{"field":"status","op":"eq","value":"qualificado"},{"field":"status","op":"changed"}]'::jsonb,
  '[{"type":"create_task","title":"Contactar lead qualificado","days":1,"assign":"owner","category":"chamada","priority":"alta"},
    {"type":"notify","to":"owner","message":"Um lead foi qualificado e tem uma tarefa de contacto atribuída."}]'::jsonb
where not exists (select 1 from automations);
