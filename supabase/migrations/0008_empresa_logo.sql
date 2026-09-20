-- PontoFlow - logo da empresa (exibida no app e nos recibos/relatorios)
-- Rodar depois de 0007_planos_textos.sql.

alter table public.empresas add column if not exists logo_url text;
