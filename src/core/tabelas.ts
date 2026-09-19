/**
 * Tabelas legais parametrizaveis por competencia.
 *
 * Os valores abaixo sao referenciais (ano-base 2025) e devem ser atualizados
 * pelo administrador a cada virada de ano. Nada de encargo fica "chumbado" no
 * codigo: o motor de folha sempre consulta a tabela da competencia.
 */

export interface FaixaINSS {
  /** Limite superior da faixa (base de contribuicao) */
  ate: number
  /** Aliquota progressiva da faixa (ex.: 0.075) */
  aliquota: number
}

export interface FaixaIRRF {
  /** Limite superior da faixa (base de calculo ja sem INSS) */
  ate: number
  aliquota: number
  /** Parcela a deduzir do imposto */
  deducao: number
}

export interface TabelaLegal {
  competencia: string
  salarioMinimo: number
  tetoINSS: number
  faixasINSS: FaixaINSS[]
  faixasIRRF: FaixaIRRF[]
  deducaoDependenteIRRF: number
  fgtsAliquota: number
  inssPatronalAliquota: number
  valeTransporteAliquota: number
  adicionalNoturnoAliquota: number
  horaExtra50: number
  horaExtra100: number
}

export const TABELA_2025: TabelaLegal = {
  competencia: '2025',
  salarioMinimo: 1518.0,
  tetoINSS: 8157.41,
  faixasINSS: [
    { ate: 1518.0, aliquota: 0.075 },
    { ate: 2793.88, aliquota: 0.09 },
    { ate: 4190.83, aliquota: 0.12 },
    { ate: 8157.41, aliquota: 0.14 },
  ],
  faixasIRRF: [
    { ate: 2259.2, aliquota: 0, deducao: 0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
    { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
    { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
    { ate: Number.POSITIVE_INFINITY, aliquota: 0.275, deducao: 896.0 },
  ],
  deducaoDependenteIRRF: 189.59,
  fgtsAliquota: 0.08,
  inssPatronalAliquota: 0.2,
  valeTransporteAliquota: 0.06,
  adicionalNoturnoAliquota: 0.2,
  horaExtra50: 0.5,
  horaExtra100: 1.0,
}

const TABELAS: Record<string, TabelaLegal> = {
  '2025': TABELA_2025,
}

/** Retorna a tabela da competencia, com fallback para a mais recente. */
export function getTabelaLegal(competencia: string): TabelaLegal {
  const ano = competencia.split('-')[0]
  return TABELAS[ano] ?? TABELA_2025
}

export function registrarTabelaLegal(tabela: TabelaLegal): void {
  TABELAS[tabela.competencia] = tabela
}
