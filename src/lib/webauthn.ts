import { api } from '@/data/api'

function b64urlParaBytes(valor: string): Uint8Array<ArrayBuffer> {
  const norm = valor.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4)
  const bin = atob(pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesParaB64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function biometriaDisponivel(): Promise<boolean> {
  if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false
  try {
    const disponivel = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    return Boolean(disponivel)
  } catch {
    return false
  }
}

interface InicioRegistro {
  desafio: string
  token: string
  rpId: string
  userId: string
  nomeUsuario: string
}

interface InicioLogin {
  desafio: string
  token: string
  rpId: string
  allowCredentials: { id: string; type: string }[]
}

/** Registra a biometria (digital/rosto) do dispositivo para o usuario logado. */
export async function registrarBiometria(apelido?: string): Promise<void> {
  const inicio = await api.webauthn<InicioRegistro>({ acao: 'registrar-iniciar' })
  const credencial = (await navigator.credentials.create({
    publicKey: {
      challenge: b64urlParaBytes(inicio.desafio),
      rp: { id: inicio.rpId, name: 'PontoFlow' },
      user: {
        id: b64urlParaBytes(inicio.userId),
        name: inicio.nomeUsuario,
        displayName: inicio.nomeUsuario,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null

  if (!credencial) throw new Error('Registro cancelado.')
  const resposta = credencial.response as AuthenticatorAttestationResponse
  await api.webauthn({
    acao: 'registrar-finalizar',
    token: inicio.token,
    apelido,
    credential: {
      id: credencial.id,
      rawId: bytesParaB64url(credencial.rawId),
      type: credencial.type,
      response: {
        attestationObject: bytesParaB64url(resposta.attestationObject),
        clientDataJSON: bytesParaB64url(resposta.clientDataJSON),
        transports: resposta.getTransports?.() ?? [],
      },
    },
  })
}

/** Autentica com biometria e devolve o token para criar a sessao do Supabase. */
export async function autenticarComBiometria(
  login: string,
): Promise<{ email: string; token_hash: string }> {
  const inicio = await api.webauthn<InicioLogin>({ acao: 'login-iniciar', login })
  const credencial = (await navigator.credentials.get({
    publicKey: {
      challenge: b64urlParaBytes(inicio.desafio),
      rpId: inicio.rpId,
      allowCredentials: inicio.allowCredentials.map((c) => ({
        id: b64urlParaBytes(c.id),
        type: 'public-key' as const,
      })),
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!credencial) throw new Error('Login cancelado.')
  const resposta = credencial.response as AuthenticatorAssertionResponse
  return api.webauthn<{ email: string; token_hash: string }>({
    acao: 'login-finalizar',
    token: inicio.token,
    credential: {
      id: credencial.id,
      rawId: bytesParaB64url(credencial.rawId),
      type: credencial.type,
      response: {
        authenticatorData: bytesParaB64url(resposta.authenticatorData),
        clientDataJSON: bytesParaB64url(resposta.clientDataJSON),
        signature: bytesParaB64url(resposta.signature),
      },
    },
  })
}
