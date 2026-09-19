-- PontoFlow - multitenant, superadmin, auditoria e confirmacao de ponto
-- Rodar depois de 0004_superadmin_enum.sql.

-- ---------------------------------------------------------------------------
-- Empresas (tenants)
-- ---------------------------------------------------------------------------
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  email_contato text,
  telefone text,
  plano text not null default 'trial',
  status text not null default 'trial' check (status in ('trial', 'ativo', 'suspenso', 'cancelado')),
  trial_ate date,
  valor_mensal numeric(12,2) not null default 0,
  termos_aceitos_em timestamptz,
  termos_versao text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalogo de planos (para o super admin e a landing)
-- ---------------------------------------------------------------------------
create table if not exists public.planos (
  id text primary key,
  nome text not null,
  valor_mensal numeric(12,2) not null default 0,
  limite_colaboradores integer,
  limite_obras integer,
  recursos jsonb not null default '[]'::jsonb,
  destaque boolean not null default false,
  ordem integer not null default 0
);

insert into public.planos (id, nome, valor_mensal, limite_colaboradores, limite_obras, recursos, destaque, ordem)
values
  ('trial', 'Teste', 0, 10, 1, '["14 dias gratis","Ponto com GPS","Aprovacao do encarregado"]'::jsonb, false, 0),
  ('essencial', 'Essencial', 149, 10, 1, '["Ate 10 colaboradores","1 obra","Ponto com GPS","Aprovacao","Relatorios essenciais"]'::jsonb, false, 1),
  ('profissional', 'Profissional', 349, 50, null, '["Ate 50 colaboradores","Obras ilimitadas","Folha com encargos CLT","Producao e empreita","Pagamentos e recibos"]'::jsonb, true, 2),
  ('corporativo', 'Corporativo', 799, null, null, '["Colaboradores ilimitados","Multiempresa","API e integracoes","Gerente de conta"]'::jsonb, false, 3)
on conflict (id) do update set
  nome = excluded.nome,
  valor_mensal = excluded.valor_mensal,
  limite_colaboradores = excluded.limite_colaboradores,
  limite_obras = excluded.limite_obras,
  recursos = excluded.recursos,
  destaque = excluded.destaque,
  ordem = excluded.ordem;

-- ---------------------------------------------------------------------------
-- empresa_id nas tabelas de dados
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists empresa_id uuid references public.empresas(id) on delete set null;
alter table public.profiles add column if not exists email text;
alter table public.obras add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.colaboradores add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.pontos add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.producao add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.fechamentos add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.lancamentos add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.folha_itens add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

-- Confirmacao de ponto (opcional, definida pelo admin)
alter table public.obras add column if not exists exigir_foto boolean not null default false;
alter table public.obras add column if not exists exigir_face boolean not null default false;
alter table public.pontos add column if not exists foto text;
alter table public.pontos add column if not exists face_detectada boolean;
alter table public.pontos add column if not exists dispositivo text;

-- Backfill: garante uma empresa e vincula os dados existentes
do $$
declare emp uuid;
begin
  if not exists (select 1 from public.empresas) then
    insert into public.empresas (nome, plano, status, trial_ate, valor_mensal)
    values ('Empresa Demonstracao', 'trial', 'trial', current_date + 14, 0)
    returning id into emp;
  else
    select id into emp from public.empresas order by created_at limit 1;
  end if;

  update public.profiles set empresa_id = emp where empresa_id is null and role <> 'superadmin';
  update public.obras set empresa_id = emp where empresa_id is null;
  update public.colaboradores set empresa_id = emp where empresa_id is null;
  update public.pontos set empresa_id = emp where empresa_id is null;
  update public.producao set empresa_id = emp where empresa_id is null;
  update public.fechamentos set empresa_id = emp where empresa_id is null;
  update public.lancamentos set empresa_id = emp where empresa_id is null;
  update public.folha_itens set empresa_id = emp where empresa_id is null;
end $$;

alter table public.obras alter column empresa_id set not null;
alter table public.colaboradores alter column empresa_id set not null;
alter table public.pontos alter column empresa_id set not null;
alter table public.producao alter column empresa_id set not null;
alter table public.fechamentos alter column empresa_id set not null;
alter table public.lancamentos alter column empresa_id set not null;
alter table public.folha_itens alter column empresa_id set not null;

create index if not exists obras_empresa_idx on public.obras (empresa_id);
create index if not exists colaboradores_empresa_idx on public.colaboradores (empresa_id);
create index if not exists pontos_empresa_idx on public.pontos (empresa_id);
create index if not exists producao_empresa_idx on public.producao (empresa_id);
create index if not exists fechamentos_empresa_idx on public.fechamentos (empresa_id);
create index if not exists lancamentos_empresa_idx on public.lancamentos (empresa_id);
create index if not exists profiles_empresa_idx on public.profiles (empresa_id);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create table if not exists public.auditoria (
  id bigserial primary key,
  empresa_id uuid,
  usuario_id uuid,
  usuario_login text,
  tabela text not null,
  operacao text not null,
  registro_id text,
  detalhe jsonb,
  created_at timestamptz not null default now()
);
create index if not exists auditoria_created_idx on public.auditoria (created_at desc);
create index if not exists auditoria_empresa_idx on public.auditoria (empresa_id);
create index if not exists auditoria_tabela_idx on public.auditoria (tabela);

create or replace function public.log_auditoria()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  emp uuid;
  reg text;
  det jsonb;
  login text;
