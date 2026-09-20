// PontoFlow - Edge Function: webauthn
// Login por biometria (WebAuthn) e registro de credenciais.
// Acoes de registro/gestao exigem um token valido; o login e publico
// e, ao final, emite um token para criar a sessao do Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------
function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(valor: string): Uint8Array {
  const norm = valor.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4)
  const bin = atob(pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function concatenar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of partes) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

// ---------------------------------------------------------------------------
// Token assinado (HMAC) para guardar o desafio sem estado no servidor
// ---------------------------------------------------------------------------
async function assinarToken(payload: unknown, segredo: string): Promise<string> {
  const corpo = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const assinatura = new Uint8Array(
    await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)),
  )
  return `${corpo}.${b64urlEncode(assinatura)}`
}

async function verificarToken(
  token: string,
  segredo: string,
): Promise<Record<string, unknown>> {
  const [corpo, assinatura] = String(token).split('.')
  if (!corpo || !assinatura) throw new Error('Token invalido.')
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const esperado = new Uint8Array(
    await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)),
  )
  if (b64urlEncode(esperado) !== assinatura) throw new Error('Token invalido.')
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(corpo))) as Record<string, unknown>
  const exp = Number(payload.exp ?? 0)
  if (!exp || exp < Date.now()) throw new Error('Desafio expirado. Tente novamente.')
  return payload
}

// ---------------------------------------------------------------------------
// CBOR minimo (suficiente para attestationObject e chave COSE)
// ---------------------------------------------------------------------------
function cborDecoder(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = 0

  function readLen(additional: number): number {
    if (additional < 24) return additional
    if (additional === 24) {
      const v = view.getUint8(pos)
      pos += 1
      return v
    }
    if (additional === 25) {
      const v = view.getUint16(pos)
      pos += 2
      return v
    }
    if (additional === 26) {
      const v = view.getUint32(pos)
      pos += 4
      return v
    }
    if (additional === 27) {
      const hi = view.getUint32(pos)
      const lo = view.getUint32(pos + 4)
      pos += 8
      return hi * 2 ** 32 + lo
    }
    throw new Error('CBOR invalido.')
  }

  function readItem(): unknown {
    const initial = view.getUint8(pos)
    pos += 1
    const major = initial >> 5
    const additional = initial & 0x1f

    if (major === 0) return readLen(additional)
    if (major === 1) return -1 - readLen(additional)
    if (major === 2) {
      const len = readLen(additional)
      const b = bytes.slice(pos, pos + len)
      pos += len
      return b
    }
    if (major === 3) {
      const len = readLen(additional)
      const s = new TextDecoder().decode(bytes.slice(pos, pos + len))
      pos += len
      return s
    }
    if (major === 4) {
      const len = readLen(additional)
      const arr: unknown[] = []
      for (let i = 0; i < len; i++) arr.push(readItem())
      return arr
    }
    if (major === 5) {
      const len = readLen(additional)
      const obj: Record<string, unknown> = {}
      for (let i = 0; i < len; i++) {
        const k = readItem()
        const v = readItem()
        obj[String(k)] = v
      }
      return obj
    }
    if (major === 6) {
      readLen(additional)
      return readItem()
    }
    // major 7: simples/flutuantes
    if (additional === 20) return false
    if (additional === 21) return true
    if (additional === 22) return null
    if (additional === 23) return undefined
    throw new Error('CBOR: tipo nao suportado.')
  }

  return readItem()
}

// ---------------------------------------------------------------------------
// authData
// ---------------------------------------------------------------------------
interface AuthData {
  flags: number
  signCount: number
  credId: Uint8Array | null
  coseKey: Record<string, unknown> | null
}

function parseAuthData(authData: Uint8Array): AuthData {
  const flags = authData[32]
  const signCount = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0)
  let credId: Uint8Array | null = null
  let coseKey: Record<string, unknown> | null = null
  if (flags & 0x40) {
    let p = 37 + 16
    const idLen = new DataView(authData.buffer, authData.byteOffset + p, 2).getUint16(0)
    p += 2
    credId = authData.slice(p, p + idLen)
    p += idLen
    coseKey = cborDecoder(authData.slice(p)) as Record<string, unknown>
  }
  return { flags, signCount, credId, coseKey }
}

