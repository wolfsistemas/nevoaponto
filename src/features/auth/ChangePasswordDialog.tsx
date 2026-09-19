import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from './AuthContext'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { alterarSenha } = useAuth()
  const { push } = useToast()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  function fechar() {
    setAtual('')
    setNova('')
    setConfirmar('')
    setErro('')
    onClose()
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (nova.length < 8) {
      setErro('A nova senha deve ter ao menos 8 caracteres.')
      return
    }
    if (nova !== confirmar) {
      setErro('As senhas nao conferem.')
      return
    }
    setCarregando(true)
    const res = await alterarSenha(atual, nova)
    setCarregando(false)
    if (res.ok) {
      push('Senha alterada com sucesso.', 'sucesso')
      fechar()
    } else {
      setErro(res.erro ?? 'Nao foi possivel alterar a senha.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={fechar}
      title="Alterar senha"
      description="Confirme a senha atual e defina uma nova."
    >
      {erro && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {erro}
        </div>
      )}
      <form onSubmit={salvar} className="space-y-3">
        <Field label="Senha atual">
          <Input
            type="password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="Nova senha">
          <Input
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Min. 8 caracteres"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirmar nova senha">
          <Input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={carregando}>
            <KeyRound className="h-4 w-4" />
            {carregando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
