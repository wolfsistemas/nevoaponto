import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, RefreshCw, ScanFace } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface DetectorFaces {
  detect(source: CanvasImageSource): Promise<unknown[]>
}
interface DetectorCtor {
  new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }): DetectorFaces
}
declare global {
  interface Window {
    FaceDetector?: DetectorCtor
  }
}

export interface CapturaPonto {
  foto: string | null
  face: boolean | null
}

export function CameraCaptureDialog({
  open,
  onClose,
  exigirFace,
  onConfirmar,
}: {
  open: boolean
  onClose: () => void
  exigirFace: boolean
  onConfirmar: (captura: CapturaPonto) => void
}) {
  const { push } = useToast()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [estado, setEstado] = useState<'iniciando' | 'pronto' | 'erro'>('iniciando')
  const [preview, setPreview] = useState<string | null>(null)
  const [face, setFace] = useState<boolean | null>(null)
  const [processando, setProcessando] = useState(false)

  const parar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const iniciar = useCallback(async () => {
    setPreview(null)
    setFace(null)
    setEstado('iniciando')
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado('erro')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setEstado('pronto')
    } catch {
      setEstado('erro')
    }
  }, [])

  useEffect(() => {
    if (open) void iniciar()
    else parar()
    return parar
  }, [open, iniciar, parar])

  async function capturar() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || estado !== 'pronto') return
    const largura = Math.min(video.videoWidth || 480, 640)
    const altura = Math.round((largura * (video.videoHeight || 480)) / (video.videoWidth || 480))
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, largura, altura)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    setPreview(dataUrl)
    parar()

    if (exigirFace) {
      setProcessando(true)
      try {
        const Detector = window.FaceDetector
        if (!Detector) {
          setFace(null)
          push('Deteccao facial indisponivel neste dispositivo. Foto registrada.', 'info')
        } else {
          const detector = new Detector({ fastMode: true, maxDetectedFaces: 1 })
          const faces = await detector.detect(canvas)
          setFace(faces.length > 0)
        }
      } catch {
        setFace(null)
      } finally {
        setProcessando(false)
      }
    }
  }

  function confirmar() {
    if (!preview) return
    if (exigirFace && face === false) {
      push('Nenhum rosto detectado. Refaça a foto.', 'erro')
      return
    }
    onConfirmar({ foto: preview, face })
    onClose()
  }

  function refazer() {
    void iniciar()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Confirmacao do registro"
      description={exigirFace ? 'Enquadre o rosto e capture a foto.' : 'Capture uma foto para confirmar.'}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-black">
          {preview ? (
            <img src={preview} alt="Foto capturada" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}

          {exigirFace && !preview && estado === 'pronto' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-3/4 w-3/5 rounded-[50%] border-2 border-dashed border-white/60" />
            </div>
          )}

          {estado === 'erro' && !preview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/80">
              <Camera className="h-8 w-8" />
              Nao foi possivel acessar a camera. Verifique as permissoes do navegador.
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {preview && exigirFace && (
          <div className="text-sm font-semibold">
            {processando
              ? 'Analisando rosto...'
              : face === true
                ? 'Rosto detectado'
                : face === false
                  ? 'Nenhum rosto detectado'
                  : 'Verificacao facial indisponivel'}
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {preview ? (
            <>
              <Button variant="outline" className="flex-1" onClick={refazer}>
                <RefreshCw className="h-4 w-4" /> Refazer
              </Button>
              <Button className="flex-1" onClick={confirmar} disabled={processando}>
                <Check className="h-4 w-4" /> Confirmar
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={capturar}
              disabled={estado !== 'pronto' || processando}
            >
              {exigirFace ? <ScanFace className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
              {estado === 'iniciando' ? 'Abrindo camera...' : 'Capturar foto'}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
