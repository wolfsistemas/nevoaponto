import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { onDataChange } from './events'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  Colaborador,
  Fechamento,
  LancamentoFinanceiro,
  Obra,
  ProducaoTerc,
} from './types'
import type { PontoRegistro } from '@/core/types'

export interface AppData {
  obras: Obra[]
  colaboradores: Colaborador[]
  pontos: PontoRegistro[]
  producao: ProducaoTerc[]
  fechamentos: Fechamento[]
  lancamentos: LancamentoFinanceiro[]
  carregando: boolean
  recarregar: () => Promise<void>
}

export function useAppData(): AppData {
  const [obras, setObras] = useState<Obra[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [pontos, setPontos] = useState<PontoRegistro[]>([])
  const [producao, setProducao] = useState<ProducaoTerc[]>([])
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [carregando, setCarregando] = useState(true)

  const requisicaoRef = useRef(0)

  const recarregar = useCallback(async () => {
    const requisicao = ++requisicaoRef.current
    try {
      const [o, c, p, pr, f, l] = await Promise.all([
        api.listObras(),
        api.listColaboradores(),
        api.listPontos(),
        api.listProducao(),
        api.listFechamentos(),
        api.listLancamentos(),
      ])
      // Ignora respostas antigas que cheguem fora de ordem.
      if (requisicao !== requisicaoRef.current) return
      setObras(o)
      setColaboradores(c)
      setPontos(p)
      setProducao(pr)
      setFechamentos(f)
      setLancamentos(l)
    } catch {
      // Falha de rede/RLS: mantem os dados anteriores em tela.
    } finally {
      if (requisicao === requisicaoRef.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  // Toda gravacao feita via `api` dispara um evento; aqui recarregamos os dados.
  // O debounce agrupa rajadas (ex.: fechamento de folha com varios registros).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const cancelar = onDataChange(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void recarregar()
      }, 120)
    })
    return () => {
      cancelar()
      if (timer) clearTimeout(timer)
    }
  }, [recarregar])

  // Realtime: quando outro dispositivo/colaborador grava, o Supabase avisa
  // e recarregamos. So faz sentido no modo supabase.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    let timer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase.channel('pontoflow-dados')
    for (const tabela of [
      'profiles',
      'obras',
      'colaboradores',
      'pontos',
      'producao',
      'fechamentos',
      'lancamentos',
    ]) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          void recarregar()
        }, 200)
      })
    }
    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [recarregar])

  return {
    obras,
    colaboradores,
    pontos,
    producao,
    fechamentos,
    lancamentos,
    carregando,
    recarregar,
  }
}
