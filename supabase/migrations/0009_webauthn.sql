-- PontoFlow - credenciais WebAuthn (login por biometria)
-- Rodar depois de 0008_empresa_logo.sql.

create table if not exists public.webauthn_credenciais (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  credencial_id text not null unique,
  chave_publica text not null,
  algoritmo text not null default 'ES256',
  contador bigint not null default 0,
  apelido text,
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz
);

create index if not exists webauthn_credenciais_usuario_idx
  on public.webauthn_credenciais (usuario_id);

-- Apenas a Edge Function (service_role) acessa esta tabela.
alter table public.webauthn_credenciais enable row level security;