function coseParaJwk(cose: Record<string, unknown>): { jwk: JsonWebKey; alg: string } {
  const kty = Number(cose['1'])
  const algRaw = Number(cose['3'])
  if (kty === 2) {
    if (Number(cose['-1']) !== 1) throw new Error('Curva nao suportada.')
    if (algRaw !== -7) throw new Error('Algoritmo EC nao suportado.')
    return {
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: b64urlEncode(cose['-2'] as Uint8Array),
        y: b64urlEncode(cose['-3'] as Uint8Array),
        ext: true,
      },
      alg: 'ES256',
    }
  }
  if (kty === 3) {
    if (algRaw !== -257) throw new Error('Algoritmo RSA nao suportado.')
    return {
      jwk: {
        kty: 'RSA',
        n: b64urlEncode(cose['-1'] as Uint8Array),
        e: b64urlEncode(cose['-2'] as Uint8Array),
        ext: true,
      },
      alg: 'RS256',
    }
  }
  throw new Error('Tipo de chave nao suportado.')
}

// Converte assinatura ECDSA ASN.1 DER para o formato raw (r||s) do WebCrypto.
function derParaRaw(der: Uint8Array): Uint8Array {
  let i = 0
  if (der[i++] !== 0x30) throw new Error('Assinatura DER invalida.')
  let len = der[i++]
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let k = 0; k < n; k++) len = (len << 8) | der[i++]
  }
  if (der[i++] !== 0x02) throw new Error('Assinatura DER invalida.')
  let rlen = der[i++]
  if (rlen & 0x80) {
    const n = rlen & 0x7f
    rlen = 0
    for (let k = 0; k < n; k++) rlen = (rlen << 8) | der[i++]
  }
  const r = der.slice(i, i + rlen)
  i += rlen
  if (der[i++] !== 0x02) throw new Error('Assinatura DER invalida.')
  let slen = der[i++]
  if (slen & 0x80) {
    const n = slen & 0x7f
    slen = 0
    for (let k = 0; k < n; k++) slen = (slen << 8) | der[i++]
  }
  const s = der.slice(i, i + slen)
  const normalizar = (b: Uint8Array): Uint8Array => {
    let arr = b
    while (arr.length > 0 && arr[0] === 0) arr = arr.slice(1)
    const out = new Uint8Array(32)
    if (arr.length > 32) arr = arr.slice(arr.length - 32)
    out.set(arr, 32 - arr.length)
    return out
  }
  return concatenar(normalizar(r), normalizar(s))
}

async function verificarAssinatura(
  jwk: JsonWebKey,
  alg: string,
  dados: Uint8Array,
  assinatura: Uint8Array,
): Promise<boolean> {
  if (alg === 'ES256') {
    const chave = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      chave,
      derParaRaw(assinatura),
      dados,
    )
  }
  if (alg === 'RS256') {
    const chave = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, chave, assinatura, dados)
  }
  throw new Error('Algoritmo nao suportado.')
}

