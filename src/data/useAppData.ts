import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { localStore } from './localStore'
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

  const recarregar = useCallback(async () => {
    const [o, c, p, pr, f, l] = await Promise.all([
      api.listObras(),
      api.listColaboradores(),
      api.listPontos(),
      api.listProducao(),
      api.listFechamentos(),
      api.listLancamentos(),
    ])
    setObras(o)
    setColaboradores(c)
    setPontos(p)
    setProducao(pr)
    setFechamentos(f)
    setLancamentos(l)
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  useEffect(() => {
    if (api.modo !== 'local') return
    return localStore.subscribe(() => {
      recarregar()
    })
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
