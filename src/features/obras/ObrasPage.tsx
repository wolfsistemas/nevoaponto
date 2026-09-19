import { useState, type FormEvent } from 'react'
import { Building2, MapPin, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { api } from '@/data/api'
import type { Obra } from '@/data/types'
import { PageHeader, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

type FormState = Partial<Obra> & { nome: string }

export function ObrasPage() {
  const { obras, colaboradores } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState<FormState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [capturando, setCapturando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form?.nome.trim()) return
    setSalvando(true)
    try {
      await api.upsertObra({
        ...form,
        raio_tolerancia: Number(form.raio_tolerancia ?? 80),
        lat: form.lat != null ? Number(form.lat) : null,
        lng: form.lng != null ? Number(form.lng) : null,
      })
      toast.push('Obra salva.', 'sucesso')
      setForm(null)
    } catch {
      toast.push('Erro ao salvar obra.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  function capturarLocal() {
    if (!navigator.geolocation) {
      toast.push('Geolocalizacao nao suportada.', 'erro')
      return
    }
    setCapturando(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) =>
          f
            ? { ...f, lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }
            : f,
        )
        setCapturando(false)
        toast.push('Localizacao capturada.', 'sucesso')
      },
      () => {
        setCapturando(false)
        toast.push('Nao foi possivel obter a localizacao.', 'erro')
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  async function remover(o: Obra) {
    if (!confirm(`Remover a obra "${o.nome}"?`)) return
    await api.removeObra(o.id)
    toast.push('Obra removida.', 'info')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Obras"
        descricao="Locais, coordenadas e raio de tolerancia do ponto."
        icon={Building2}
        acao={
          <Button onClick={() => setForm({ nome: '', raio_tolerancia: 80, ativo: true })}>
            <Plus className="h-4 w-4" /> Nova obra
          </Button>
        }
      />

      {obras.length === 0 ? (
        <EmptyState icon={Building2} titulo="Nenhuma obra cadastrada" descricao="Cadastre a primeira obra para vincular colaboradores." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {obras.map((o) => {
            const total = colaboradores.filter((c) => c.obra_id === o.id).length
            return (
              <Card key={o.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold leading-tight">{o.nome}</p>
                      <p className="text-xs text-muted-foreground">{o.endereco || 'Sem endereco'}</p>
                    </div>
                  </div>
                  <Badge variant={o.ativo ? 'success' : 'destructive'}>
                    {o.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="flex items-center gap-1 font-semibold text-muted-foreground">
                      <MapPin className="h-3 w-3" /> Coordenadas
                    </p>
                    <p className="mt-0.5 font-bold">
                      {o.lat != null && o.lng != null
                        ? `${o.lat.toFixed(4)}, ${o.lng.toFixed(4)}`
                        : 'Nao definida'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="flex items-center gap-1 font-semibold text-muted-foreground">
                      <Target className="h-3 w-3" /> Raio
                    </p>
                    <p className="mt-0.5 font-bold">{o.raio_tolerancia} m</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {total} colaborador{total === 1 ? '' : 'es'}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setForm({ ...o })}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => remover(o)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar obra' : 'Nova obra'}
        description="Informe os dados e, se quiser, capture a localizacao atual."
      >
        {form && (
          <form onSubmit={salvar} className="space-y-3">
            <Field label="Nome da obra">
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </Field>
            <Field label="Endereco">
              <Input
                value={form.endereco ?? ''}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <Input
                  type="number"
                  step="0.000001"
                  value={form.lat ?? ''}
                  onChange={(e) => setForm({ ...form, lat: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="0.000001"
                  value={form.lng ?? ''}
                  onChange={(e) => setForm({ ...form, lng: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Raio de tolerancia (m)">
                <Input
                  type="number"
                  value={form.raio_tolerancia ?? 80}
                  onChange={(e) => setForm({ ...form, raio_tolerancia: Number(e.target.value) })}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={capturarLocal}
                  disabled={capturando}
                >
                  <MapPin className="h-4 w-4" />
                  {capturando ? 'Capturando...' : 'Usar localizacao atual'}
                </Button>
              </div>
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
    </div>
  )
}