begin
  if tg_table_name = 'empresas' then
    emp := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    emp := old.empresa_id;
  else
    emp := new.empresa_id;
  end if;

  if tg_op = 'DELETE' then
    reg := old.id::text;
    det := jsonb_build_object('antes', to_jsonb(old) - 'foto');
  elsif tg_op = 'UPDATE' then
    reg := new.id::text;
    det := jsonb_build_object('antes', to_jsonb(old) - 'foto', 'depois', to_jsonb(new) - 'foto');
  else
    reg := new.id::text;
    det := jsonb_build_object('depois', to_jsonb(new) - 'foto');
  end if;

  select p.login into login from public.profiles p where p.id = auth.uid();

  insert into public.auditoria (empresa_id, usuario_id, usuario_login, tabela, operacao, registro_id, detalhe)
  values (emp, auth.uid(), login, tg_table_name, tg_op, reg, det);

  return coalesce(new, old);
end $$;

do $$
declare
  t text;
  tabelas text[] := array[
    'empresas', 'profiles', 'obras', 'colaboradores', 'pontos',
    'producao', 'fechamentos', 'lancamentos', 'folha_itens'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format(
      'create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.log_auditoria()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Preenche empresa_id automaticamente em insercoes do app
-- ---------------------------------------------------------------------------
create or replace function public.set_empresa_id()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.empresa_id is null then
    new.empresa_id := public.app_empresa();
  end if;
  return new;
end $$;

do $$
declare
  t text;
  tabelas text[] := array[
    'obras', 'colaboradores', 'pontos', 'producao', 'fechamentos', 'lancamentos', 'folha_itens'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists trg_empresa on public.%I', t);
    execute format(
      'create trigger trg_empresa before insert on public.%I for each row execute function public.set_empresa_id()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers de autorizacao
-- ---------------------------------------------------------------------------
create or replace function public.app_empresa()
returns uuid
language sql stable security definer set search_path = public
as $$
  select empresa_id from public.profiles where id = auth.uid();
$$;

create or replace function public.app_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS: limpa policies antigas e recria com escopo por empresa
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'obras', 'colaboradores', 'pontos', 'producao',
        'fechamentos', 'lancamentos', 'folha_itens'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.empresas enable row level security;
alter table public.planos enable row level security;
alter table public.auditoria enable row level security;

-- empresas
create policy empresas_superadmin on public.empresas
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy empresas_admin_select on public.empresas
  for select using (id = public.app_empresa());
create policy empresas_admin_update on public.empresas
  for update using (id = public.app_empresa()) with check (id = public.app_empresa());

-- planos
create policy planos_leitura on public.planos
  for select using (auth.role() = 'authenticated');
create policy planos_superadmin on public.planos
  for all using (public.app_superadmin()) with check (public.app_superadmin());

-- auditoria
create policy auditoria_superadmin on public.auditoria
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy auditoria_admin_select on public.auditoria
  for select using (empresa_id = public.app_empresa());

-- profiles
create policy profiles_superadmin on public.profiles
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy profiles_admin_empresa on public.profiles
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- obras
create policy obras_superadmin on public.obras
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy obras_admin on public.obras
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());
create policy obras_encarregado_select on public.obras
  for select using (empresa_id = public.app_empresa() and id = public.app_obra());
create policy obras_funcionario_select on public.obras
  for select using (id = public.app_obra());

-- colaboradores
create policy colaboradores_superadmin on public.colaboradores
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy colaboradores_admin on public.colaboradores
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());
create policy colaboradores_encarregado on public.colaboradores
  for all using (empresa_id = public.app_empresa() and obra_id = public.app_obra())
  with check (empresa_id = public.app_empresa() and obra_id = public.app_obra());
create policy colaboradores_funcionario_select on public.colaboradores
  for select using (id = public.app_colaborador());

-- pontos
create policy pontos_superadmin on public.pontos
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy pontos_admin on public.pontos
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());
create policy pontos_encarregado on public.pontos
  for all using (empresa_id = public.app_empresa() and obra_id = public.app_obra())
  with check (empresa_id = public.app_empresa() and obra_id = public.app_obra());
create policy pontos_funcionario_insert on public.pontos
  for insert with check (
    colaborador_id = public.app_colaborador() and empresa_id = public.app_empresa()
  );
create policy pontos_funcionario_select on public.pontos
  for select using (colaborador_id = public.app_colaborador());

-- producao
create policy producao_superadmin on public.producao
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy producao_admin on public.producao
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());
create policy producao_encarregado on public.producao
  for all using (empresa_id = public.app_empresa() and obra_id = public.app_obra())
  with check (empresa_id = public.app_empresa() and obra_id = public.app_obra());

-- fechamentos
create policy fechamentos_superadmin on public.fechamentos
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy fechamentos_admin on public.fechamentos
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());
create policy fechamentos_encarregado_select on public.fechamentos
  for select using (empresa_id = public.app_empresa() and obra_id = public.app_obra());
create policy fechamentos_funcionario_select on public.fechamentos
  for select using (colaborador_id = public.app_colaborador());

-- lancamentos (financeiro)
create policy lancamentos_superadmin on public.lancamentos
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy lancamentos_admin on public.lancamentos
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());

-- folha_itens
create policy folha_itens_superadmin on public.folha_itens
  for all using (public.app_superadmin()) with check (public.app_superadmin());
create policy folha_itens_admin on public.folha_itens
  for all using (empresa_id = public.app_empresa()) with check (empresa_id = public.app_empresa());
