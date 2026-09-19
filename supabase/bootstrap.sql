-- PontoFlow - bootstrap do primeiro administrador
-- Rode DEPOIS de aplicar 0001_init.sql e 0002_rls.sql.
--
-- Passo 1: crie o usuario no painel Supabase
--          Authentication > Users > Add user
--          e-mail: admin@pontoflow.app   senha: (defina uma forte)
-- Passo 2: rode este arquivo no SQL Editor.

do $$
declare
  v_email text := 'admin@pontoflow.app';
  v_uid uuid;
  v_obra uuid;
begin
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    raise exception 'Usuario % nao encontrado. Crie-o em Authentication > Users antes de rodar este script.', v_email;
  end if;

  if not exists (select 1 from public.obras) then
    insert into public.obras (nome, endereco, lat, lng, raio_tolerancia)
    values ('Obra Principal', 'Sede', -23.5505, -46.6333, 80)
    returning id into v_obra;
  else
    select id into v_obra from public.obras order by created_at limit 1;
  end if;

  insert into public.profiles (id, nome, login, role, obra_id, ativo)
  values (v_uid, 'Administrador', 'admin', 'admin', v_obra, true)
  on conflict (id) do update
    set role = 'admin', obra_id = excluded.obra_id, ativo = true;
end $$;

-- Conferencia
select p.nome, p.login, p.role, o.nome as obra
from public.profiles p
left join public.obras o on o.id = p.obra_id;
