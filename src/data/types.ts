import type { PontoRegistro, TipoContrato } from '@/core/types'

export type UserRole = 'superadmin' | 'admin' | 'encarregado' | 'funcionario'

export interface Empresa {
  id: string
  nome: string
  cnpj?: string | null
  email_contato?: string | null
  telefone?: string | null
  plano: string
  status: 'trial' | 'ativo' | 'suspenso' | 'cancelado'
  trial_ate?: string | null
  valor_mensal: number
  logo_url?: string | null
  termos_aceitos_em?: string | null
  termos_versao?: string | null
  created_at?: string
}

export interface Plano {
  id: string
  nome: string
  valor_mensal: number
  limite_colaboradores?: number | null
  limite_obras?: number | null
  recursos: string[]
  destaque: boolean
  ordem: number
}

export interface Auditoria {
  id: number
  empresa_id?: string | null
  usuario_id?: string | null
  usuario_login?: string | null
  tabela: string
  operacao: 'INSERT' | 'UPDATE' | 'DELETE'
  registro_id?: string | null
  detalhe?: unknown
  created_at: string
}

export type StatusAssinatura =
  | 'pendente'
  | 'autorizada'
  | 'pausada'
  | 'cancelada'
  | 'expirada'

export interface Assinatura {
  id: string
  empresa_id: string
  plano_id: string
  status: StatusAssinatura
  valor: number
  mp_preapproval_id?: string | null
  init_point?: string | null
  periodo_inicio?: string | null
  periodo_fim?: string | null
  proxima_cobranca?: string | null
  cancelada_em?: string | null
  created_at?: string
}

export interface Pagamento {
  id: string
  empresa_id: string
  assinatura_id?: string | null
  mp_payment_id?: string | null
  mp_preapproval_id?: string | null
  plano_id?: string | null
  status: string
  valor: number
  moeda?: string | null
  metodo?: string | null
  pago_em?: string | null
  created_at?: string
}

export interface Obra {
  id: string
  nome: string
  endereco?: string | null
  lat?: number | null
  lng?: number | null
  raio_tolerancia: number
  ativo: boolean
  exigir_foto?: boolean
  exigir_face?: boolean
  empresa_id?: string | null
  criado_em?: string
}

export interface Colaborador {
  id: string
  nome: string
  cpf?: string | null
  rg?: string | null
  telefone?: string | null
  endereco?: string | null
  chave_pix?: string | null
  cargo?: string | null
  obra_id?: string | null
  matricula?: number | null
  tipo_contrato: TipoContrato
  salario_base?: number | null
  valor_diaria?: number | null
  valor_metro?: number | null
  dependentes?: number
  recebe_vale_transporte?: boolean
  data_contrato?: string | null
  contrato_assinado?: boolean
  ativo: boolean
  criado_em?: string
}

export interface Profile {
  id: string
  nome: string
  login: string
  email?: string | null
  role: UserRole
  empresa_id?: string | null
  obra_id?: string | null
  colaborador_id?: string | null
  ativo: boolean
}

export interface ProducaoTerc {
  id: string
  colaborador_id: string
  obra_id?: string | null
  data_registro: string
  metros: number
  valor_metro: number
  status: 'PENDENTE' | 'FECHADO' | 'PAGO'
}

export interface Fechamento {
  id: string
  colaborador_id: string
  obra_id?: string | null
  periodo_inicio: string
  periodo_fim: string
  total_diarias: number
  valor_diaria: number
  valor_bruto: number
  total_descontos: number
  total_encargos: number
  valor_liquido: number
  status: 'ABERTO' | 'FECHADO' | 'PAGO' | 'ESTORNADO'
  data_fechamento?: string | null
  data_pagamento?: string | null
  observacao?: string | null
}

export interface LancamentoFinanceiro {
  id: string
  obra_id?: string | null
  tipo: 'RECEITA' | 'DESPESA'
  categoria: string
  descricao: string
  valor: number
  data: string
  status: 'PENDENTE' | 'PAGO'
  referencia?: string | null
}

export interface FolhaItem {
  id: string
  competencia: string
  colaborador_id: string
  total_diarias: number
  total_metros: number
  total_proventos: number
  total_descontos: number
  total_encargos: number
  valor_liquido: number
  status: 'ABERTO' | 'FECHADO' | 'PAGO'
  detalhe?: unknown
}

export interface Database {
  obras: Obra[]
  colaboradores: Colaborador[]
  profiles: Profile[]
  pontos: PontoRegistro[]
  producao: ProducaoTerc[]
  fechamentos: Fechamento[]
  lancamentos: LancamentoFinanceiro[]
  folhaItens: FolhaItem[]
}

export type { PontoRegistro }
