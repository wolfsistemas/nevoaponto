-- ---------------------------------------------------------------------------
-- 0011: vinculo do lancamento financeiro com o colaborador e a competencia,
-- e cidade da empresa (usada no PIX copia e cola / QR Code).
-- ---------------------------------------------------------------------------

alter table public.lancamentos
  add column if not exists colaborador_id uuid references public.colaboradores(id) on delete set null;

alter table public.lancamentos
  add column if not exists competencia text;

create index if not exists lancamentos_colaborador_idx on public.lancamentos (colaborador_id);
create index if not exists lancamentos_competencia_idx on public.lancamentos (competencia);

alter table public.empresas add column if not exists cidade text;
