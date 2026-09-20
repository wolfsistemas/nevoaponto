/**
 * Converte um arquivo de imagem em um data URL redimensionado.
 * Usado para guardar a logo da empresa sem depender de storage externo.
 */
export async function arquivoParaImagemDataUrl(
  arquivo: File,
  maxLado = 512,
  qualidade = 0.9,
): Promise<string> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.')
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error('Nao foi possivel ler o arquivo.'))
    leitor.readAsDataURL(arquivo)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Imagem invalida.'))
    el.src = dataUrl
  })

  const maiorLado = Math.max(img.width, img.height)
  const escala = maiorLado > maxLado ? maxLado / maiorLado : 1
  const largura = Math.round(img.width * escala)
  const altura = Math.round(img.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, largura, altura)

  const temTransparencia = arquivo.type === 'image/png' || arquivo.type === 'image/webp'
  return canvas.toDataURL(temTransparencia ? 'image/png' : 'image/jpeg', qualidade)
}

export interface InfoEmpresa {
  nome?: string | null
  cnpj?: string | null
  logo_url?: string | null
}
