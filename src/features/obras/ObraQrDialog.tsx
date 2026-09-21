import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, QrCode } from 'lucide-react'
import type { Obra } from '@/data/types'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ROUTES } from '@/lib/brand'

export function obraQrUrl(obraId: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#${ROUTES.ponto}?obra=${obraId}`
}

export function ObraQrDialog({
  obra,
  open,
  onClose,
}: {
  obra: Obra | null
  open: boolean
  onClose: () => void
}) {
  const { push } = useToast()
  const [dataUrl, setDataUrl] = useState('')
  const [link, setLink] = useState('')

  useEffect(() => {
    if (!open || !obra) return
    const url = obraQrUrl(obra.id)
    setLink(url)
    setDataUrl('')
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: { dark: '#0b0b12', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [open, obra])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      push('Link copiado.', 'sucesso')
    } catch {
      push('Nao foi possivel copiar.', 'erro')
    }
  }

  function baixar() {
    if (!dataUrl || !obra) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-local-${obra.nome.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="QR Code do local"
      description="Fixe na entrada do local para o colaborador abrir o ponto direto."
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl border border-border bg-white p-4">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR Code do local ${obra?.nome ?? ''}`} className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-muted-foreground">
              <QrCode className="h-10 w-10" />
            </div>
          )}
        </div>
        <p className="text-center text-sm font-bold">{obra?.nome}</p>
        <p className="break-all rounded-lg bg-muted p-2 text-center text-[11px] text-muted-foreground">
          {link}
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={copiar}>
            <Copy className="h-4 w-4" /> Copiar link
          </Button>
          <Button className="flex-1" onClick={baixar} disabled={!dataUrl}>
            <Download className="h-4 w-4" /> Baixar PNG
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