function validarClientData(
  clientDataJSON: Uint8Array,
  tipoEsperado: string,
  desafio: string,
): void {
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON)) as {
    type?: string
    challenge?: string
    origin?: string
  }
  if (clientData.type !== tipoEsperado) throw new Error('Tipo de credencial invalido.')
  if (clientData.challenge !== desafio) throw new Error('Desafio invalido.')
  const origens = (Deno.env.get('WEBAUTHN_ORIGINS') ?? Deno.env.get('WEBAUTHN_ORIGIN') ?? 'https://wolfsaas.com.br')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  if (origens.length > 0 && !origens.includes(clientData.origin ?? '')) {
    throw new Error('Origem nao permitida.')
  }
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'Ambiente Supabase incompleto.' }, 500)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const segredo = Deno.env.get('WEBAUTHN_SECRET') || serviceKey
    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'wolfsaas.com.br'

    const body = await req.json().catch(() => ({}))
    const acao = String(body.acao ?? '')

    async function usuarioAutenticado(): Promise<{ id: string; email: string; nome: string } | null> {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (!token) return null
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) return null
      const { data: perfil } = await admin
        .from('profiles')
        .select('nome')
        .eq('id', data.user.id)
        .single()
      return { id: data.user.id, email: data.user.email ?? '', nome: perfil?.nome ?? '' }
    }

    // -- Registro -----------------------------------------------------------
    if (acao === 'registrar-iniciar') {
      const usuario = await usuarioAutenticado()
      if (!usuario) return json({ error: 'Nao autenticado.' }, 401)
      const desafio = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
      const token = await assinarToken(
        { tipo: 'registrar', uid: usuario.id, desafio, exp: Date.now() + 5 * 60 * 1000 },
        segredo,
      )
      return json({ desafio, token, rpId, nomeUsuario: usuario.email || usuario.nome, userId: b64urlEncode(new TextEncoder().encode(usuario.id)) })
    }

    if (acao === 'registrar-finalizar') {
      const usuario = await usuarioAutenticado()
      if (!usuario) return json({ error: 'Nao autenticado.' }, 401)
      const payload = await verificarToken(String(body.token ?? ''), segredo)
      if (payload.tipo !== 'registrar' || payload.uid !== usuario.id) {
        return json({ error: 'Sessao de registro invalida.' }, 400)
      }
      const cred = body.credential as {
        id?: string
        response?: { attestationObject?: string; clientDataJSON?: string; transports?: string[] }
      }
      if (!cred?.id || !cred.response?.attestationObject || !cred.response.clientDataJSON) {
        return json({ error: 'Credencial incompleta.' }, 400)
      }
      validarClientData(
        b64urlDecode(cred.response.clientDataJSON),
        'webauthn.create',
        String(payload.desafio),
      )
      const attestation = cborDecoder(b64urlDecode(cred.response.attestationObject)) as {
        authData?: Uint8Array
      }
      if (!attestation?.authData) return json({ error: 'Attestation invalida.' }, 400)
      const rpIdHashEsperado = await sha256(new TextEncoder().encode(rpId))
      if (b64urlEncode(attestation.authData.slice(0, 32)) !== b64urlEncode(rpIdHashEsperado)) {
        return json({ error: 'RP ID nao confere.' }, 400)
      }
      const { flags, signCount, credId, coseKey } = parseAuthData(attestation.authData)
      if (!(flags & 0x01)) return json({ error: 'Presenca do usuario nao confirmada.' }, 400)
      if (!(flags & 0x04)) return json({ error: 'Verificacao biometrica obrigatoria.' }, 400)
      if (!credId || !coseKey) return json({ error: 'Chave publica ausente.' }, 400)
      if (b64urlEncode(credId) !== cred.id) {
        return json({ error: 'Identificador da credencial nao confere.' }, 400)
      }
      const { jwk, alg } = coseParaJwk(coseKey)

      const { data: existente } = await admin
        .from('webauthn_credenciais')
        .select('usuario_id')
        .eq('credencial_id', cred.id)
        .maybeSingle()
      if (existente && existente.usuario_id !== usuario.id) {
        return json({ error: 'Credencial ja vinculada a outro usuario.' }, 409)
      }

      const { error } = await admin.from('webauthn_credenciais').upsert(
        {
          usuario_id: usuario.id,
          credencial_id: cred.id,
          chave_publica: JSON.stringify(jwk),
          algoritmo: alg,
          contador: signCount,
          apelido: String(body.apelido ?? '').slice(0, 60) || null,
        },
        { onConflict: 'credencial_id' },
      )
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    // -- Login --------------------------------------------------------------
    if (acao === 'login-iniciar') {
      const login = String(body.login ?? '').trim().toLowerCase()
      if (!login) return json({ error: 'Informe o usuario.' }, 400)
      const email = login.includes('@') ? login : `${login}@pontoflow.app`
      const { data: perfil } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (!perfil) return json({ error: 'Usuario sem biometria cadastrada.' }, 404)
      const { data: creds } = await admin
        .from('webauthn_credenciais')
        .select('credencial_id')
        .eq('usuario_id', perfil.id)
      if (!creds || creds.length === 0) {
        return json({ error: 'Usuario sem biometria cadastrada.' }, 404)
      }
      const desafio = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
      const token = await assinarToken(
        { tipo: 'login', uid: perfil.id, desafio, exp: Date.now() + 5 * 60 * 1000 },
        segredo,
      )
      return json({
        desafio,
        token,
        rpId,
        allowCredentials: creds.map((c) => ({ id: c.credencial_id, type: 'public-key' })),
      })
    }

    if (acao === 'login-finalizar') {
      const payload = await verificarToken(String(body.token ?? ''), segredo)
      if (payload.tipo !== 'login') return json({ error: 'Sessao invalida.' }, 400)
      const uid = String(payload.uid)
      const cred = body.credential as {
        id?: string
        response?: { authenticatorData?: string; clientDataJSON?: string; signature?: string }
      }
      if (!cred?.id || !cred.response?.authenticatorData || !cred.response.clientDataJSON || !cred.response.signature) {
        return json({ error: 'Assinatura incompleta.' }, 400)
      }
      const { data: salva } = await admin
        .from('webauthn_credenciais')
        .select('id, chave_publica, algoritmo, contador')
        .eq('credencial_id', cred.id)
        .eq('usuario_id', uid)
        .maybeSingle()
      if (!salva) return json({ error: 'Credencial nao reconhecida.' }, 401)

      const clientDataJSON = b64urlDecode(cred.response.clientDataJSON)
      validarClientData(clientDataJSON, 'webauthn.get', String(payload.desafio))
      const authenticatorData = b64urlDecode(cred.response.authenticatorData)
      const rpIdHash = await sha256(new TextEncoder().encode(rpId))
      const recebido = authenticatorData.slice(0, 32)
      if (b64urlEncode(rpIdHash) !== b64urlEncode(recebido)) {
        return json({ error: 'RP ID nao confere.' }, 401)
      }
      const flags = authenticatorData[32]
      if (!(flags & 0x01) || !(flags & 0x04)) {
        return json({ error: 'Verificacao biometrica obrigatoria.' }, 401)
      }
      const esperado = concatenar(authenticatorData, await sha256(clientDataJSON))
      const ok = await verificarAssinatura(
        JSON.parse(salva.chave_publica) as JsonWebKey,
        salva.algoritmo,
        esperado,
        b64urlDecode(cred.response.signature),
      )
      if (!ok) return json({ error: 'Biometria nao reconhecida.' }, 401)

      const contador = new DataView(authenticatorData.buffer, authenticatorData.byteOffset + 33, 4).getUint32(0)
      await admin
        .from('webauthn_credenciais')
        .update({ contador, ultimo_uso: new Date().toISOString() })
        .eq('id', salva.id)

      const { data: userData } = await admin.auth.admin.getUserById(uid)
      const email = userData.user?.email
      if (!email) return json({ error: 'Usuario sem e-mail.' }, 400)
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })
      if (linkError || !link?.properties?.hashed_token) {
        return json({ error: linkError?.message ?? 'Falha ao criar sessao.' }, 400)
      }
      return json({ ok: true, email, token_hash: link.properties.hashed_token })
    }

    // -- Gestao -------------------------------------------------------------
    if (acao === 'listar') {
      const usuario = await usuarioAutenticado()
      if (!usuario) return json({ error: 'Nao autenticado.' }, 401)
      const { data } = await admin
        .from('webauthn_credenciais')
        .select('id, apelido, created_at, ultimo_uso')
        .eq('usuario_id', usuario.id)
        .order('created_at', { ascending: false })
      return json({ itens: data ?? [] })
    }

    if (acao === 'remover') {
      const usuario = await usuarioAutenticado()
      if (!usuario) return json({ error: 'Nao autenticado.' }, 401)
      const id = String(body.id ?? '')
      if (!id) return json({ error: 'Credencial nao informada.' }, 400)
      const { error } = await admin
        .from('webauthn_credenciais')
        .delete()
        .eq('id', id)
        .eq('usuario_id', usuario.id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Acao desconhecida.' }, 400)
  } catch (erro) {
    return json({ error: erro instanceof Error ? erro.message : String(erro) }, 500)
  }
})
