import { useMemo, useState, type FormEvent } from 'react'
import { KeyRound, Pencil, Plus, Search, Power, Users } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { api } from '@/data/api'
import type { Colaborador } from '@/data/types'
import type { TipoContrato } from '@/core/types'
import { PageHeader, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatMoney, formatCpf, onlyDigits } from '@/lib/format'

const CONTRATO_LABEL: Record<TipoContrato, string> = {
  CLT: 'CLT',
  DIARISTA: 'Diarista',
  TERCEIRIZADO: 'Terceirizado',
  EMPREITA: 'Empreita',
}

type FormState = Partial<Colaborador> & { nome: string }

type RoleAcesso = 'admin' | 'encarregado' | 'funcionario'

const ROLE_LABEL: Record<RoleAcesso, string> = {
  funcionario: 'Funcionario (bate o ponto)',
  encarregado: 'Encarregado (aprova o ponto)',
  admin: 'Administrador (acesso total)',
}

function sugerirLogin(c: Colaborador): string {
  const primeiro =
    c.nome
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)[0] ?? 'colaborador'
  const limpo = primeiro.replace(/[^a-z0-9]/g, '') || 'colaborador'
  return c.matricula ? `${limpo}${c.matricula}` : limpo
}

const VAZIO: FormState = {
  nome: '',
  tipo_contrato: 'CLT',
  ativo: true,
}

