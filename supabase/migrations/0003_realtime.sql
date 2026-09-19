-- PontoFlow - Realtime
-- Habilita o streaming de alteracoes para que as telas atualizem sozinhas
-- quando outro usuario/dispositivo grava algo (ex.: funcionario bate ponto).
-- Idempotente: pode rodar mais de uma vez.

do $$
declare
  t text;
  tabelas text[] := array[
    'profiles',
    'obras',
    'colaboradores',
    'pontos',
    'producao',
    'fechamentos',
    'lancamentos',
    'folha_itens'
  ];
begin
  foreach t in array tabelas loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
