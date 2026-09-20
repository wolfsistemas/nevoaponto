import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Building2,
  Eye,
  LayoutDashboard,
  Pencil,
  Plus,
  ScrollText,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '@/data/api'
import type { Auditoria, Empresa, Plano, Profile, UserRole } from '@/data/types'
import { PageHeader, EmptyState, StatCard } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Table, TableWrap, Th, Td } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'

type Aba = 'visao' | 'empresas' | 'usuarios' | 'planos' | 'auditoria'

const ABAS: { id: Aba; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'visao', label: 'Visao geral', icon: LayoutDashboard },
  { id: 'empresas', label: 'Empresas', icon: Building2 },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'planos', label: 'Planos', icon: Wallet },
  { id: 'auditoria', label: 'Auditoria', icon: ScrollText },
]

const STATUS_EMPRESA: Record<Empresa['status'], { label: string; tom: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  trial: { label: 'Trial', tom: 'warning' },
  ativo: { label: 'Ativo', tom: 'success' },
  suspenso: { label: 'Suspenso', tom: 'destructive' },
  cancelado: { label: 'Cancelado', tom: 'secondary' },
}

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  encarregado: 'Encarregado',
  funcionario: 'Funcionario',
}

export function SuperAdminPage() {
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('visao')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [perfis, setPerfis] = useState<Profile[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [auditoria, setAuditoria] = useState<Auditoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [formEmpresa, setFormEmpresa] = useState<(Partial<Empresa> & { nome: string }) | null>(null)
  const [formPerfil, setFormPerfil] = useState<(Partial<Profile> & { id: string }) | null>(null)
  const [detalhe, setDetalhe] = useState<Auditoria | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const [e, p, pl, a] = await Promise.all([
        api.listEmpresas(),
        api.listTodosPerfis(),
        api.listPlanos(),
        api.listAuditoria(200),
      ])
      setEmpresas(e)
      setPerfis(p)
      setPlanos(pl)
      setAuditoria(a)
    } catch {
      toast.push('Nao foi possivel carregar os dados de administracao.', 'erro')
    } finally {
      setCarregando(false)
    }
  }, [toast])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const nomeEmpresa = useCallback(
    (id?: string | null) => empresas.find((e) => e.id === id)?.nome ?? '-',
    [empresas],
  )

  const metricas = useMemo(() => {
    const ativas = empresas.filter((e) => e.status === 'ativo')
    const trial = empresas.filter((e) => e.status === 'trial')
    const mrr = ativas.reduce((s, e) => s + Number(e.valor_mensal ?? 0), 0)
    return {
      total: empresas.length,
      ativas: ativas.length,
      trial: trial.length,
      mrr,
      usuarios: perfis.length,
      usuariosAtivos: perfis.filter((p) => p.ativo).length,
    }
  }, [empresas, perfis])

  async function salvarEmpresa(e: FormEvent) {
    e.preventDefault()
    if (!formEmpresa?.nome.trim()) return
    setSalvando(true)
    try {
      await api.upsertEmpresa({
        ...formEmpresa,
        valor_mensal: Number(formEmpresa.valor_mensal ?? 0),
        trial_ate: formEmpresa.trial_ate || null,
      })
      toast.push('Empresa salva.', 'sucesso')
      setFormEmpresa(null)
      await recarregar()
    } catch {
      toast.push('Erro ao salvar empresa.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarPerfil(e: FormEvent) {
    e.preventDefault()
    if (!formPerfil) return
    setSalvando(true)
    try {
      await api.upsertPerfil({
        id: formPerfil.id,
        nome: formPerfil.nome,
        role: formPerfil.role,
        empresa_id: formPerfil.role === 'superadmin' ? null : (formPerfil.empresa_id ?? null),
        ativo: formPerfil.ativo ?? true,
      })
      toast.push('Usuario atualizado.', 'sucesso')
      setFormPerfil(null)
      await recarregar()
    } catch {
      toast.push('Erro ao atualizar usuario.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const empresasFiltradas = empresas.filter((e) =>
    e.nome.toLowerCase().includes(busca.toLowerCase()),
  )
  const perfisFiltrados = perfis.filter((p) =>
    `${p.nome} ${p.email ?? ''} ${p.login}`.toLowerCase().includes(busca.toLowerCase()),
  )

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Super Admin"
        descricao="Empresas, usuarios, planos e auditoria da plataforma."
        icon={ShieldCheck}
        acao={
          <Button onClick={() => setFormEmpresa({ nome: '', plano: 'Trial', status: 'trial', valor_mensal: 0 })}>
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {ABAS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setAba(t.id)
              setBusca('')
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors',
              aba === t.id
                ? 'border-primary bg-primary/12 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : aba === 'visao' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard titulo="Empresas" valor={String(metricas.total)} detalhe={`${metricas.ativas} ativas`} icon={Building2} />
          <StatCard titulo="Em trial" valor={String(metricas.trial)} detalhe="Aguardando conversao" icon={ShieldCheck} tom="warning" />
          <StatCard titulo="Receita mensal" valor={formatMoney(metricas.mrr)} detalhe="Empresas ativas" icon={Wallet} tom="success" />
          <StatCard titulo="Usuarios" valor={String(metricas.usuarios)} detalhe={`${metricas.usuariosAtivos} ativos`} icon={Users} tom="accent" />
          <StatCard titulo="Planos" valor={String(planos.length)} detalhe="Disponiveis" icon={Wallet} />
          <StatCard titulo="Eventos de auditoria" valor={String(auditoria.length)} detalhe="Ultimos 200" icon={ScrollText} tom="destructive" />
        </div>
      ) : (
        <>
          {(aba === 'empresas' || aba === 'usuarios') && (
            <div className="mb-4 max-w-xs">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={aba === 'empresas' ? 'Buscar empresa...' : 'Buscar usuario...'}
              />
            </div>
          )}

          {aba === 'empresas' &&
            (empresasFiltradas.length === 0 ? (
              <EmptyState icon={Building2} titulo="Nenhuma empresa" descricao="Cadastre a primeira empresa da plataforma." />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr className="border-b border-border">
                      <Th>Empresa</Th>
                      <Th>Plano</Th>
                      <Th>Status</Th>
                      <Th>Valor</Th>
                      <Th>Trial ate</Th>
                      <Th>Usuarios</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {empresasFiltradas.map((e) => (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <Td>
                          <p className="font-bold">{e.nome}</p>
                          <p className="text-xs text-muted-foreground">{e.email_contato || e.cnpj || '-'}</p>
                        </Td>
                        <Td className="capitalize">{e.plano}</Td>
                        <Td>
                          <Badge variant={STATUS_EMPRESA[e.status].tom}>{STATUS_EMPRESA[e.status].label}</Badge>
                        </Td>
                        <Td>{formatMoney(e.valor_mensal)}</Td>
                        <Td className="text-muted-foreground">{formatDate(e.trial_ate)}</Td>
                        <Td>{perfis.filter((p) => p.empresa_id === e.id).length}</Td>
                        <Td>
                          <Button variant="outline" size="sm" onClick={() => setFormEmpresa(e)}>
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ))}

          {aba === 'usuarios' &&
            (perfisFiltrados.length === 0 ? (
              <EmptyState icon={Users} titulo="Nenhum usuario" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr className="border-b border-border">
                      <Th>Usuario</Th>
                      <Th>Perfil</Th>
                      <Th>Empresa</Th>
                      <Th>Status</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {perfisFiltrados.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <Td>
                          <p className="font-bold">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{p.email || p.login}</p>
                        </Td>
                        <Td>{ROLE_LABEL[p.role]}</Td>
                        <Td>{p.role === 'superadmin' ? 'Plataforma' : nomeEmpresa(p.empresa_id)}</Td>
                        <Td>
                          <Badge variant={p.ativo ? 'success' : 'destructive'}>
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </Td>
                        <Td>
                          <Button variant="outline" size="sm" onClick={() => setFormPerfil(p)}>
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ))}

          {aba === 'planos' &&
            (planos.length === 0 ? (
              <EmptyState icon={Wallet} titulo="Nenhum plano cadastrado" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {planos.map((p) => (
                  <Card key={p.id} className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{p.nome}</p>
                      {p.destaque && <Badge variant="default">Destaque</Badge>}
                    </div>
                    <p className="mt-2 text-2xl font-extrabold">{formatMoney(p.valor_mensal)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.limite_colaboradores ? `Ate ${p.limite_colaboradores} colaboradores` : 'Colaboradores ilimitados'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.limite_obras
                        ? `Ate ${p.limite_obras} ${p.limite_obras === 1 ? 'local de trabalho' : 'locais de trabalho'}`
                        : 'Locais de trabalho ilimitados'}
                    </p>
                    <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {(p.recursos ?? []).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            ))}

          {aba === 'auditoria' &&
            (auditoria.length === 0 ? (
              <EmptyState icon={ScrollText} titulo="Sem eventos de auditoria" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr className="border-b border-border">
                      <Th>Quando</Th>
                      <Th>Usuario</Th>
                      <Th>Operacao</Th>
                      <Th>Tabela</Th>
                      <Th>Empresa</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {auditoria.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.created_at)}</Td>
                        <Td>{a.usuario_login || '-'}</Td>
                        <Td>
                          <Badge
                            variant={
                              a.operacao === 'INSERT'
                                ? 'success'
                                : a.operacao === 'DELETE'
                                  ? 'destructive'
                                  : 'warning'
                            }
                          >
                            {a.operacao}
                          </Badge>
                        </Td>
                        <Td className="font-semibold">{a.tabela}</Td>
                        <Td>{nomeEmpresa(a.empresa_id)}</Td>
                        <Td>
                          <Button variant="ghost" size="sm" onClick={() => setDetalhe(a)}>
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ))}
        </>
      )}

      {/* Dialog empresa */}
      <Dialog
        open={!!formEmpresa}
        onClose={() => setFormEmpresa(null)}
        title={formEmpresa?.id ? 'Editar empresa' : 'Nova empresa'}
      >
        {formEmpresa && (
          <form onSubmit={salvarEmpresa} className="space-y-3">
            <Field label="Nome">
              <Input
                value={formEmpresa.nome}
                onChange={(e) => setFormEmpresa({ ...formEmpresa, nome: e.target.value })}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CNPJ">
                <Input
                  value={formEmpresa.cnpj ?? ''}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, cnpj: e.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={formEmpresa.telefone ?? ''}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, telefone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="E-mail de contato">
              <Input
                type="email"
                value={formEmpresa.email_contato ?? ''}
                onChange={(e) => setFormEmpresa({ ...formEmpresa, email_contato: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plano">
                <Select
                  value={formEmpresa.plano ?? 'Trial'}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, plano: e.target.value })}
                >
                  {(planos.length ? planos.map((p) => p.nome) : ['Trial', 'Basico', 'Pro', 'Empresa']).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={formEmpresa.status ?? 'trial'}
                  onChange={(e) =>
                    setFormEmpresa({ ...formEmpresa, status: e.target.value as Empresa['status'] })
                  }
                >
                  <option value="trial">Trial</option>
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="cancelado">Cancelado</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor mensal (R$)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formEmpresa.valor_mensal ?? 0}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, valor_mensal: Number(e.target.value) })}
                />
              </Field>
              <Field label="Trial ate">
                <Input
                  type="date"
                  value={formEmpresa.trial_ate?.slice(0, 10) ?? ''}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, trial_ate: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormEmpresa(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Dialog usuario */}
      <Dialog
        open={!!formPerfil}
        onClose={() => setFormPerfil(null)}
        title="Editar usuario"
        description={formPerfil ? formPerfil.email || formPerfil.login : undefined}
      >
        {formPerfil && (
          <form onSubmit={salvarPerfil} className="space-y-3">
            <Field label="Nome">
              <Input
                value={formPerfil.nome}
                onChange={(e) => setFormPerfil({ ...formPerfil, nome: e.target.value })}
                required
              />
            </Field>
            <Field label="Perfil de acesso">
              <Select
                value={formPerfil.role}
                onChange={(e) => setFormPerfil({ ...formPerfil, role: e.target.value as UserRole })}
              >
                <option value="admin">Administrador</option>
                <option value="encarregado">Encarregado</option>
                <option value="funcionario">Funcionario</option>
                <option value="superadmin">Super Admin</option>
              </Select>
            </Field>
            {formPerfil.role !== 'superadmin' && (
              <Field label="Empresa">
                <Select
                  value={formPerfil.empresa_id ?? ''}
                  onChange={(e) => setFormPerfil({ ...formPerfil, empresa_id: e.target.value || null })}
                >
                  <option value="">Sem empresa</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={formPerfil.ativo ?? true}
                onChange={(e) => setFormPerfil({ ...formPerfil, ativo: e.target.checked })}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Usuario ativo
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormPerfil(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Dialog detalhe auditoria */}
      <Dialog
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        title="Detalhe da auditoria"
        description={detalhe ? `${detalhe.tabela} - ${detalhe.operacao}` : undefined}
      >
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-muted p-3 text-xs">
          {JSON.stringify(detalhe?.detalhe ?? {}, null, 2)}
        </pre>
      </Dialog>
    </div>
  )
}
