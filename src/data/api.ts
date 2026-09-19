import { calcularTotalDiarias } from '@/core/ponto'
import { calcularFolha, type EntradaFolha, type ResultadoFolha } from '@/core/folha'
import type { PontoRegistro, StatusPonto } from '@/core/types'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { localStore, novoId } from './localStore'
import { emitDataChange } from './events'
import type {
  Colaborador,
  Database,
  Fechamento,
  FolhaItem,
  LancamentoFinanceiro,
  Obra,
  ProducaoTerc,
  Profile,
} from './types'

export interface ApuracaoCompetencia {
  competencia: string
  itens: ResultadoFolha[]
  totalProventos: number
  totalDescontos: number
  totalEncargos: number
  totalLiquido: number
}

const round2 = (v: number) => Math.round(v * 100) / 100

function competenciaDe(data: string): string {
  const d = new Date(data)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Implementacao local (modo demonstracao, persistida em localStorage)
// ---------------------------------------------------------------------------

const local = {
  listObras(): Obra[] {
    return localStore.get().obras
  },
  upsertObra(obra: Omit<Obra, 'id'> & { id?: string }): Obra {
    const registro: Obra = { ...obra, id: obra.id ?? novoId('obra') } as Obra
    localStore.mutate((db) => {
      const i = db.obras.findIndex((o) => o.id === registro.id)
      if (i >= 0) db.obras[i] = registro
      else db.obras.unshift(registro)
    })
    return registro
  },
  removeObra(id: string): void {
    localStore.mutate((db) => {
      db.obras = db.obras.filter((o) => o.id !== id)
    })
  },

  listColaboradores(): Colaborador[] {
    return localStore.get().colaboradores
  },
  upsertColaborador(input: Partial<Colaborador> & { nome: string }): Colaborador {
    const db = localStore.get()
    const registro: Colaborador = {
      id: input.id ?? novoId('colab'),
      tipo_contrato: input.tipo_contrato ?? 'DIARISTA',
      ativo: input.ativo ?? true,
      obra_id: input.obra_id ?? null,
      matricula:
        input.matricula ??
        (input.tipo_contrato === 'CLT' || input.tipo_contrato === 'DIARISTA'
          ? Math.max(0, ...db.colaboradores.map((c) => c.matricula ?? 0)) + 1 || 133
          : null),
      ...input,
    } as Colaborador
    localStore.mutate((database) => {
      const i = database.colaboradores.findIndex((c) => c.id === registro.id)
      if (i >= 0) database.colaboradores[i] = registro
      else database.colaboradores.unshift(registro)
    })
    return registro
  },
  toggleColaborador(id: string): void {
    localStore.mutate((db) => {
      const c = db.colaboradores.find((x) => x.id === id)
      if (c) c.ativo = !c.ativo
    })
  },

  listPontos(): PontoRegistro[] {
    return localStore.get().pontos
  },
  createPonto(input: Omit<PontoRegistro, 'id'> & { id?: string }): PontoRegistro {
    const registro: PontoRegistro = { ...input, id: input.id ?? novoId('pt') } as PontoRegistro
    localStore.mutate((db) => {
      db.pontos.push(registro)
    })
    return registro
  },
  updatePonto(id: string, patch: Partial<PontoRegistro>): void {
    localStore.mutate((db) => {
      const p = db.pontos.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    })
  },
  setStatusPontos(ids: string[], status: StatusPonto): void {
    localStore.mutate((db) => {
      db.pontos.forEach((p) => {
        if (ids.includes(p.id)) p.status = status
      })
    })
  },
  removePonto(id: string): void {
    localStore.mutate((db) => {
      db.pontos = db.pontos.filter((p) => p.id !== id)
    })
  },

  listProducao(): ProducaoTerc[] {
    return localStore.get().producao
  },
  createProducao(input: Omit<ProducaoTerc, 'id'> & { id?: string }): ProducaoTerc {
    const registro = { ...input, id: input.id ?? novoId('prod') } as ProducaoTerc
    localStore.mutate((db) => {
      db.producao.unshift(registro)
    })
    return registro
  },

  listFechamentos(): Fechamento[] {
    return localStore.get().fechamentos
  },
  upsertFechamento(input: Partial<Fechamento> & { colaborador_id: string }): Fechamento {
    const db = localStore.get()
    const registro: Fechamento = {
      id: input.id ?? novoId('fech'),
      obra_id: input.obra_id ?? null,
      periodo_inicio: input.periodo_inicio ?? '',
      periodo_fim: input.periodo_fim ?? '',
      total_diarias: input.total_diarias ?? 0,
      valor_diaria: input.valor_diaria ?? 0,
      valor_bruto: input.valor_bruto ?? 0,
      total_descontos: input.total_descontos ?? 0,
      total_encargos: input.total_encargos ?? 0,
      valor_liquido: input.valor_liquido ?? 0,
      status: input.status ?? 'FECHADO',
      data_fechamento: input.data_fechamento ?? new Date().toISOString(),
      data_pagamento: input.data_pagamento ?? null,
      observacao: input.observacao ?? null,
      colaborador_id: input.colaborador_id,
    }
    void db
    localStore.mutate((database) => {
      const i = database.fechamentos.findIndex((f) => f.id === registro.id)
      if (i >= 0) database.fechamentos[i] = registro
      else database.fechamentos.unshift(registro)
    })
    return registro
  },
  updateFechamento(id: string, patch: Partial<Fechamento>): void {
    localStore.mutate((db) => {
      const f = db.fechamentos.find((x) => x.id === id)
      if (f) Object.assign(f, patch)
    })
  },

  listLancamentos(): LancamentoFinanceiro[] {
    return localStore.get().lancamentos
  },
  createLancamento(input: Omit<LancamentoFinanceiro, 'id'> & { id?: string }): LancamentoFinanceiro {
    const registro = { ...input, id: input.id ?? novoId('lanc') } as LancamentoFinanceiro
    localStore.mutate((db) => {
      db.lancamentos.unshift(registro)
    })
    return registro
  },

  listProfiles(): Profile[] {
    return localStore.get().profiles
  },
}

// ---------------------------------------------------------------------------
// Implementacao Supabase (usada quando VITE_USE_SUPABASE=true e credenciais ok)
// ---------------------------------------------------------------------------

async function sbList<T>(table: string): Promise<T[]> {
  const { data, error } = await getSupabase().from(table).select('*')
  if (error) throw error
  return (data ?? []) as T[]
}

async function sbUpsert<T>(table: string, payload: object): Promise<T> {
  const { data, error } = await getSupabase().from(table).upsert(payload).select().single()
  if (error) throw error
  return data as T
}

// ---------------------------------------------------------------------------
// Facade publica
// ---------------------------------------------------------------------------

const apiBase = {
  modo: isSupabaseConfigured ? ('supabase' as const) : ('local' as const),

  async listObras(): Promise<Obra[]> {
    return isSupabaseConfigured ? sbList<Obra>('obras') : local.listObras()
  },
  async upsertObra(obra: Partial<Obra> & { nome: string }): Promise<Obra> {
    return isSupabaseConfigured
      ? sbUpsert<Obra>('obras', obra as Obra)
      : local.upsertObra(obra as Obra)
  },
  async removeObra(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().from('obras').delete().eq('id', id)
      if (error) throw error
      return
    }
    local.removeObra(id)
  },

  async listColaboradores(): Promise<Colaborador[]> {
    return isSupabaseConfigured ? sbList<Colaborador>('colaboradores') : local.listColaboradores()
  },
  async upsertColaborador(
    input: Partial<Colaborador> & { nome: string },
  ): Promise<Colaborador> {
    return isSupabaseConfigured
      ? sbUpsert<Colaborador>('colaboradores', input as Colaborador)
      : local.upsertColaborador(input)
  },
  async toggleColaborador(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const atual = (await sbList<Colaborador>('colaboradores')).find((c) => c.id === id)
      const { error } = await getSupabase()
        .from('colaboradores')
        .update({ ativo: !atual?.ativo })
        .eq('id', id)
      if (error) throw error
      return
    }
    local.toggleColaborador(id)
  },

  async listPontos(): Promise<PontoRegistro[]> {
    return isSupabaseConfigured ? sbList<PontoRegistro>('pontos') : local.listPontos()
  },
  async createPonto(
    input: Omit<PontoRegistro, 'id'> & { id?: string },
  ): Promise<PontoRegistro> {
    return isSupabaseConfigured
      ? sbUpsert<PontoRegistro>('pontos', input)
      : local.createPonto(input)
  },
  async updatePonto(id: string, patch: Partial<PontoRegistro>): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().from('pontos').update(patch).eq('id', id)
      if (error) throw error
      return
    }
    local.updatePonto(id, patch)
  },
  async setStatusPontos(ids: string[], status: StatusPonto): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().from('pontos').update({ status }).in('id', ids)
      if (error) throw error
      return
    }
    local.setStatusPontos(ids, status)
  },
  async removePonto(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().from('pontos').delete().eq('id', id)
      if (error) throw error
      return
    }
    local.removePonto(id)
  },

  async listProducao(): Promise<ProducaoTerc[]> {
    return isSupabaseConfigured ? sbList<ProducaoTerc>('producao') : local.listProducao()
  },
  async createProducao(input: Omit<ProducaoTerc, 'id'> & { id?: string }): Promise<ProducaoTerc> {
    return isSupabaseConfigured
      ? sbUpsert<ProducaoTerc>('producao', input)
      : local.createProducao(input)
  },

  async listFechamentos(): Promise<Fechamento[]> {
    return isSupabaseConfigured ? sbList<Fechamento>('fechamentos') : local.listFechamentos()
  },
  async upsertFechamento(
    input: Partial<Fechamento> & { colaborador_id: string },
  ): Promise<Fechamento> {
    return isSupabaseConfigured
      ? sbUpsert<Fechamento>('fechamentos', input as Fechamento)
      : local.upsertFechamento(input)
  },
  async updateFechamento(id: string, patch: Partial<Fechamento>): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().from('fechamentos').update(patch).eq('id', id)
      if (error) throw error
      return
    }
    local.updateFechamento(id, patch)
  },

  async listLancamentos(): Promise<LancamentoFinanceiro[]> {
    return isSupabaseConfigured ? sbList<LancamentoFinanceiro>('lancamentos') : local.listLancamentos()
  },
  async createLancamento(
    input: Omit<LancamentoFinanceiro, 'id'> & { id?: string },
  ): Promise<LancamentoFinanceiro> {
    return isSupabaseConfigured
      ? sbUpsert<LancamentoFinanceiro>('lancamentos', input)
      : local.createLancamento(input)
  },
  async markLancamentoPago(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().from('lancamentos').update({ status: 'PAGO' }).eq('id', id)
      if (error) throw error
      return
    }
    localStore.mutate((db) => {
      const l = db.lancamentos.find((x) => x.id === id)
      if (l) l.status = 'PAGO'
    })
  },

  async listProfiles(): Promise<Profile[]> {
    return isSupabaseConfigured ? sbList<Profile>('profiles') : local.listProfiles()
  },

  /**
   * Cria o acesso de um colaborador (Auth + perfil) via Edge Function.
   * Disponivel apenas no modo Supabase.
   */
  async criarAcesso(input: {
    nome: string
    login: string
    senha: string
    role?: 'admin' | 'encarregado' | 'funcionario'
    colaborador_id?: string | null
    obra_id?: string | null
  }): Promise<{ id: string; email: string; login: string; role: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Criacao de acesso disponivel apenas com o Supabase configurado.')
    }
    const { data, error } = await getSupabase().functions.invoke('admin-criar-acesso', {
      body: input,
    })
    if (error) {
      let mensagem = error.message
      const contexto = (error as { context?: Response }).context
      if (contexto && typeof contexto.json === 'function') {
        try {
          const corpo = (await contexto.json()) as { error?: string }
          if (corpo?.error) mensagem = corpo.error
        } catch {
          // mantem a mensagem original
        }
      }
      throw new Error(mensagem)
    }
    const payload = data as { error?: string; id?: string; email?: string; login?: string; role?: string }
    if (payload?.error) throw new Error(payload.error)
    return payload as { id: string; email: string; login: string; role: string }
  },

  /** Apura a competencia para todos os colaboradores ativos. */
  async apurarCompetencia(competencia: string): Promise<ApuracaoCompetencia> {
    const [colaboradores, pontos, producao] = await Promise.all([
      api.listColaboradores(),
      api.listPontos(),
      api.listProducao(),
    ])

    const itens: ResultadoFolha[] = colaboradores
      .filter((c) => c.ativo)
      .map((c) => {
        const pontosColab = pontos.filter(
          (p) =>
            p.colaborador_id === c.id &&
            p.status === 'VALIDADO' &&
            competenciaDe(p.hora_registro) === competencia,
        )
        const totalDiarias = calcularTotalDiarias(pontosColab)
        const totalMetros = producao
          .filter(
            (p) =>
              p.colaborador_id === c.id &&
              competenciaDe(p.data_registro) === competencia,
          )
          .reduce((s, p) => s + p.metros, 0)

        const entrada: EntradaFolha = {
          colaborador: {
            id: c.id,
            nome: c.nome,
            tipo_contrato: c.tipo_contrato,
            salario_base: c.salario_base,
            valor_diaria: c.valor_diaria,
            valor_metro: c.valor_metro,
            dependentes: c.dependentes,
            recebe_vale_transporte: c.recebe_vale_transporte,
          },
          competencia,
          totalDiarias,
          totalMetros,
        }
        return calcularFolha(entrada)
      })

    return {
      competencia,
      itens,
      totalProventos: round2(itens.reduce((s, i) => s + i.totalProventos, 0)),
      totalDescontos: round2(itens.reduce((s, i) => s + i.totalDescontos, 0)),
      totalEncargos: round2(itens.reduce((s, i) => s + i.totalEncargos, 0)),
      totalLiquido: round2(itens.reduce((s, i) => s + i.valorLiquido, 0)),
    }
  },

  /** Fecha a folha, marcando pontos/producao e gerando lancamentos financeiros. */
  async fecharFolha(apuracao: ApuracaoCompetencia): Promise<number> {
    const colaboradores = await api.listColaboradores()
    const pontos = await api.listPontos()
    const producao = await api.listProducao()
    let lancamentos = 0

    for (const item of apuracao.itens) {
      if (item.totalProventos <= 0) continue
      const c = colaboradores.find((x) => x.id === item.colaborador_id)
      if (!c) continue

      // Lancamento financeiro da mao de obra liquida
      await api.createLancamento({
        obra_id: c.obra_id ?? null,
        tipo: 'DESPESA',
        categoria: 'Mao de Obra',
        descricao: `Folha ${apuracao.competencia} - ${c.nome}`,
        valor: item.valorLiquido,
        data: new Date().toISOString(),
        status: 'PENDENTE',
        referencia: `folha:${apuracao.competencia}`,
      })
      lancamentos += 1

      // Marca pontos como pagos
      const pontosColab = pontos.filter(
        (p) => p.colaborador_id === c.id && competenciaDe(p.hora_registro) === apuracao.competencia,
      )
      for (const p of pontosColab) {
        await api.updatePonto(p.id, { pago_em_fechamento: true })
      }

      // Registra fechamento consolidado
      await api.upsertFechamento({
        colaborador_id: c.id,
        obra_id: c.obra_id ?? null,
        periodo_inicio: `${apuracao.competencia}-01`,
        periodo_fim: `${apuracao.competencia}-31`,
        total_diarias: calcularTotalDiarias(pontosColab),
        valor_diaria: c.valor_diaria ?? 0,
        valor_bruto: item.totalProventos,
        total_descontos: item.totalDescontos,
        total_encargos: item.totalEncargos,
        valor_liquido: item.valorLiquido,
        status: 'FECHADO',
        observacao: `Competencia ${apuracao.competencia}`,
      })
    }
    void producao
    return lancamentos
  },

  resetDemo(): void {
    localStore.reset()
  },
}

/**
 * Metodos que alteram dados. Apos cada um deles concluir com sucesso,
 * emitimos um evento global para que todas as telas recarreguem sozinhas.
 */
const METODOS_DE_ESCRITA = new Set<string>([
  'upsertObra',
  'removeObra',
  'upsertColaborador',
  'toggleColaborador',
  'createPonto',
  'updatePonto',
  'setStatusPontos',
  'removePonto',
  'createProducao',
  'upsertFechamento',
  'updateFechamento',
  'createLancamento',
  'markLancamentoPago',
  'fecharFolha',
  'resetDemo',
])

export const api = new Proxy(apiBase, {
  get(alvo, prop, receiver) {
    const valor = Reflect.get(alvo, prop, receiver)
    if (typeof valor === 'function' && typeof prop === 'string' && METODOS_DE_ESCRITA.has(prop)) {
      return async (...args: unknown[]) => {
        const resultado = await (valor as (...a: unknown[]) => Promise<unknown>).apply(alvo, args)
        emitDataChange()
        return resultado
      }
    }
    return valor
  },
}) as typeof apiBase

export type Api = typeof api
export type { Database, FolhaItem }
