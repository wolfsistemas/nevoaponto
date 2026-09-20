-- PontoFlow - textos dos planos com foco geral em empresas (nao apenas obra).
-- Atualiza apenas a lista de recursos exibida na tela de Assinatura e no Super Admin.

update public.planos set recursos = '["14 dias gratis","Ponto pelo celular","Aprovacao do gestor"]'::jsonb
where id = 'trial';

update public.planos set recursos = '["Ate 10 colaboradores","1 local de trabalho","Ponto com geolocalizacao opcional","Aprovacao do gestor","Relatorios essenciais"]'::jsonb
where id = 'essencial';

update public.planos set recursos = '["Ate 50 colaboradores","Locais de trabalho ilimitados","Folha completa com encargos CLT","Diarias, producao e terceiros","Pagamentos e recibos","Relatorios avancados e exportacao"]'::jsonb
where id = 'profissional';

update public.planos set recursos = '["Colaboradores ilimitados","Multiempresa e multivinculo","Tabelas legais personalizadas","Perfis e permissoes por local","Exportacao para contabilidade","API e integracoes","Gerente de conta dedicado"]'::jsonb
where id = 'corporativo';
