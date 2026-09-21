import { calcularTotalDiarias, proximaMatricula } from '@/core/ponto'
import { calcularFolha, type ResultadoFolha } from '@/core/folha'
import {
  calcularJornada,
  configDaObra,
  snapshotJornada,
  valorHoraColaborador,
  type JornadaConfig,
  type ResumoJornada,
} from '@/core/jornada'
import type { PontoRegistro, StatusPonto } from '@/core/types'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { localStore, novoId } from './localStore'
import { emitDataChange } from './events'
import type {
  Assinatura,
  Auditoria,
  Colaborador,
  Database,
  Empresa,
  Fechamento,
  FolhaItem,
  LancamentoFinanceiro,
  Obra,
  Pagamento,
  Plano,
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

/** Dados informados no lancamento manual da folha de um colaborador. */
export interface LancamentoFolhaInput {
  competencia: string
  colaborador_id: string
  totalDiarias?: number
  /** Valor a pagar da empreita (calculado a partir do % ou digitado em reais) */
  valorEmpreita?: number
  /** Percentual do contrato de empreita, quando aplicavel */
  empreitaPercentual?: number
  outrosProventos?: number
  adiantamentos?: number
  /** Descontos informados pelo contador */
  descontosInformados?: number
  /** Lancar os atrasos apurados no ponto como desconto em reais */
  descontarAtrasos?: boolean
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Apura a jornada (horas extras/atrasos) do colaborador na competencia. */
function apurarJornada(
  colaborador: Colaborador,
  pontos: PontoRegistro[],
  obras: Obra[],
  competencia: string,
): { config: JornadaConfig; resumo: ResumoJornada; valorHora: number } {
  const config = configDaObra(obras.find((o) => o.id === colaborador.obra_id) ?? null)
  const registros = pontos.filter(
    (p) =>
      p.colaborador_id === colaborador.id &&
      p.status === 'VALIDADO' &&
      competenciaDe(p.hora_registro) === competencia,
  )
  const resumo = calcularJornada(registros, config)
  const valorHora = valorHoraColaborador(
    {
      tipo_contrato: colaborador.tipo_contrato,
      salario_base: colaborador.salario_base,
      valor_diaria: colaborador.valor_diaria,
    },
    config,
  )
  return { config, resumo, valorHora }
}

/** Extrai a mensagem de erro de uma FunctionsHttpError do supabase-js. */
async function mensagemDaFunction(error: unknown): Promise<string> {
  const mensagem = error instanceof Error ? error.message : String(error)
  const contexto = (error as { context?: Response }).context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = (await contexto.json()) as { error?: string }
      if (corpo?.error) return corpo.error
    } catch {
      // mantem a mensagem original
    }
  }
  return mensagem
}

interface AcessoInput {
  profile_id?: string
  nome: string
  login: string
  senha?: string
  role?: 'admin' | 'encarregado' | 'funcionario'
  colaborador_id?: string | null
  obra_id?: string | null
}

/** Cria/atualiza um acesso (Auth + perfil) via Edge Function admin-criar-acesso. */
async function invocarAdminAcesso(
  body: AcessoInput,
): Promise<{ id: string; email: string; login: string; role: string }> {
  if (!isSupabaseConfigured) {
    throw new Error('Gestao de acesso disponivel apenas com o Supabase configurado.')
  }
  const { data, error } = await getSupabase().functions.invoke('admin-criar-acesso', { body })
  if (error) throw new Error(await mensagemDaFunction(error))
  const payload = data as { error?: string; id?: string; email?: string; login?: string; role?: string }
  if (payload?.error) throw new Error(payload.error)
  return payload as { id: string; email: string; login: string; role: string }
}

