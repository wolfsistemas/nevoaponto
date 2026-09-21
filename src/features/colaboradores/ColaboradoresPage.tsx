import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Copy,
  KeyRound,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Power,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { api } from '@/data/api'
import type { Colaborador, Profile } from '@/data/types'
import type { TipoContrato } from '@/core/types'
import { PageHeader, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatMoney, formatCpf, onlyDigits } from '@/lib/format'
import { BRAND, ROUTES } from '@/lib/brand'

const CONTRATO_LABEL: Record<string, string> = {
  CLT: 'CLT',
  DIARISTA: 'Diarista',
  EMPREITA: 'Empreita',
  TERCEIRIZADO: 'Empreita',
}

const TIPOS_CONTRATO: TipoContrato[] = ['CLT', 'DIARISTA', 'EMPREITA']

function rotuloContrato(tipo: string): string {
  return CONTRATO_LABEL[tipo] ?? tipo
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
  const [acesso, setAcesso] = useState<{
    profileId?: string
    login: string
    senha: string
    role: RoleAcesso
  }>({
    login: '',
    senha: '',
    role: 'funcionario',
  })
  const [criandoAcesso, setCriandoAcesso] = useState(false)
  const [acessoCriado, setAcessoCriado] = useState<{
    nome: string
    login: string
    senha: string
    telefone?: string | null
  } | null>(null)
  const [perfis, setPerfis] = useState<Profile[]>([])

  useEffect(() => {
    api
      .listProfiles()
      .then(setPerfis)
      .catch(() => setPerfis([]))
  }, [])

  const acessoPorColaborador = useMemo(() => {
    const mapa = new Map<string, Profile>()
    for (const p of perfis) {
      if (p.colaborador_id) mapa.set(p.colaborador_id, p)
    }
    return mapa
  }, [perfis])

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

  function nomeLocal(id?: string | null): string {
    return obras.find((o) => o.id === id)?.nome ?? 'Sem local'
  }

  function valorBase(c: Colaborador): string {
    if (c.tipo_contrato === 'EMPREITA') return `${formatMoney(c.valor_empreita)} (contrato)`
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
      if (obras.length === 0) {
        toast.push('Cadastre um local de trabalho para o ponto funcionar.', 'erro')
      }
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
    const perfil = acessoPorColaborador.get(c.id)
    const role: RoleAcesso =
      perfil && (perfil.role === 'admin' || perfil.role === 'encarregado' || perfil.role === 'funcionario')
        ? perfil.role
        : 'funcionario'
    setAcesso({
      profileId: perfil?.id,
      login: perfil?.login ?? sugerirLogin(c),
      senha: '',
      role,
    })
    setAcessoDe(c)
  }

  async function gerarAcesso(e: FormEvent) {
    e.preventDefault()
    if (!acessoDe) return
    const editando = Boolean(acesso.profileId)
    if (!editando && acesso.senha.length < 8) {
      toast.push('A senha deve ter ao menos 8 caracteres.', 'erro')
      return
    }
    if (acesso.senha && acesso.senha.length < 8) {
      toast.push('A nova senha deve ter ao menos 8 caracteres.', 'erro')
      return
    }
    setCriandoAcesso(true)
    try {
      if (editando && acesso.profileId) {
        await api.atualizarAcesso({
          profile_id: acesso.profileId,
          nome: acessoDe.nome,
          login: acesso.login,
          senha: acesso.senha || undefined,
          role: acesso.role,
          colaborador_id: acessoDe.id,
          obra_id: acessoDe.obra_id ?? null,
        })
        toast.push('Acesso atualizado.', 'sucesso')
      } else {
        const res = await api.criarAcesso({
          nome: acessoDe.nome,
          login: acesso.login,
          senha: acesso.senha,
          role: acesso.role,
          colaborador_id: acessoDe.id,
          obra_id: acessoDe.obra_id ?? null,
        })
        toast.push(`Acesso criado: ${res.login}. Compartilhe com o colaborador.`, 'sucesso')
        setAcessoCriado({
          nome: acessoDe.nome,
          login: res.login,
          senha: acesso.senha,
          telefone: acessoDe.telefone,
        })
      }
      api
        .listProfiles()
        .then(setPerfis)
        .catch(() => undefined)
      setAcessoDe(null)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Erro ao salvar acesso.', 'erro')
    } finally {
      setCriandoAcesso(false)
    }
  }

  const exigeDiaria = form?.tipo_contrato === 'DIARISTA'
  const exigeEmpreita = form?.tipo_contrato === 'EMPREITA'
  const exigeSalario = form?.tipo_contrato === 'CLT'

  function mensagemAcesso(info: { nome: string; login: string; senha: string }): string {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}#${ROUTES.login}`
    return [
      `Ola, ${info.nome}! Seu acesso ao ${BRAND.name} foi criado.`,
      `Usuario: ${info.login}`,
      `Senha: ${info.senha}`,
      `Acesse: ${url}`,
      'Troque a senha no primeiro acesso.',
    ].join('\n')
  }

  async function copiarAcesso() {
    if (!acessoCriado) return
    try {
      await navigator.clipboard.writeText(mensagemAcesso(acessoCriado))
      toast.push('Informacoes copiadas.', 'sucesso')
    } catch {
      toast.push('Nao foi possivel copiar.', 'erro')
    }
  }

  function enviarWhatsapp() {
    if (!acessoCriado) return
    const digits = onlyDigits(acessoCriado.telefone ?? '')
    const numero = digits.length >= 10 ? `55${digits}` : ''
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(mensagemAcesso(acessoCriado))}`,
      '_blank',
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Colaboradores"
        descricao="Equipe propria, diaristas e empreiteiros."
        icon={Users}
        acao={
          <Button onClick={() => setForm({ ...VAZIO })}>
            <Plus className="h-4 w-4" /> Novo colaborador
          </Button>
        }
      />

      {obras.length === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-bold">Cadastre um local de trabalho</p>
            <p className="text-muted-foreground">
              O ponto usa a localizacao do colaborador. Cadastre o primeiro local em{' '}
              <Link to={ROUTES.obras} className="font-bold text-primary hover:underline">
                Locais
              </Link>
              . Se o computador nao tiver GPS, abra pelo celular para capturar a localizacao ou use
              as coordenadas do Google Maps.
            </p>
          </div>
        </div>
      )}

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
          <option value="">Todos os locais</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Select>
        <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {TIPOS_CONTRATO.map((t) => (
            <option key={t} value={t}>
              {CONTRATO_LABEL[t]}
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
                    <p className="text-xs text-muted-foreground">{c.cargo ?? rotuloContrato(c.tipo_contrato)}</p>
                  </div>
                </div>
                <Badge variant={c.ativo ? 'success' : 'destructive'}>
                  {c.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{nomeLocal(c.obra_id)}</p>
                <p>CPF: {formatCpf(c.cpf) || '-'}</p>
                {c.telefone && <p>Tel: {c.telefone}</p>}
                {acessoPorColaborador.has(c.id) && (
                  <p className="flex items-center gap-1 font-semibold text-success">
                    <ShieldCheck className="h-3 w-3" /> Acesso ao app ativo
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Badge variant="secondary">{rotuloContrato(c.tipo_contrato)}</Badge>
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
                  title={acessoPorColaborador.has(c.id) ? 'Editar acesso ao app' : 'Criar acesso ao app'}
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
                  {TIPOS_CONTRATO.map((t) => (
                    <option key={t} value={t}>
                      {CONTRATO_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Local de trabalho">
                <Select
                  value={form.obra_id ?? ''}
                  onChange={(e) => setForm({ ...form, obra_id: e.target.value || null })}
                >
                  <option value="">Sem local</option>
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
              {exigeEmpreita && (
                <Field label="Valor combinado (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_empreita ?? ''}
                    onChange={(e) => setForm({ ...form, valor_empreita: Number(e.target.value) })}
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
        title={acesso.profileId ? 'Editar acesso ao app' : 'Criar acesso ao app'}
        description={
          acessoDe
            ? acesso.profileId
              ? `${acessoDe.nome} ja possui acesso. Ajuste o perfil ou redefina a senha.`
              : `${acessoDe.nome} vai entrar com o usuario e a senha abaixo.`
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
              <Field label={acesso.profileId ? 'Nova senha (opcional)' : 'Senha (min. 8)'}>
                <Input
                  value={acesso.senha}
                  onChange={(e) => setAcesso({ ...acesso, senha: e.target.value })}
                  placeholder={acesso.profileId ? 'Deixe em branco para manter' : 'Senha inicial'}
                  autoComplete="new-password"
                  required={!acesso.profileId}
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
              .{' '}
              {acesso.profileId
                ? 'Se informar uma nova senha, oriente o colaborador a usa-la no proximo acesso.'
                : 'Compartilhe o usuario e a senha com o colaborador e oriente a troca no primeiro acesso.'}
            </p>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setAcessoDe(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criandoAcesso}>
                {criandoAcesso
                  ? 'Salvando...'
                  : acesso.profileId
                    ? 'Salvar acesso'
                    : 'Criar acesso'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={Boolean(acessoCriado)}
        onClose={() => setAcessoCriado(null)}
        title="Acesso criado"
        description="Compartilhe o usuario e a senha com o colaborador."
      >
        {acessoCriado && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Colaborador:</span>{' '}
                <strong>{acessoCriado.nome}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Usuario:</span>{' '}
                <strong>{acessoCriado.login}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Senha:</span>{' '}
                <strong>{acessoCriado.senha}</strong>
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={copiarAcesso}>
                <Copy className="h-4 w-4" /> Copiar informacoes
              </Button>
              <Button variant="success" className="flex-1" onClick={enviarWhatsapp}>
                <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              O WhatsApp abre com a mensagem pronta
              {acessoCriado.telefone ? ' para o telefone cadastrado' : ' (escolha o contato)'}.
              Oriente a troca da senha no primeiro acesso.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
