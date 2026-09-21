import { useEffect, useState } from 'react'
import { Building2, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { api } from '@/data/api'
import type { Empresa } from '@/data/types'
import { PageHeader } from '@/components/ui/feedback'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { formatCnpj, onlyDigits } from '@/lib/format'
import { arquivoParaImagemDataUrl } from '@/lib/imagem'

export function EmpresaPage() {
  const toast = useToast()
  const modoLocal = api.modo === 'local'
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    cnpj: '',
    email_contato: '',
    telefone: '',
    cidade: '',
    logo_url: '',
  })

  useEffect(() => {
    async function carregar() {
      if (modoLocal) {
        setCarregando(false)
        return
      }
      try {
        const e = await api.minhaEmpresa()
        setEmpresa(e)
        if (e) {
          setForm({
            nome: e.nome ?? '',
            cnpj: formatCnpj(e.cnpj) || '',
            email_contato: e.email_contato ?? '',
            telefone: e.telefone ?? '',
            cidade: e.cidade ?? '',
            logo_url: e.logo_url ?? '',
          })
        }
      } catch {
        toast.push('Nao foi possivel carregar os dados da empresa.', 'erro')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function escolherLogo(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      const url = await arquivoParaImagemDataUrl(arquivo)
      setForm((f) => ({ ...f, logo_url: url }))
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Falha ao processar a imagem.', 'erro')
    }
  }

  async function salvar() {
    if (!empresa) return
    if (!form.nome.trim()) {
      toast.push('Informe o nome da empresa.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const atualizada = await api.atualizarEmpresa(empresa.id, {
        nome: form.nome.trim(),
        cnpj: onlyDigits(form.cnpj) || null,
        email_contato: form.email_contato.trim() || null,
        telefone: form.telefone.trim() || null,
        cidade: form.cidade.trim() || null,
        logo_url: form.logo_url || null,
      })
      setEmpresa(atualizada)
      toast.push('Dados da empresa salvos.', 'sucesso')
    } catch {
      toast.push('Erro ao salvar. Verifique suas permissoes.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Minha empresa"
        descricao="Logo e dados exibidos no app, nos recibos e nos relatorios."
        icon={Building2}
      />

      {modoLocal ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Disponivel apenas com o Supabase configurado.
          </CardContent>
        </Card>
      ) : carregando ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </CardContent>
        </Card>
      ) : !empresa ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma empresa vinculada ao seu usuario.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 p-4">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo da empresa" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-center text-xs text-muted-foreground">
                    <ImagePlus className="mx-auto mb-1 h-6 w-6" />
                    Nenhuma logo cadastrada
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => escolherLogo(e.target.files?.[0])}
                  />
                  <span className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted">
                    <ImagePlus className="h-4 w-4" /> Enviar logo
                  </span>
                </label>
                {form.logo_url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm((f) => ({ ...f, logo_url: '' }))}
                    title="Remover logo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                PNG, JPG ou WEBP. A imagem e otimizada automaticamente.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Nome / razao social">
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CNPJ">
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="E-mail de contato">
                <Input
                  type="email"
                  value={form.email_contato}
                  onChange={(e) => setForm((f) => ({ ...f, email_contato: e.target.value }))}
                />
              </Field>
              <Field label="Cidade (exibida no PIX)">
                <Input
                  value={form.cidade}
                  onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                  placeholder="Ex.: Sao Paulo"
                />
              </Field>

              <div className="flex justify-end pt-2">
                <Button onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