function competenciaDe(data: string): string {
  const d = new Date(data)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Ultimo dia real da competencia (ex.: 2026-02 -> 2026-02-28). */
function competenciaFim(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return `${competencia}-${String(ultimo).padStart(2, '0')}`
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
    const tipo = input.tipo_contrato ?? 'DIARISTA'
    const existente = input.id ? db.colaboradores.find((c) => c.id === input.id) : undefined
    const usaMatricula = tipo === 'CLT' || tipo === 'DIARISTA'
    const matricula =
      input.matricula ??
      existente?.matricula ??
      (usaMatricula ? proximaMatricula(db.colaboradores.map((c) => c.matricula)) : null)
    const registro: Colaborador = {
      ...input,
      id: input.id ?? novoId('colab'),
      tipo_contrato: tipo,
      ativo: input.ativo ?? true,
      obra_id: input.obra_id ?? null,
      matricula,
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
  listFolhaItens(competencia?: string): FolhaItem[] {
    const todos = localStore.get().folhaItens
    return competencia ? todos.filter((f) => f.competencia === competencia) : todos
  },
  upsertFolhaItem(item: FolhaItem): FolhaItem {
    localStore.mutate((db) => {
      const i = db.folhaItens.findIndex(
        (f) => f.competencia === item.competencia && f.colaborador_id === item.colaborador_id,
      )
      if (i >= 0) db.folhaItens[i] = item
      else db.folhaItens.push(item)
    })
    return item
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
    if (isSupabaseConfigured) {
      const tipo = input.tipo_contrato ?? 'DIARISTA'
      if (input.matricula == null && (tipo === 'CLT' || tipo === 'DIARISTA')) {
        const existentes = await sbList<Colaborador>('colaboradores')
        const atual = input.id ? existentes.find((c) => c.id === input.id) : undefined
        input = {
          ...input,
          matricula: atual?.matricula ?? proximaMatricula(existentes.map((c) => c.matricula)),
        }
      }
      return sbUpsert<Colaborador>('colaboradores', input as Colaborador)
    }
    return local.upsertColaborador(input)
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
    return invocarAdminAcesso(input)
  },

  /**
   * Atualiza o acesso existente de um colaborador (perfil e, opcionalmente,
   * login/senha). A senha em branco mantem a atual.
   */
  async atualizarAcesso(input: {
    profile_id: string
    nome: string
    login: string
    senha?: string
    role?: 'admin' | 'encarregado' | 'funcionario'
    colaborador_id?: string | null
    obra_id?: string | null
  }): Promise<{ id: string; email: string; login: string; role: string }> {
    return invocarAdminAcesso(input)
  },

  /** WebAuthn (login por biometria). */
  async webauthn<T = unknown>(body: Record<string, unknown>): Promise<T> {
    if (!isSupabaseConfigured) {
      throw new Error('Login por biometria disponivel apenas com o Supabase configurado.')
    }
    const { data, error } = await getSupabase().functions.invoke('webauthn', { body })
    if (error) throw new Error(await mensagemDaFunction(error))
    const payload = data as { error?: string }
    if (payload?.error) throw new Error(payload.error)
    return data as T
  },

  /** Auto-cadastro publico (empresa + admin + obra inicial) via Edge Function. */
  async criarConta(input: {
    empresa: string
    nome: string
    email: string
    senha: string
    telefone?: string
    cnpj?: string
    aceitou_termos: boolean
    website?: string
  }): Promise<{ ok: boolean; email?: string; trial_ate?: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Cadastro disponivel apenas com o Supabase configurado.')
    }
    const { data, error } = await getSupabase().functions.invoke('criar-conta', { body: input })
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
    const payload = data as { error?: string; ok?: boolean; email?: string; trial_ate?: string }
    if (payload?.error) throw new Error(payload.error)
    return payload as { ok: boolean; email?: string; trial_ate?: string }
  },

  async listEmpresas(): Promise<Empresa[]> {
    return isSupabaseConfigured ? sbList<Empresa>('empresas') : []
  },
  /** Empresa do usuario logado (RLS ja limita ao proprio tenant). */
  async minhaEmpresa(): Promise<Empresa | null> {
    if (!isSupabaseConfigured) return null
    const { data, error } = await getSupabase().from('empresas').select('*').limit(1).maybeSingle()
    if (error) throw error
    return (data as Empresa | null) ?? null
  },
  async atualizarEmpresa(id: string, patch: Partial<Empresa>): Promise<Empresa> {
    if (!isSupabaseConfigured) throw new Error('Disponivel apenas no modo Supabase.')
    const { data, error } = await getSupabase()
      .from('empresas')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Empresa
  },
  async upsertEmpresa(input: Partial<Empresa> & { nome: string }): Promise<Empresa> {
    if (!isSupabaseConfigured) throw new Error('Disponivel apenas no modo Supabase.')
    return sbUpsert<Empresa>('empresas', input as Empresa)
  },
  async listPlanos(): Promise<Plano[]> {
    return isSupabaseConfigured ? sbList<Plano>('planos') : []
  },

  async listAssinaturas(): Promise<Assinatura[]> {
    return isSupabaseConfigured ? sbList<Assinatura>('assinaturas') : []
  },
  async listPagamentos(limite = 50): Promise<Pagamento[]> {
    if (!isSupabaseConfigured) return []
    const { data, error } = await getSupabase()
      .from('pagamentos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error
    return (data ?? []) as Pagamento[]
  },
  async criarAssinatura(planoId: string, empresaId?: string): Promise<{ init_point: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Assinatura disponivel apenas com o Supabase configurado.')
    }
    const { data, error } = await getSupabase().functions.invoke('billing-assinatura', {
      body: { acao: 'criar', plano_id: planoId, empresa_id: empresaId },
    })
    if (error) throw new Error(await mensagemDaFunction(error))
    const payload = data as { error?: string; init_point?: string }
    if (payload?.error) throw new Error(payload.error)
    return { init_point: payload.init_point ?? '' }
  },
  async cancelarAssinatura(empresaId?: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Assinatura disponivel apenas com o Supabase configurado.')
    }
    const { data, error } = await getSupabase().functions.invoke('billing-assinatura', {
      body: { acao: 'cancelar', empresa_id: empresaId },
    })
    if (error) throw new Error(await mensagemDaFunction(error))
    const payload = data as { error?: string }
    if (payload?.error) throw new Error(payload.error)
  },
  async listAuditoria(limite = 200): Promise<Auditoria[]> {
    if (!isSupabaseConfigured) return []
    const { data, error } = await getSupabase()
      .from('auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error
    return (data ?? []) as Auditoria[]
  },
  async listTodosPerfis(): Promise<Profile[]> {
    return isSupabaseConfigured ? sbList<Profile>('profiles') : local.listProfiles()
  },
  async upsertPerfil(input: Partial<Profile> & { id: string }): Promise<Profile> {
    if (!isSupabaseConfigured) throw new Error('Disponivel apenas no modo Supabase.')
    return sbUpsert<Profile>('profiles', input as Profile)
  },

  async listFolhaItens(competencia?: string): Promise<FolhaItem[]> {
    if (isSupabaseConfigured) {
      let query = getSupabase().from('folha_itens').select('*')
      if (competencia) query = query.eq('competencia', competencia)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as FolhaItem[]
    }
    return local.listFolhaItens(competencia)
  },

  /**
   * Salva o lancamento da folha de um colaborador na competencia. O valor do
   * desconto e informado pelo contador (sem calculo automatico de INSS/IRRF).
   */
  async salvarFolhaItem(input: LancamentoFolhaInput): Promise<FolhaItem> {
    const existentes = await api.listFolhaItens(input.competencia)
    if (existentes.some((f) => f.status !== 'ABERTO')) {
      throw new Error('Esta competencia esta fechada. Estorne a folha antes de editar.')
    }

    const colaboradores = await api.listColaboradores()
    const c = colaboradores.find((x) => x.id === input.colaborador_id)
    if (!c) throw new Error('Colaborador nao encontrado.')

    const valorContrato = Number(c.valor_empreita ?? 0)
    const referencia =
      input.empreitaPercentual != null && valorContrato > 0
        ? `${input.empreitaPercentual}% de ${valorContrato.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : undefined

    const [pontos, obras] = await Promise.all([api.listPontos(), api.listObras()])
    const pontosColab = pontos.filter(
      (p) =>
        p.colaborador_id === c.id &&
        p.status === 'VALIDADO' &&
        competenciaDe(p.hora_registro) === input.competencia,
    )

    const totalDiarias = input.totalDiarias ?? calcularTotalDiarias(pontosColab)
    const { resumo, valorHora } = apurarJornada(c, pontos, obras, input.competencia)

    const resultado = calcularFolha({
      colaborador: {
        id: c.id,
        nome: c.nome,
        tipo_contrato: c.tipo_contrato,
        salario_base: c.salario_base,
        valor_diaria: c.valor_diaria,
        valor_empreita: c.valor_empreita,
      },
      competencia: input.competencia,
      totalDiarias,
      valorEmpreita: input.valorEmpreita,
      empreitaReferencia: referencia,
      outrosProventos: input.outrosProventos,
      adiantamentos: input.adiantamentos,
      descontosInformados: input.descontosInformados,
      atrasoMinutos: resumo.totalAtrasoMin,
      valorHora,
      descontarAtrasos: input.descontarAtrasos,
      jornada: snapshotJornada(resumo, valorHora),
    })

    const payload = {
      competencia: input.competencia,
      colaborador_id: input.colaborador_id,
      total_diarias: Number(totalDiarias ?? 0),
      total_metros: 0,
      total_proventos: resultado.totalProventos,
      total_descontos: resultado.totalDescontos,
      total_encargos: 0,
      valor_liquido: resultado.valorLiquido,
      status: 'ABERTO' as const,
      detalhe: { resultado, manual: input },
    }

    if (isSupabaseConfigured) {
      const { data, error } = await getSupabase()
        .from('folha_itens')
        .upsert(payload, { onConflict: 'competencia,colaborador_id' })
        .select()
        .single()
      if (error) throw error
      return data as FolhaItem
    }

    return local.upsertFolhaItem({
      id: `${input.competencia}:${input.colaborador_id}`,
      ...payload,
    })
  },

  /** Apura a competencia para todos os colaboradores ativos. */
  async apurarCompetencia(competencia: string): Promise<ApuracaoCompetencia> {
    const [colaboradores, pontos, salvos, obras] = await Promise.all([
      api.listColaboradores(),
      api.listPontos(),
      api.listFolhaItens(competencia),
      api.listObras(),
    ])

    const itens: ResultadoFolha[] = colaboradores
      .filter((c) => c.ativo)
      .map((c) => {
        // Um lancamento manual ja salvo prevalece sobre a previa calculada.
        const salvo = salvos.find((f) => f.colaborador_id === c.id)
        const snapshot = salvo?.detalhe as { resultado?: ResultadoFolha } | undefined
        if (snapshot?.resultado) return snapshot.resultado

        const pontosColab = pontos.filter(
          (p) =>
            p.colaborador_id === c.id &&
            p.status === 'VALIDADO' &&
            competenciaDe(p.hora_registro) === competencia,
        )
        const { resumo, valorHora } = apurarJornada(c, pontos, obras, competencia)

        return calcularFolha({
          colaborador: {
            id: c.id,
            nome: c.nome,
            tipo_contrato: c.tipo_contrato,
            salario_base: c.salario_base,
            valor_diaria: c.valor_diaria,
            valor_empreita: c.valor_empreita,
          },
          competencia,
          totalDiarias: calcularTotalDiarias(pontosColab),
          jornada: snapshotJornada(resumo, valorHora),
        })
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

  /**
   * Fecha a folha da competencia: gera os lancamentos financeiros e os
   * fechamentos, libera os pontos e congela os itens da folha como FECHADO.
   */
  async fecharFolha(apuracao: ApuracaoCompetencia): Promise<number> {
    const competencia = apuracao.competencia
    const [colaboradores, pontos, fechamentos, folhaItens] = await Promise.all([
      api.listColaboradores(),
      api.listPontos(),
      api.listFechamentos(),
      api.listFolhaItens(competencia),
    ])
    const manualPorColaborador = new Map(
      folhaItens.map((f) => [
        f.colaborador_id,
        (f.detalhe as { manual?: Record<string, number> } | null)?.manual,
      ]),
    )
    let lancamentos = 0

    const diariasDoColaborador = (colaboradorId: string) =>
      calcularTotalDiarias(
        pontos.filter(
          (p) =>
            p.colaborador_id === colaboradorId &&
            p.status === 'VALIDADO' &&
            competenciaDe(p.hora_registro) === competencia,
        ),
      )

    for (const item of apuracao.itens) {
      if (item.totalProventos <= 0 && item.valorLiquido <= 0) continue
      const c = colaboradores.find((x) => x.id === item.colaborador_id)
      if (!c) continue

      // Idempotencia: nao gera pagamento duplicado para a mesma competencia.
      // Fechamentos estornados podem ser refeitos.
      const jaFechado = fechamentos.some(
        (f) =>
          f.colaborador_id === c.id &&
          (f.periodo_inicio ?? '').startsWith(competencia) &&
          f.status !== 'ESTORNADO',
      )
      if (jaFechado) continue

      const pontosColab = pontos.filter(
        (p) =>
          p.colaborador_id === c.id &&
          competenciaDe(p.hora_registro) === competencia &&
          p.status === 'VALIDADO' &&
          !p.pago_em_fechamento,
      )

      // Lancamento financeiro da mao de obra liquida
      await api.createLancamento({
        obra_id: c.obra_id ?? null,
        colaborador_id: c.id,
        competencia,
        tipo: 'DESPESA',
        categoria: 'Mao de Obra',
        descricao: `Folha ${competencia} - ${c.nome}`,
        valor: item.valorLiquido,
        data: new Date().toISOString(),
        status: 'PENDENTE',
        referencia: `folha:${competencia}`,
      })
      lancamentos += 1

      // Marca pontos como pagos
      for (const p of pontosColab) {
        await api.updatePonto(p.id, { pago_em_fechamento: true })
      }

      // Registra fechamento consolidado
      await api.upsertFechamento({
        colaborador_id: c.id,
        obra_id: c.obra_id ?? null,
        periodo_inicio: `${competencia}-01`,
        periodo_fim: competenciaFim(competencia),
        total_diarias: calcularTotalDiarias(pontosColab),
        valor_diaria: c.valor_diaria ?? 0,
        valor_bruto: item.totalProventos,
        total_descontos: item.totalDescontos,
        total_encargos: item.totalEncargos,
        valor_liquido: item.valorLiquido,
        status: 'FECHADO',
        observacao: `Competencia ${competencia}`,
      })
    }

    // Congela a competencia: todos os itens passam a FECHADO (o holerite
    // continua disponivel, mas o lancamento so libera apos estorno).
    const snapshot: Omit<FolhaItem, 'id'>[] = apuracao.itens.map((item) => ({
      competencia,
      colaborador_id: item.colaborador_id,
      total_diarias: diariasDoColaborador(item.colaborador_id),
      total_metros: 0,
      total_proventos: item.totalProventos,
      total_descontos: item.totalDescontos,
      total_encargos: item.totalEncargos,
      valor_liquido: item.valorLiquido,
      status: 'FECHADO',
      detalhe: { resultado: item, manual: manualPorColaborador.get(item.colaborador_id) },
    }))

    if (isSupabaseConfigured) {
      const { error } = await getSupabase()
        .from('folha_itens')
        .upsert(snapshot, { onConflict: 'competencia,colaborador_id' })
      if (error) throw error
    } else {
      for (const item of snapshot) {
        local.upsertFolhaItem({
          id: `${competencia}:${item.colaborador_id}`,
          ...item,
        })
      }
    }

    return lancamentos
  },

  /**
   * Estorna (reabre) uma competencia fechada em cadeia: remove os lancamentos
   * financeiros gerados pela folha, marca os fechamentos como ESTORNADOS,
   * reabre os itens da folha e libera os pontos para um novo fechamento.
   */
  async estornarFolha(competencia: string): Promise<{ lancamentos: number; fechamentos: number }> {
    const referencia = `folha:${competencia}`

    if (isSupabaseConfigured) {
      const sb = getSupabase()

      const { data: lanc, error: e1 } = await sb
        .from('lancamentos')
        .delete()
        .eq('referencia', referencia)
        .select('id')
      if (e1) throw e1

      const { data: fech, error: e2 } = await sb
        .from('fechamentos')
        .update({ status: 'ESTORNADO', data_pagamento: null })
        .gte('periodo_inicio', `${competencia}-01`)
        .lte('periodo_inicio', competenciaFim(competencia))
        .neq('status', 'ESTORNADO')
        .select('id')
      if (e2) throw e2

      const { error: e3 } = await sb
        .from('folha_itens')
        .update({ status: 'ABERTO' })
        .eq('competencia', competencia)
      if (e3) throw e3

      const { error: e4 } = await sb
        .from('pontos')
        .update({ pago_em_fechamento: false })
        .eq('status', 'VALIDADO')
        .gte('hora_registro', `${competencia}-01T00:00:00.000Z`)
        .lte('hora_registro', `${competenciaFim(competencia)}T23:59:59.999Z`)
      if (e4) throw e4

      return { lancamentos: lanc?.length ?? 0, fechamentos: fech?.length ?? 0 }
    }

    const lancamentos = local.listLancamentos().filter((l) => l.referencia === referencia)
    const fechamentos = local
      .listFechamentos()
      .filter((f) => f.periodo_inicio.startsWith(`${competencia}-`) && f.status !== 'ESTORNADO')

    localStore.mutate((db) => {
      db.lancamentos = db.lancamentos.filter((l) => l.referencia !== referencia)
      db.fechamentos.forEach((f) => {
        if (f.periodo_inicio.startsWith(`${competencia}-`) && f.status !== 'ESTORNADO') {
          f.status = 'ESTORNADO'
          f.data_pagamento = null
        }
      })
      db.folhaItens.forEach((f) => {
        if (f.competencia === competencia) f.status = 'ABERTO'
      })
      db.pontos.forEach((p) => {
        if (p.status === 'VALIDADO' && competenciaDe(p.hora_registro) === competencia) {
          p.pago_em_fechamento = false
        }
      })
    })

    return { lancamentos: lancamentos.length, fechamentos: fechamentos.length }
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
  'upsertEmpresa',
  'upsertPerfil',
  'criarAssinatura',
  'cancelarAssinatura',
  'fecharFolha',
  'estornarFolha',
  'salvarFolhaItem',
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
