-- PontoFlow - Row Level Security por perfil
-- Premissas:
--   admin        -> acesso total
--   encarregado  -> opera somente a propria obra
--   funcionario  -> ve apenas o proprio cadastro e os proprios pontos

alter table public.profiles enable row level security;
alter table public.obras enable row level security;
alter table public.colaboradores enable row level security;
alter table public.pontos enable row level security;
alter table public.producao enable row level security;
alter table public.fechamentos enable row level security;
alter table public.lancamentos enable row level security;
alter table public.folha_itens enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid() or public.app_role() = 'encarregado');

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- obras
-- ---------------------------------------------------------------------------
drop policy if exists obras_admin_all on public.obras;
create policy obras_admin_all on public.obras
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

drop policy if exists obras_encarregado_select on public.obras;
create policy obras_encarregado_select on public.obras
  for select using (public.app_role() = 'encarregado' and id = public.app_obra());

drop policy if exists obras_funcionario_select on public.obras;
create policy obras_funcionario_select on public.obras
  for select using (public.app_role() = 'funcionario' and id = public.app_obra());

-- ---------------------------------------------------------------------------
-- colaboradores
-- ---------------------------------------------------------------------------
drop policy if exists colaboradores_admin_all on public.colaboradores;
create policy colaboradores_admin_all on public.colaboradores
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

drop policy if exists colaboradores_encarregado on public.colaboradores;
create policy colaboradores_encarregado on public.colaboradores
  for all using (public.app_role() = 'encarregado' and obra_id = public.app_obra())
  with check (public.app_role() = 'encarregado' and obra_id = public.app_obra());

drop policy if exists colaboradores_funcionario_self on public.colaboradores;
create policy colaboradores_funcionario_self on public.colaboradores
  for select using (public.app_role() = 'funcionario' and id = public.app_colaborador());

-- ---------------------------------------------------------------------------
-- pontos
-- ---------------------------------------------------------------------------
drop policy if exists pontos_admin_all on public.pontos;
create policy pontos_admin_all on public.pontos
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

drop policy if exists pontos_encarregado on public.pontos;
create policy pontos_encarregado on public.pontos
  for all using (public.app_role() = 'encarregado' and obra_id = public.app_obra())
  with check (public.app_role() = 'encarregado' and obra_id = public.app_obra());

drop policy if exists pontos_funcionario_insert on public.pontos;
create policy pontos_funcionario_insert on public.pontos
  for insert with check (
    public.app_role() = 'funcionario'
    and colaborador_id = public.app_colaborador()
    and obra_id = public.app_obra()
  );

drop policy if exists pontos_funcionario_select on public.pontos;
create policy pontos_funcionario_select on public.pontos
  for select using (
    public.app_role() = 'funcionario' and colaborador_id = public.app_colaborador()
  );

-- ---------------------------------------------------------------------------
-- producao
-- ---------------------------------------------------------------------------
drop policy if exists producao_admin_all on public.producao;
create policy producao_admin_all on public.producao
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

drop policy if exists producao_encarregado on public.producao;
create policy producao_encarregado on public.producao
  for all using (public.app_role() = 'encarregado' and obra_id = public.app_obra())
  with check (public.app_role() = 'encarregado' and obra_id = public.app_obra());

-- ---------------------------------------------------------------------------
-- fechamentos
-- ---------------------------------------------------------------------------
drop policy if exists fechamentos_admin_all on public.fechamentos;
create policy fechamentos_admin_all on public.fechamentos
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

drop policy if exists fechamentos_encarregado_select on public.fechamentos;
create policy fechamentos_encarregado_select on public.fechamentos
  for select using (public.app_role() = 'encarregado' and obra_id = public.app_obra());

drop policy if exists fechamentos_funcionario_select on public.fechamentos;
create policy fechamentos_funcionario_select on public.fechamentos
  for select using (
    public.app_role() = 'funcionario' and colaborador_id = public.app_colaborador()
  );

-- ---------------------------------------------------------------------------
-- lancamentos (financeiro: somente admin)
-- ---------------------------------------------------------------------------
drop policy if exists lancamentos_admin_all on public.lancamentos;
create policy lancamentos_admin_all on public.lancamentos
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- folha_itens (somente admin, leitura para encarregado da obra)
-- ---------------------------------------------------------------------------
drop policy if exists folha_admin_all on public.folha_itens;
create policy folha_admin_all on public.folha_itens
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
