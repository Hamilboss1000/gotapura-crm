-- =====================================================================
--  GOTAPURA CRM — Migração 02 (executar no SQL Editor, uma única vez,
--  em projectos que já correram o schema.sql original)
--  Acrescenta: dados de empresa e logótipo, multimoeda, campos
--  personalizados, etiquetas, dados adicionais de perfil.
-- =====================================================================

-- Perfil com mais dados
alter table profiles
  add column if not exists phone text,
  add column if not exists mobile text,
  add column if not exists job_title text,
  add column if not exists notes text,
  add column if not exists avatar_url text;

-- Definições gerais (empresa, logótipo, moeda base, …)
create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
insert into settings (key, value) values ('company', '{"name":"Gotapura","tagline":"Tratamento de água","logo_url":null,"nif":"","address":"","phone":"","email":"","base_currency":"AOA"}'::jsonb)
on conflict (key) do nothing;

-- Moedas: rate = quantas unidades da moeda base (AOA) vale 1 unidade desta moeda
create table if not exists currencies (
  code text primary key,
  symbol text not null,
  name text not null,
  rate numeric(18,6) not null default 1,
  is_base boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz default now()
);
insert into currencies (code, symbol, name, rate, is_base) values
  ('AOA','Kz','Kwanza',1,true),
  ('USD','$','Dólar americano',900,false),
  ('EUR','€','Euro',1000,false)
on conflict (code) do nothing;

-- Campos personalizados por módulo (guardados na coluna "custom" de cada registo)
create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  module text not null,            -- tasks | contacts | organizations | leads | opportunities | projects | products
  key text not null,
  label text not null,
  type text not null default 'text',   -- text | number | date | select | checkbox | textarea
  options text[] default '{}',
  required boolean default false,
  position int default 0,
  unique (module, key)
);

-- Etiquetas e campos personalizados nas tarefas e restantes módulos
do $$ declare t text; begin
  foreach t in array array['tasks','contacts','organizations','leads','opportunities','projects','products'] loop
    execute format('alter table %I add column if not exists tags text[] default ''{}''', t);
    execute format('alter table %I add column if not exists custom jsonb default ''{}''::jsonb', t);
  end loop;
end $$;

-- Permissões das novas tabelas: todos lêem; só administradores alteram
do $$ declare t text; begin
  foreach t in array array['settings','currencies','custom_fields'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists p_select on %I', t);
    execute format('create policy p_select on %I for select to authenticated using (true)', t);
    execute format('drop policy if exists p_insert on %I', t);
    execute format('create policy p_insert on %I for insert to authenticated with check (is_admin())', t);
    execute format('drop policy if exists p_update on %I', t);
    execute format('create policy p_update on %I for update to authenticated using (is_admin())', t);
    execute format('drop policy if exists p_delete on %I', t);
    execute format('create policy p_delete on %I for delete to authenticated using (is_admin())', t);
  end loop;
end $$;

-- Logótipo e imagens públicas (bucket público "branding")
insert into storage.buckets (id, name, public) values ('branding','branding', true)
on conflict (id) do nothing;
drop policy if exists "branding_read" on storage.objects;
create policy "branding_read" on storage.objects for select using (bucket_id = 'branding');
drop policy if exists "branding_write" on storage.objects;
create policy "branding_write" on storage.objects for insert to authenticated with check (bucket_id = 'branding' and is_admin());
drop policy if exists "branding_update" on storage.objects;
create policy "branding_update" on storage.objects for update to authenticated using (bucket_id = 'branding' and is_admin());
drop policy if exists "branding_delete" on storage.objects;
create policy "branding_delete" on storage.objects for delete to authenticated using (bucket_id = 'branding' and is_admin());

-- O administrador pode eliminar perfis (o utilizador de autenticação é removido pela função admin-users)
drop policy if exists p_delete on profiles;
create policy p_delete on profiles for delete to authenticated using (is_admin());

-- A página de entrada mostra o logótipo antes do início de sessão
drop policy if exists p_select_anon on settings;
create policy p_select_anon on settings for select to anon using (key = 'company');

-- A função de servidor admin-users (chave de serviço) pode definir funções e estados
create or replace function guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Apenas administradores alteram funções e estados';
  end if;
  return new;
end $$;
