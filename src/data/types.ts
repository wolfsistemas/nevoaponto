import type { PontoRegistro, TipoContrato } from '@/core/types'

export type UserRole = 'admin' | 'encarregado' | 'funcionario'

export interface Obra {
  id: string
  nome: string
  endereco?: string | null
  lat?: number | null
  lng?: number | null
  raio_tolerancia: number
  ativo: boolean
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
  role: UserRole
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
