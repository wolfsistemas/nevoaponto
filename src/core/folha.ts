import type { TipoContrato } from './types'
import { getTabelaLegal, type TabelaLegal } from './tabelas'

export interface ColaboradorFolha {
  id: string
  nome: string
  tipo_contrato: TipoContrato
  /** Salario mensal (CLT) */
  salario_base?: number | null
  /** Valor da diaria (diarista) */
  valor_diaria?: number | null
  /** Valor do metro (terceirizado/empreita) */
  valor_metro?: number | null
  dependentes?: number
  recebe_vale_transporte?: boolean
}

export interface EntradaFolha {
  colaborador: ColaboradorFolha
  competencia: string
  /** Diarias apuradas no ponto (diarista / CLT com dias trabalhados) */
  totalDiarias?: number
  /** Metros apurados (terceirizado / empreita) */
  totalMetros?: number
  /** Horas extras */
  horasExtras50?: number
  horasExtras100?: number
  /** Horas em periodo noturno (para adicional) */
  horasNoturnas?: number
  /** Comissoes / gratificacoes */
  comissoes?: number
  /** Adiantamentos / vales ja pagos */
  adiantamentos?: number
  /** Outros descontos avulsos */
  outrosDescontos?: number
  /** Descontos de VR/VA etc. (ja calculados) */
  descontosBeneficios?: number
  /** DSR sobre horas extras (valor informado) */
  dsr?: number
  /** Rotulo da verba de producao (metros) */
  metrosLabel?: string
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
 * Motor de folha. Calcula proventos, descontos e encargos de uma competencia
 * para um colaborador. Regimes nao-CLT (terceirizado/empreita) nao geram
 * encargos trabalhistas, apenas o pagamento pela producao.
 */
export function calcularFolha(entrada: EntradaFolha): ResultadoFolha {
  const { colaborador, competencia } = entrada
  const tabela = getTabelaLegal(competencia)
  const ehCLT = colaborador.tipo_contrato === 'CLT'
  const registraEncargos = ehCLT

  const proventos: Verba[] = []
  const descontos: Verba[] = []
  const encargos: Verba[] = []

  const salarioBase = Number(colaborador.salario_base ?? 0)
  const valorDiaria = Number(colaborador.valor_diaria ?? 0)
  const valorMetro = Number(colaborador.valor_metro ?? 0)
  const baseHora = salarioBase > 0 ? salarioBase / 220 : 0

  if (ehCLT) {
    proventos.push({ descricao: 'Salario base', valor: round2(salarioBase) })

    const diarias = Number(entrada.totalDiarias ?? 0)
    if (diarias > 0 && valorDiaria > 0) {
      proventos.push({
        descricao: 'Dias trabalhados',
        referencia: `${diarias.toFixed(2)} dias`,
        valor: round2(diarias * valorDiaria),
      })
    }

    const he50 = Number(entrada.horasExtras50 ?? 0)
    if (he50 > 0 && baseHora > 0) {
      proventos.push({
        descricao: 'Horas extras 50%',
        referencia: `${he50}h`,
        valor: round2(baseHora * (1 + tabela.horaExtra50) * he50),
      })
    }

    const he100 = Number(entrada.horasExtras100 ?? 0)
    if (he100 > 0 && baseHora > 0) {
      proventos.push({
        descricao: 'Horas extras 100%',
        referencia: `${he100}h`,
        valor: round2(baseHora * (1 + tabela.horaExtra100) * he100),
      })
    }

    const noturnas = Number(entrada.horasNoturnas ?? 0)
    if (noturnas > 0 && baseHora > 0) {
      proventos.push({
        descricao: 'Adicional noturno',
        referencia: `${noturnas}h`,
        valor: round2(baseHora * tabela.adicionalNoturnoAliquota * noturnas),
      })
    }

    if (Number(entrada.dsr ?? 0) > 0) {
      proventos.push({ descricao: 'DSR sobre horas extras', valor: round2(Number(entrada.dsr)) })
    }

    if (Number(entrada.comissoes ?? 0) > 0) {
      proventos.push({ descricao: 'Comissoes', valor: round2(Number(entrada.comissoes)) })
    }

    const totalProventos = round2(proventos.reduce((s, v) => s + v.valor, 0))

    // Base de INSS = proventos de natureza salarial (todos os acima)
    const baseINSS = Math.min(totalProventos, tabela.tetoINSS)
    const valorINSS = calcularINSS(baseINSS, tabela)
    if (valorINSS > 0) descontos.push({ descricao: 'INSS', valor: valorINSS })

    const baseIRRF = Math.max(0, totalProventos - valorINSS)
    const valorIRRF = calcularIRRF(baseIRRF, Number(colaborador.dependentes ?? 0), tabela)
    if (valorIRRF > 0) descontos.push({ descricao: 'IRRF', valor: valorIRRF })

    if (colaborador.recebe_vale_transporte && salarioBase > 0) {
      const vt = round2(salarioBase * tabela.valeTransporteAliquota)
      if (vt > 0) descontos.push({ descricao: 'Vale-transporte (6%)', valor: vt })
    }

    if (Number(entrada.descontosBeneficios ?? 0) > 0) {
      descontos.push({
        descricao: 'Descontos de beneficios',
        valor: round2(Number(entrada.descontosBeneficios)),
      })
    }

    if (Number(entrada.adiantamentos ?? 0) > 0) {
      descontos.push({ descricao: 'Adiantamentos', valor: round2(Number(entrada.adiantamentos)) })
    }

    if (Number(entrada.outrosDescontos ?? 0) > 0) {
      descontos.push({ descricao: 'Outros descontos', valor: round2(Number(entrada.outrosDescontos)) })
    }

    const totalDescontos = round2(descontos.reduce((s, v) => s + v.valor, 0))
    const valorFGTS = round2(totalProventos * tabela.fgtsAliquota)

    encargos.push({ descricao: 'FGTS (8%)', valor: valorFGTS })
    encargos.push({
      descricao: 'INSS patronal (20%)',
      valor: round2(totalProventos * tabela.inssPatronalAliquota),
    })
    encargos.push({ descricao: 'Provisao 13o salario', valor: round2(salarioBase / 12) })
    encargos.push({
      descricao: 'Provisao ferias + 1/3',
      valor: round2((salarioBase / 12) * (1 + 1 / 3)),
    })
    const totalEncargos = round2(encargos.reduce((s, v) => s + v.valor, 0))

    const valorLiquido = round2(totalProventos - totalDescontos)

    return {
      colaborador_id: colaborador.id,
      colaborador_nome: colaborador.nome,
      competencia,
      tipo_contrato: colaborador.tipo_contrato,
      registraEncargos,
      proventos,
      descontos,
      encargos,
      totalProventos,
      totalDescontos,
      totalEncargos,
      baseINSS,
      valorINSS,
      baseIRRF,
      valorIRRF,
      valorFGTS,
      valorLiquido,
      custoTotal: round2(totalProventos + totalEncargos),
    }
  }

  // Regimes nao-CLT: pagamento por diaria ou por metro, sem encargos.
  if (colaborador.tipo_contrato === 'DIARISTA') {
    const diarias = Number(entrada.totalDiarias ?? 0)
    proventos.push({
      descricao: 'Diarias trabalhadas',
      referencia: `${diarias.toFixed(2)} x ${valorDiaria.toFixed(2)}`,
      valor: round2(diarias * valorDiaria),
    })
  } else {
    const metros = Number(entrada.totalMetros ?? 0)
    proventos.push({
      descricao: entrada.metrosLabel ?? 'Producao (metros)',
      referencia: `${metros.toFixed(2)} m x ${valorMetro.toFixed(2)}`,
      valor: round2(metros * valorMetro),
    })
  }

  if (Number(entrada.comissoes ?? 0) > 0) {
    proventos.push({ descricao: 'Comissoes', valor: round2(Number(entrada.comissoes)) })
  }

  const totalProventos = round2(proventos.reduce((s, v) => s + v.valor, 0))

  if (Number(entrada.adiantamentos ?? 0) > 0) {
    descontos.push({ descricao: 'Adiantamentos', valor: round2(Number(entrada.adiantamentos)) })
  }
  if (Number(entrada.outrosDescontos ?? 0) > 0) {
    descontos.push({ descricao: 'Outros descontos', valor: round2(Number(entrada.outrosDescontos)) })
  }

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
  }
}
