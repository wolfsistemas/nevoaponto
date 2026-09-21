-- ---------------------------------------------------------------------------
-- 0010: empreita com valor combinado e simplificacao dos tipos de contrato
-- ---------------------------------------------------------------------------

-- Valor combinado total de um contrato de empreita (ex.: 10.000,00).
alter table public.colaboradores add column if not exists valor_empreita numeric(12,2);

-- Regimes de contrato passam a ser apenas CLT, DIARISTA e EMPREITA.
-- Contratos antigos de TERCEIRIZADO viram EMPREITA aproveitando o valor
-- informado por metro como valor combinado quando necessario.
update public.colaboradores
set valor_empreita = coalesce(valor_empreita, valor_metro),
    tipo_contrato = 'EMPREITA'
where tipo_contrato = 'TERCEIRIZADO';
