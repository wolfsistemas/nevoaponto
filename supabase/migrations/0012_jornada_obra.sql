-- ---------------------------------------------------------------------------
-- 0012: configuracao de jornada por local (horas semanais, tolerancia diaria,
-- banco de horas e dias uteis) usada no calculo de horas extras e atrasos.
-- ---------------------------------------------------------------------------

alter table public.obras
  add column if not exists horas_semanais numeric(5, 2) not null default 44;

alter table public.obras
  add column if not exists dias_uteis integer not null default 5;

alter table public.obras
  add column if not exists tolerancia_minutos integer not null default 10;

alter table public.obras
  add column if not exists banco_horas boolean not null default false;
