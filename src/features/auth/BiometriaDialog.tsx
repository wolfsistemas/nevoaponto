import { useEffect, useState } from 'react'
import { Fingerprint, Plus, Trash2 } from 'lucide-react'
import { api } from '@/data/api'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/format'
import { biometriaDisponivel, registrarBiometria } from '@/lib/webauthn'

interface Credencial {
  id: string
  apelido: string | null
  created_at: string
  ultimo_uso: string | null
}

export function BiometriaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useToast()
  const [disponivel, setDisponivel] = useState(false)
  const [credenciais, setCredenciais] = useState<Credencial[]>([])
  const [carregando, setCarregando] = useState(false)
  const [ativando, setAtivando] = useState(false)

  useEffect(() => {
    if (!open) return
    biometriaDisponivel().then(setDisponivel).catch(() => setDisponivel(false))
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function carregar() {
    if (api.modo === 'local') return
    setCarregando(true)
    try {
      const res = await api.webauthn<{ itens: Credencial[] }>({ acao: 'listar' })
      setCredenciais(res.itens ?? [])
    } catch {
      setCredenciais([])
    } finally {
      setCarregando(false)
    }
  }

  async function ativar() {
    setAtivando(true)
    try {
      await registrarBiometria()
      push('Biometria ativada neste dispositivo.', 'sucesso')
      await carregar()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Nao foi possivel ativar a biometria.', 'erro')
    } finally {
      setAtivando(false)
    }
  }

  async function remover(id: string) {
    try {
      await api.webauthn({ acao: 'remover', id })
      push('Biometria removida.', 'info')
      await carregar()
    } catch {
      push('Nao foi possivel remover.', 'erro')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Login por biometria"
      description="Use a digital ou o reconhecimento facial do dispositivo para entrar."
    >
      {api.modo === 'local' || !disponivel ? (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          {api.modo === 'local'
            ? 'Disponivel apenas com o Supabase configurado.'
            : 'Este dispositivo nao oferece autenticacao biometrica (ou o acesso nao e por HTTPS).'}
        </p>
      ) : (
        <div className="space-y-4">
          <Button onClick={ativar} disabled={ativando} className="w-full">
            <Plus className="h-4 w-4" />
            {ativando ? 'Aguardando biometria...' : 'Ativar biometria neste dispositivo'}
          </Button>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Dispositivos cadastrados
            </p>
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : credenciais.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma biometria cadastrada.</p>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border">
                {credenciais.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Fingerprint className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{c.apelido || 'Dispositivo'}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrado em {formatDate(c.created_at)}
                        {c.ultimo_uso ? ` - ultimo uso ${formatDate(c.ultimo_uso)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => remover(c.id)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
