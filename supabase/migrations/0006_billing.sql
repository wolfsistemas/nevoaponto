-- PontoFlow - billing (Mercado Pago) + protecao de privilegios de perfil
-- Rodar depois de 0005_multitenant.sql.

-- ---------------------------------------------------------------------------
-- Protege campos sensiveis de profiles contra auto-escalonamento de privilegio
-- (um funcionario nao pode virar admin/superadmin via update direto no proprio
-- perfil, nem trocar de empresa). Admin da empresa continua gerenciando a
-- equipe; superadmin e a service_role continuam livres.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_perfil()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Service role / jobs internos (auth.uid() nulo) e superadmin podem tudo.
  if auth.uid() is null or public.app_superadmin() then
    return new;
  end if;

  if new.id <> old.id then
    raise exception 'Nao e permitido alterar o id do perfil.';
  end if;

  if new.role = 'superadmin' and new.role is distinct from old.role then
    raise exception 'Nao e permitido conceder acesso de superadmin.';
  end if;

  if new.role is distinct from old.role
     or new.empresa_id is distinct from old.empresa_id
     or new.ativo is distinct from old.ativo
     or new.login is distinct from old.login
     or new.email is distinct from old.email
     or new.colaborador_id is distinct from old.colaborador_id
     or new.obra_id is distinct from old.obra_id then
    -- Admin da empresa pode gerenciar outros perfis da propria empresa.
    if not (
      public.app_role() = 'admin'
      and old.id <> auth.uid()
      and old.empresa_id = public.app_empresa()
    ) then
      raise exception 'Nao e permitido alterar campos de privilegio do proprio perfil.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_proteger_perfil on public.profiles;
create trigger trg_proteger_perfil
  before update on public.profiles
  for each row execute function public.proteger_perfil();

-- ---------------------------------------------------------------------------
-- Billing - Mercado Pago
-- ---------------------------------------------------------------------------
alter table public.empresas add column if not exists mp_customer_id text;
alter table public.empresas add column if not exists mp_preapproval_id text;

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  plano_id text not null references public.planos(id),
  status text not null default 'pendente'
    check (status in ('pendente', 'autorizada', 'pausada', 'cancelada', 'expirada')),
  valor numeric(12,2) not null default 0,
  mp_preapproval_id text,
  mp_external_reference text,
  init_point text,
  periodo_inicio timestamptz,
  periodo_fim timestamptz,
  proxima_cobranca timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assinaturas_empresa_uidx on public.assinaturas (empresa_id);
create index if not exists assinaturas_mp_idx on public.assinaturas (mp_preapproval_id);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  assinatura_id uuid references public.assinaturas(id) on delete set null,
  mp_payment_id text,
  mp_preapproval_id text,
  plano_id text,
  status text not null default 'pendente',
  valor numeric(12,2) not null default 0,
  moeda text not null default 'BRL',
  metodo text,
  pago_em timestamptz,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pagamentos_mp_payment_uidx
  on public.pagamentos (mp_payment_id) where mp_payment_id is not null;
create index if not exists pagamentos_empresa_idx
  on public.pagamentos (empresa_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_assinaturas on public.assinaturas;
create trigger trg_touch_assinaturas
  before update on public.assinaturas
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_pagamentos on public.pagamentos;
create trigger trg_touch_pagamentos
  before update on public.pagamentos
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: leitura pelo admin da propria empresa; escrita apenas via service_role
-- (Edge Functions) ou superadmin.
-- ---------------------------------------------------------------------------
alter table public.assinaturas enable row level security;
alter table public.pagamentos enable row level security;

drop policy if exists assinaturas_superadmin on public.assinaturas;
create policy assinaturas_superadmin on public.assinaturas
  for all using (public.app_superadmin()) with check (public.app_superadmin());

drop policy if exists assinaturas_admin_select on public.assinaturas;
create policy assinaturas_admin_select on public.assinaturas
  for select using (empresa_id = public.app_empresa());

drop policy if exists pagamentos_superadmin on public.pagamentos;
create policy pagamentos_superadmin on public.pagamentos
  for all using (public.app_superadmin()) with check (public.app_superadmin());

drop policy if exists pagamentos_admin_select on public.pagamentos;
create policy pagamentos_admin_select on public.pagamentos
  for select using (empresa_id = public.app_empresa());
