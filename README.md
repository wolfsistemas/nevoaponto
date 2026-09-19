# PontoFlow

**Site publicado:** https://wolfsaas.com.br/nevoaponto/

Sistema moderno de **ponto, folha de pagamento e pagamentos** para construção civil.
Frontend SPA (React + Vite + TypeScript + Tailwind) publicado como site estático
(GitHub Pages) e persistência no **Supabase** (acesso direto via `supabase-js`,
sem backend próprio). Enquanto as credenciais não são configuradas, o app roda em
**modo demonstração** com dados mockados no navegador.

## Funcionalidades

- Registro de ponto por colaborador (entrada/saída, geofencing por GPS, tolerância por período).
- Cálculo de diárias com a mesma regra do sistema legado (manhã até 12h, tarde a partir de 12h; 480 min = 1 diária).
- Regimes de contrato: CLT, diarista, terceirizado (produção por metro) e empreita.
- Folha com encargos CLT (INSS, IRRF, FGTS, provisões de 13º e férias) com tabelas legais parametrizáveis.
- Aprovação de ponto e fechamento por competência.
- Financeiro (lançamentos), relatórios e perfis de acesso (admin, encarregado, funcionário).

## Stack

- React 18 + React Router (HashRouter, compatível com Pages)
- Vite 5 + TypeScript
- Tailwind CSS + componentes no estilo shadcn/ui
- Recharts + lucide-react
- Supabase (`@supabase/supabase-js`) com RLS por perfil
- Vitest para testes do núcleo de negócio

## Começando

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. Sem `.env`, o app inicia em **modo demonstração**
(todos os dados ficam no `localStorage`).

### Scripts

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # typecheck + build de producao em dist/
npm run preview      # preview do build
npm run typecheck    # checagem de tipos
npm run test         # testes (vitest)
npm run test:watch   # testes em watch
```

## Configuracao do Supabase

1. Crie um projeto novo em <https://supabase.com>.
2. Aplique as migrations em `supabase/migrations/` (via `supabase db push` ou colando
   `0001_init.sql` e `0002_rls.sql` no SQL Editor, nesta ordem).
3. Crie o primeiro usuario admin (`Authentication > Users`) e rode `supabase/bootstrap.sql`.
4. Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
VITE_USE_SUPABASE=true
```

5. `npm run dev`. O badge no topo indica o modo atual (`Supabase` ou `Demonstracao`).

> A `anon key` e publica por design; a seguranca real vem das policies de RLS
> definidas em `supabase/migrations/0002_rls.sql`.

### Perfis de acesso

| Perfil      | Escopo |
|-------------|--------|
| admin       | Acesso total, financeiro e folha |
| encarregado | Opera apenas a propria obra |
| funcionario | Ve o proprio cadastro, proprios pontos e fechamentos |

No login com Supabase, o campo "usuario" e convertido para
`usuario@pontoflow.app`. Crie os usuarios do Auth com esse padrao de e-mail.

## Deploy no GitHub Pages

O workflow em `.github/workflows/deploy.yml` roda typecheck, testes e build a cada
push na `main`, publicando `dist/` no Pages.

1. Em `Settings > Pages`, selecione **GitHub Actions** como source.
2. Em `Settings > Secrets and variables > Actions`, cadastre:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_USE_SUPABASE` (`true`)
3. O `base` do Vite e injetado como `/<nome-do-repo>/` automaticamente.

O uso de `HashRouter` evita a necessidade de rewrites/404 customizado no Pages.

## Estrutura

```
src/
  core/         # motor de negocio testavel (ponto, folha, tabelas legais)
  data/         # tipos, seed, localStore, api (local <-> supabase), hooks
  features/     # telas: dashboard, colaboradores, obras, ponto, aprovacao, folha, pagamentos, relatorios
  components/   # design system (ui/) e layout
  lib/          # brand, format, supabase, tema, utils
supabase/
  migrations/   # schema + RLS
  bootstrap.sql # primeiro admin
```

## Licenca

Projeto privado. Todos os direitos reservados.
