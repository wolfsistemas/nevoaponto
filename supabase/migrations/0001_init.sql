-- PontoFlow - schema inicial (projeto Supabase novo)
-- Aplicar em um projeto Supabase limpo: supabase db push ou SQL Editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'encarregado', 'funcionario');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_contrato as enum ('CLT', 'DIARISTA', 'TERCEIRIZADO', 'EMPREITA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_ponto as enum ('ENTRADA', 'SAIDA', 'AJUSTE_MANUAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_ponto as enum ('PENDENTE', 'VALIDADO', 'RECUSADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_fechamento as enum ('ABERTO', 'FECHADO', 'PAGO', 'ESTORNADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_lancamento as enum ('RECEITA', 'DESPESA');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Perfis (extensao de auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  login text not null unique,
  role user_role not null default 'funcionario',
  obra_id uuid,
  colaborador_id uuid,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Obras
-- ---------------------------------------------------------------------------
create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  lat double precision,
  lng double precision,
  raio_tolerancia integer not null default 80,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Colaboradores (equipe propria, diaristas, terceirizados, empreiteiros)
-- ---------------------------------------------------------------------------
create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  rg text,
  telefone text,
  endereco text,
  chave_pix text,
  cargo text,
  obra_id uuid references public.obras(id) on delete set null,
  matricula integer,
  tipo_contrato tipo_contrato not null default 'DIARISTA',
  salario_base numeric(12,2),
  valor_diaria numeric(12,2),
  valor_metro numeric(12,2),
  dependentes integer not null default 0,
  recebe_vale_transporte boolean not null default false,
  data_contrato date,
  contrato_assinado boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_obra_fk') then
    alter table public.profiles
      add constraint profiles_obra_fk foreign key (obra_id)
      references public.obras(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_colaborador_fk') then
    alter table public.profiles
      add constraint profiles_colaborador_fk foreign key (colaborador_id)
      references public.colaboradores(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Pontos
-- ---------------------------------------------------------------------------
create table if not exists public.pontos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete set null,
  tipo tipo_ponto not null,
  hora_registro timestamptz not null default now(),
  fracao_diaria numeric(4,2),
  status status_ponto not null default 'PENDENTE',
  origem text not null default 'APP',
  lat_registro text,
  lng_registro text,
  pago_em_fechamento boolean not null default false,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists pontos_colaborador_idx on public.pontos (colaborador_id, hora_registro);
create index if not exists pontos_status_idx on public.pontos (status);
create index if not exists pontos_obra_idx on public.pontos (obra_id);

-- ---------------------------------------------------------------------------
-- Producao de terceirizados / empreita (metros)
-- ---------------------------------------------------------------------------
create table if not exists public.producao (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete set null,
  data_registro date not null default current_date,
  metros numeric(12,2) not null default 0,
  valor_metro numeric(12,2) not null default 0,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'FECHADO', 'PAGO')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fechamentos
-- ---------------------------------------------------------------------------
create table if not exists public.fechamentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete set null,
  periodo_inicio date not null,
  periodo_fim date not null,
  total_diarias numeric(8,2) not null default 0,
  valor_diaria numeric(12,2) not null default 0,
  valor_bruto numeric(12,2) not null default 0,
  total_descontos numeric(12,2) not null default 0,
  total_encargos numeric(12,2) not null default 0,
  valor_liquido numeric(12,2) not null default 0,
  status status_fechamento not null default 'FECHADO',
  data_fechamento timestamptz,
  data_pagamento timestamptz,
  observacao text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lancamentos financeiros
-- ---------------------------------------------------------------------------
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references public.obras(id) on delete set null,
  tipo tipo_lancamento not null default 'DESPESA',
  categoria text not null default 'Mao de Obra',
  descricao text not null,
  valor numeric(12,2) not null default 0,
  data timestamptz not null default now(),
  status text not null default 'PENDENTE',
  referencia text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Itens de folha (snapshot da competencia)
-- ---------------------------------------------------------------------------
create table if not exists public.folha_itens (
  id uuid primary key default gen_random_uuid(),
  competencia text not null,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  total_diarias numeric(8,2) not null default 0,
  total_metros numeric(12,2) not null default 0,
  total_proventos numeric(12,2) not null default 0,
  total_descontos numeric(12,2) not null default 0,
  total_encargos numeric(12,2) not null default 0,
  valor_liquido numeric(12,2) not null default 0,
  status status_fechamento not null default 'ABERTO',
  detalhe jsonb,
  created_at timestamptz not null default now(),
  unique (competencia, colaborador_id)
);

-- ---------------------------------------------------------------------------
-- Helpers de autorizacao
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.app_obra()
returns uuid
language sql stable security definer set search_path = public
as $$
  select obra_id from public.profiles where id = auth.uid();
$$;

create or replace function public.app_colaborador()
returns uuid
language sql stable security definer set search_path = public
as $$
  select colaborador_id from public.profiles where id = auth.uid();
$$;
