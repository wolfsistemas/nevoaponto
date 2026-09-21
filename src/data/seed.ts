import type { PontoRegistro } from '@/core/types'
import type { Colaborador, Database, Obra, Profile } from './types'

const uid = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, '0')}`

function iso(date: Date, hour: number, minute = 0): string {
  const d = new Date(date)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString()
}

function startOfMonth(ref: Date): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1))
}

/** Gera uma folha de ponto plausivel para os ultimos meses. */
function gerarPontos(colaboradores: Colaborador[]): PontoRegistro[] {
  const registros: PontoRegistro[] = []
  const hoje = new Date()
  const inicio = startOfMonth(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1)))
  const hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())

  const elegiveis = colaboradores.filter(
    (c) => c.tipo_contrato === 'CLT' || c.tipo_contrato === 'DIARISTA',
  )

  let seq = 0
  for (const colab of elegiveis) {
    for (let t = inicio.getTime(); t <= hojeUTC; t += 86_400_000) {
      const dia = new Date(t)
      const dow = dia.getUTCDay()
      if (dow === 0) continue // domingo
      const diaSeq = Math.floor((t - inicio.getTime()) / 86_400_000)

      // Falta ocasional
      if ((diaSeq + seq) % 13 === 0) continue

      const obra = colab.obra_id
      const base = {
        colaborador_id: colab.id,
        obra_id: obra ?? null,
        pago_em_fechamento: false,
        lat_registro: '-17.881',
        lng_registro: '-51.714',
      }
      const ehHoje = t === hojeUTC
      const status: PontoRegistro['status'] = ehHoje ? 'PENDENTE' : 'VALIDADO'

      const push = (tipo: PontoRegistro['tipo'], hora: number, extra: Partial<PontoRegistro> = {}) => {
        seq += 1
        registros.push({
          id: uid('pt', seq),
          tipo,
          hora_registro: iso(dia, hora),
          status,
          origem: 'APP',
          ...base,
          ...extra,
        })
      }

      push('ENTRADA', 7)
      push('SAIDA', 11)

      // Meio periodo ocasional
      if ((diaSeq + seq) % 9 !== 0) {
        push('ENTRADA', 13)
        push('SAIDA', 17)
      }
    }
    seq += 3
  }
  return registros
}

export function criarSeed(): Database {
  const obras: Obra[] = [
    {
      id: 'obra-001',
      nome: 'Residencial Aurora',
      endereco: 'Av. Central, 1200 - Jatai/GO',
      lat: -17.8812,
      lng: -51.7141,
      raio_tolerancia: 80,
      ativo: true,
      criado_em: new Date().toISOString(),
    },
    {
      id: 'obra-002',
      nome: 'Centro Comercial Horizonte',
      endereco: 'Rua das Palmeiras, 45 - Jatai/GO',
      lat: -17.7891,
      lng: -51.6032,
      raio_tolerancia: 100,
      ativo: true,
      criado_em: new Date().toISOString(),
    },
  ]

  const colaboradores: Colaborador[] = [
    {
      id: 'colab-001',
      nome: 'Carlos Pereira',
      cpf: '12345678901',
      rg: '1234567',
      telefone: '(64) 99999-1001',
      endereco: 'Rua A, 10',
      chave_pix: 'carlos@email.com',
      cargo: 'Pedreiro',
      obra_id: 'obra-001',
      matricula: 133,
      tipo_contrato: 'CLT',
      salario_base: 2800,
      valor_diaria: 140,
      dependentes: 1,
      data_contrato: '2024-02-01',
      contrato_assinado: true,
      ativo: true,
    },
    {
      id: 'colab-002',
      nome: 'Ana Souza',
      cpf: '23456789012',
      rg: '2345678',
      telefone: '(64) 99999-1002',
      endereco: 'Rua B, 22',
      chave_pix: '23456789012',
      cargo: 'Servente',
      obra_id: 'obra-001',
      matricula: 134,
      tipo_contrato: 'CLT',
      salario_base: 2200,
      valor_diaria: 110,
      dependentes: 2,
      recebe_vale_transporte: true,
      data_contrato: '2024-03-15',
      contrato_assinado: true,
      ativo: true,
    },
    {
      id: 'colab-003',
      nome: 'Bruno Lima',
      cpf: '34567890123',
      rg: '3456789',
      telefone: '(64) 99999-1003',
      endereco: 'Rua C, 33',
      chave_pix: 'bruno@email.com',
      cargo: 'Servente',
      obra_id: 'obra-001',
      matricula: 135,
      tipo_contrato: 'DIARISTA',
      valor_diaria: 160,
      data_contrato: '2025-01-10',
      contrato_assinado: true,
      ativo: true,
    },
    {
      id: 'colab-004',
      nome: 'Diego Alves',
      cpf: '45678901234',
      rg: '4567890',
      telefone: '(64) 99999-1004',
      endereco: 'Rua D, 44',
      chave_pix: 'diego@email.com',
      cargo: 'Pedreiro',
      obra_id: 'obra-002',
      matricula: 136,
      tipo_contrato: 'DIARISTA',
      valor_diaria: 180,
      data_contrato: '2025-02-20',
      contrato_assinado: true,
      ativo: true,
    },
    {
      id: 'colab-005',
      nome: 'Empreiteira XYZ',
      cpf: '56789012345',
      telefone: '(64) 99999-1005',
      chave_pix: '56789012345',
      cargo: 'Empreiteira',
      obra_id: 'obra-002',
      tipo_contrato: 'EMPREITA',
      valor_empreita: 10000,
      data_contrato: '2025-04-01',
      contrato_assinado: true,
      ativo: true,
    },
    {
      id: 'colab-006',
      nome: 'Fernanda Dias',
      cpf: '67890123456',
      rg: '6789012',
      telefone: '(64) 99999-1006',
      endereco: 'Rua E, 55',
      chave_pix: 'fernanda@email.com',
      cargo: 'Engenheira',
      obra_id: 'obra-002',
      matricula: 137,
      tipo_contrato: 'CLT',
      salario_base: 8500,
      valor_diaria: 425,
      dependentes: 3,
      recebe_vale_transporte: false,
      data_contrato: '2023-08-01',
      contrato_assinado: true,
      ativo: true,
    },
    {
      id: 'colab-007',
      nome: 'Gabriel Rocha',
      cpf: '78901234567',
      telefone: '(64) 99999-1007',
      chave_pix: 'gabriel@email.com',
      cargo: 'Empreita',
      obra_id: 'obra-001',
      tipo_contrato: 'EMPREITA',
      valor_empreita: 8000,
      data_contrato: '2025-05-05',
      ativo: true,
    },
    {
      id: 'colab-008',
      nome: 'Helena Costa',
      cpf: '89012345678',
      telefone: '(64) 99999-1008',
      cargo: 'Servente',
      obra_id: 'obra-002',
      matricula: 138,
      tipo_contrato: 'DIARISTA',
      valor_diaria: 150,
      ativo: false,
    },
  ]

  const profiles: Profile[] = [
    { id: 'user-001', nome: 'Administrador', login: 'admin', role: 'admin', ativo: true },
    {
      id: 'user-002',
      nome: 'Marcos Encarregado',
      login: 'encarregado',
      role: 'encarregado',
      obra_id: 'obra-001',
      ativo: true,
    },
    {
      id: 'user-003',
      nome: 'Carlos Pereira',
      login: 'funcionario',
      role: 'funcionario',
      obra_id: 'obra-001',
      colaborador_id: 'colab-001',
      ativo: true,
    },
  ]

  const producao: [] = []

  return {
    obras,
    colaboradores,
    profiles,
    pontos: gerarPontos(colaboradores),
    producao,
    fechamentos: [],
    lancamentos: [],
    folhaItens: [],
  }
}