export function ColaboradoresPage() {
  const { colaboradores, obras } = useAppData()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [acessoDe, setAcessoDe] = useState<Colaborador | null>(null)
  const [acesso, setAcesso] = useState<{ login: string; senha: string; role: RoleAcesso }>({
    login: '',
    senha: '',
    role: 'funcionario',
  })
  const [criandoAcesso, setCriandoAcesso] = useState(false)

  const lista = useMemo(() => {
    const termo = busca.toLowerCase()
    return colaboradores
      .filter(
        (c) =>
          (!termo || c.nome.toLowerCase().includes(termo) || (c.cpf ?? '').includes(termo)) &&
          (!filtroObra || c.obra_id === filtroObra) &&
          (!filtroTipo || c.tipo_contrato === filtroTipo),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [colaboradores, busca, filtroObra, filtroTipo])

  function nomeObra(id?: string | null): string {
    return obras.find((o) => o.id === id)?.nome ?? 'Sem obra'
  }

  function valorBase(c: Colaborador): string {
    if (c.tipo_contrato === 'TERCEIRIZADO' || c.tipo_contrato === 'EMPREITA') {
      return `${formatMoney(c.valor_metro)}/m`
    }
    if (c.tipo_contrato === 'DIARISTA') return `${formatMoney(c.valor_diaria)}/dia`
    return `${formatMoney(c.salario_base)}/mes`
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form?.nome.trim()) {
      toast.push('Informe o nome.', 'erro')
      return
    }
    setSalvando(true)
    try {
      await api.upsertColaborador({
        ...form,
        cpf: form.cpf ? onlyDigits(form.cpf) : null,
      })
      toast.push('Colaborador salvo.', 'sucesso')
      setForm(null)
    } catch {
      toast.push('Erro ao salvar colaborador.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(c: Colaborador) {
    await api.toggleColaborador(c.id)
    toast.push(c.ativo ? 'Colaborador inativado.' : 'Colaborador reativado.', 'info')
  }

  function abrirAcesso(c: Colaborador) {
    setAcesso({ login: sugerirLogin(c), senha: '', role: 'funcionario' })
    setAcessoDe(c)
  }

  async function gerarAcesso(e: FormEvent) {
    e.preventDefault()
    if (!acessoDe) return
    if (acesso.senha.length < 6) {
      toast.push('A senha deve ter ao menos 6 caracteres.', 'erro')
      return
    }
    setCriandoAcesso(true)
    try {
      const res = await api.criarAcesso({
        nome: acessoDe.nome,
        login: acesso.login,
        senha: acesso.senha,
        role: acesso.role,
        colaborador_id: acessoDe.id,
        obra_id: acessoDe.obra_id ?? null,
      })
      toast.push(`Acesso criado: ${res.email}. Entregue a senha ao colaborador.`, 'sucesso')
      setAcessoDe(null)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Erro ao criar acesso.', 'erro')
    } finally {
      setCriandoAcesso(false)
    }
  }

  const exigeDiaria = form?.tipo_contrato === 'DIARISTA'
  const exigeMetro = form?.tipo_contrato === 'TERCEIRIZADO' || form?.tipo_contrato === 'EMPREITA'
  const exigeSalario = form?.tipo_contrato === 'CLT'

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Colaboradores"
        descricao="Equipe propria, diaristas, terceirizados e empreiteiros."
        icon={Users}
        acao={
          <Button onClick={() => setForm({ ...VAZIO })}>
            <Plus className="h-4 w-4" /> Novo colaborador
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Select>
        <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(CONTRATO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={Users}
          titulo="Nenhum colaborador encontrado"
          descricao="Ajuste os filtros ou cadastre um novo colaborador."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-sm font-extrabold text-primary">
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold leading-tight">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.cargo ?? CONTRATO_LABEL[c.tipo_contrato]}</p>
                  </div>
                </div>
                <Badge variant={c.ativo ? 'success' : 'destructive'}>
                  {c.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{nomeObra(c.obra_id)}</p>
                <p>CPF: {formatCpf(c.cpf) || '-'}</p>
                {c.telefone && <p>Tel: {c.telefone}</p>}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Badge variant="secondary">{CONTRATO_LABEL[c.tipo_contrato]}</Badge>
                  {c.matricula != null && (
                    <span className="ml-2 text-xs font-bold text-muted-foreground">
                      Mat. {c.matricula}
                    </span>
                  )}
                </div>
                <span className="text-sm font-extrabold text-primary">{valorBase(c)}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setForm({ ...c })}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => abrirAcesso(c)}
                  title="Criar acesso ao app"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={c.ativo ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={() => alternarAtivo(c)}
                  title={c.ativo ? 'Inativar' : 'Reativar'}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar colaborador' : 'Novo colaborador'}
        description="Dados cadastrais, contrato e valor de remuneracao."
      >
        {form && (
          <form onSubmit={salvar} className="space-y-3">
            <Field label="Nome completo">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF">
                <Input
                  value={formatCpf(form.cpf) || ''}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="RG">
                <Input value={form.rg ?? ''} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone">
                <Input
                  value={form.telefone ?? ''}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </Field>
              <Field label="Cargo">
                <Input
                  value={form.cargo ?? ''}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de contrato">
                <Select
                  value={form.tipo_contrato}
                  onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value as TipoContrato })}
                >
                  {Object.entries(CONTRATO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Obra">
                <Select
                  value={form.obra_id ?? ''}
                  onChange={(e) => setForm({ ...form, obra_id: e.target.value || null })}
                >
                  <option value="">Sem obra</option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {exigeSalario && (
                <Field label="Salario mensal (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.salario_base ?? ''}
                    onChange={(e) => setForm({ ...form, salario_base: Number(e.target.value) })}
                  />
                </Field>
              )}
              {exigeDiaria && (
                <Field label="Valor da diaria (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_diaria ?? ''}
                    onChange={(e) => setForm({ ...form, valor_diaria: Number(e.target.value) })}
                  />
                </Field>
              )}
              {exigeMetro && (
                <Field label="Valor do metro (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_metro ?? ''}
                    onChange={(e) => setForm({ ...form, valor_metro: Number(e.target.value) })}
                  />
                </Field>
              )}
              <Field label="Dependentes (IRRF)">
                <Input
                  type="number"
                  value={form.dependentes ?? 0}
                  onChange={(e) => setForm({ ...form, dependentes: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de contrato">
                <Input
                  type="date"
                  value={form.data_contrato ?? ''}
                  onChange={(e) => setForm({ ...form, data_contrato: e.target.value })}
                />
              </Field>
              <Field label="Chave PIX">
                <Input
                  value={form.chave_pix ?? ''}
                  onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={Boolean(form.recebe_vale_transporte)}
                  onChange={(e) => setForm({ ...form, recebe_vale_transporte: e.target.checked })}
                />
                Recebe vale-transporte
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={form.ativo !== false}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                Ativo
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={Boolean(acessoDe)}
        onClose={() => setAcessoDe(null)}
        title="Criar acesso ao app"
        description={
          acessoDe
            ? `${acessoDe.nome} vai entrar com o usuario e a senha abaixo.`
            : 'Gere o login do colaborador.'
        }
      >
        {acessoDe && (
          <form onSubmit={gerarAcesso} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usuario (login)">
                <Input
                  value={acesso.login}
                  onChange={(e) => setAcesso({ ...acesso, login: e.target.value })}
                  placeholder="nome133"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Senha (min. 6)">
                <Input
                  value={acesso.senha}
                  onChange={(e) => setAcesso({ ...acesso, senha: e.target.value })}
                  placeholder="Senha inicial"
                  autoComplete="new-password"
                  required
                />
              </Field>
            </div>

            <Field label="Perfil de acesso">
              <Select
                value={acesso.role}
                onChange={(e) => setAcesso({ ...acesso, role: e.target.value as RoleAcesso })}
              >
                {(Object.keys(ROLE_LABEL) as RoleAcesso[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              O login sera{' '}
              <strong>
                {acesso.login ? `${acesso.login}@pontoflow.app` : 'usuario@pontoflow.app'}
              </strong>
              . Compartilhe o usuario e a senha com o colaborador e oriente a troca no primeiro
              acesso.
            </p>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setAcessoDe(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criandoAcesso}>
                {criandoAcesso ? 'Criando...' : 'Criar acesso'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  )
}
