import type { TipoContrato } from './types'
import type { TabelaLegal } from './tabelas'
import { formatDuracao, valorEmReais, type JornadaSnapshot } from './jornada'

export interface ColaboradorFolha {
  id: string
  nome: string
  tipo_contrato: TipoContrato
  /** Salario mensal (CLT) */
  salario_base?: number | null
  /** Valor da diaria (diarista) */
  valor_diaria?: number | null
  /** Valor combinado total de um contrato de empreita */
  valor_empreita?: number | null
}

export interface EntradaFolha {
  colaborador: ColaboradorFolha
  competencia: string
  /** Diarias apuradas no ponto (diarista) */
  totalDiarias?: number
  /** Valor a pagar de uma empreita (informado em % ou em reais no lancamento) */
  valorEmpreita?: number
  /** Texto de referencia do lancamento de empreita (ex.: "35% de 10.000,00") */
  empreitaReferencia?: string
  /** Proventos avulsos informados pelo gestor/contador */
  outrosProventos?: number
  /** Adiantamentos / vales ja pagos */
  adiantamentos?: number
  /** Descontos definidos pelo contador */
  descontosInformados?: number
  /** Minutos de atraso apurados no ponto na competencia */
  atrasoMinutos?: number
  /** Valor da hora para converter o atraso em reais */
  valorHora?: number
  /** O gestor optou por lancar os descontos de ponto (atrasos) */
  descontarAtrasos?: boolean
  /** Snapshot da jornada apurada, exibido no detalhe/holerite */
  jornada?: JornadaSnapshot
}

export interface Verba {
  descricao: string
  referencia?: string
  valor: number
}

export interface ResultadoFolha {
  colaborador_id: string
  colaborador_nome: string
  competencia: string
  tipo_contrato: TipoContrato
  registraEncargos: boolean
  proventos: Verba[]
  descontos: Verba[]
  encargos: Verba[]
  totalProventos: number
  totalDescontos: number
  totalEncargos: number
  baseINSS: number
  valorINSS: number
  baseIRRF: number
  valorIRRF: number
  valorFGTS: number
  valorLiquido: number
  custoTotal: number
  /** Jornada apurada no ponto, quando disponivel */
  jornada?: JornadaSnapshot
}

/** INSS progressivo do empregado (faixa a faixa). */
export function calcularINSS(base: number, tabela: TabelaLegal): number {
  if (base <= 0) return 0
  let total = 0
  let anterior = 0
  for (const faixa of tabela.faixasINSS) {
    const limite = Math.min(base, faixa.ate)
    const faixaBase = limite - anterior
    if (faixaBase > 0) total += faixaBase * faixa.aliquota
    anterior = faixa.ate
    if (base <= faixa.ate) break
  }
  return round2(total)
}

/** IRRF progressivo, ja considerando dependentes. */
export function calcularIRRF(
  base: number,
  dependentes: number,
  tabela: TabelaLegal,
): number {
  const baseCalculo = base - dependentes * tabela.deducaoDependenteIRRF
  if (baseCalculo <= 0) return 0
  for (const faixa of tabela.faixasIRRF) {
    if (baseCalculo <= faixa.ate) {
      return round2(Math.max(0, baseCalculo * faixa.aliquota - faixa.deducao))
    }
  }
  return 0
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Motor de folha. Monta a previa de uma competencia para um colaborador.
 *
 * Os descontos de INSS, IRRF, FGTS e vale-transporte nao sao calculados
 * automaticamente: o contador informa o valor do desconto e o sistema apenas
 * registra e gera o holerite. A empreita e lancada como valor combinado
 * (informado em % ou em reais no momento do lancamento).
 */
export function calcularFolha(entrada: EntradaFolha): ResultadoFolha {
  const { colaborador, competencia } = entrada

  const proventos: Verba[] = []
  const descontos: Verba[] = []
  const encargos: Verba[] = []

  const salarioBase = Number(colaborador.salario_base ?? 0)
  const valorDiaria = Number(colaborador.valor_diaria ?? 0)
  const valorEmpreita = Number(colaborador.valor_empreita ?? 0)

  if (colaborador.tipo_contrato === 'CLT') {
    if (salarioBase > 0) {
      proventos.push({ descricao: 'Salario base', valor: round2(salarioBase) })
    }
  } else if (colaborador.tipo_contrato === 'DIARISTA') {
    const diarias = Number(entrada.totalDiarias ?? 0)
    if (diarias > 0 && valorDiaria > 0) {
      proventos.push({
        descricao: 'Diarias trabalhadas',
        referencia: `${diarias.toFixed(2)} x ${valorDiaria.toFixed(2)}`,
        valor: round2(diarias * valorDiaria),
      })
    }
  } else {
    const devido = Number(entrada.valorEmpreita ?? 0)
    if (devido > 0) {
      proventos.push({
        descricao: 'Empreita',
        referencia:
          entrada.empreitaReferencia ??
          (valorEmpreita > 0 ? `contrato ${formatNumero(valorEmpreita)}` : undefined),
        valor: round2(devido),
      })
    }
  }

  const outros = Number(entrada.outrosProventos ?? 0)
  if (outros > 0) {
    proventos.push({ descricao: 'Outros proventos', valor: round2(outros) })
  }

  const adiantamentos = Number(entrada.adiantamentos ?? 0)
  if (adiantamentos > 0) {
    descontos.push({ descricao: 'Adiantamentos', valor: round2(adiantamentos) })
  }

  const descontoContador = Number(entrada.descontosInformados ?? 0)
  if (descontoContador > 0) {
    descontos.push({ descricao: 'Descontos', valor: round2(descontoContador) })
  }

  const atrasoMinutos = Number(entrada.atrasoMinutos ?? 0)
  if (entrada.descontarAtrasos && atrasoMinutos > 0) {
    const valorAtraso = valorEmReais(atrasoMinutos, Number(entrada.valorHora ?? 0))
    if (valorAtraso > 0) {
      descontos.push({
        descricao: 'Atrasos',
        referencia: formatDuracao(atrasoMinutos),
        valor: valorAtraso,
      })
    }
  }

  const totalProventos = round2(proventos.reduce((s, v) => s + v.valor, 0))
  const totalDescontos = round2(descontos.reduce((s, v) => s + v.valor, 0))
  const valorLiquido = round2(totalProventos - totalDescontos)

  return {
    colaborador_id: colaborador.id,
    colaborador_nome: colaborador.nome,
    competencia,
    tipo_contrato: colaborador.tipo_contrato,
    registraEncargos: false,
    proventos,
    descontos,
    encargos,
    totalProventos,
    totalDescontos,
    totalEncargos: 0,
    baseINSS: 0,
    valorINSS: 0,
    baseIRRF: 0,
    valorIRRF: 0,
    valorFGTS: 0,
    valorLiquido,
    custoTotal: totalProventos,
    jornada: entrada.jornada,
  }
}

function formatNumero(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
