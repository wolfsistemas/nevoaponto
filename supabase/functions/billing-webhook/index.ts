// PontoFlow - Edge Function: billing-webhook
// Recebe notificacoes do Mercado Pago (preapproval e pagamentos) e sincroniza
// assinatura, empresa e historico de pagamentos.
// Endpoint publico (verify_jwt = false), protegido por assinatura HMAC opcional.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const MP_API = 'https://api.mercadopago.com'

function accessToken(): string | undefined {
  return Deno.env.get('MP_ACCESS_TOKEN') ?? Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? undefined
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Valida o header x-signature do Mercado Pago. Sem segredo, nao valida. */
async function assinaturaValida(req: Request, id: string): Promise<boolean> {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET')
  if (!secret) return true

  const header = req.headers.get('x-signature') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''
  const partes: Record<string, string> = {}
  for (const pedaco of header.split(',')) {
    const [chave, valor] = pedaco.split('=')
    if (chave && valor) partes[chave.trim()] = valor.trim()
  }
  const ts = partes.ts
  const v1 = partes.v1
  if (!ts || !v1) return false

  const manifest = `id:${id};request-id:${requestId};ts:${ts};`
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(manifest))
  return hex(mac) === v1
}

async function tratarPreapproval(admin: SupabaseClient, mpToken: string, id: string) {
  const resposta = await fetch(`${MP_API}/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  const d = (await resposta.json().catch(() => ({}))) as Record<string, any>
  if (!resposta.ok) return

  const empresaId: string | null = d.external_reference ?? null
  const mapa: Record<string, string> = {
    authorized: 'autorizada',
    paused: 'pausada',
    cancelled: 'cancelada',
    pending: 'pendente',
  }
  const status = mapa[String(d.status ?? '')] ?? 'pendente'

  let assinatura: Record<string, any> | null = null
  const { data: porId } = await admin.from('assinaturas').select('*').eq('mp_preapproval_id', id).maybeSingle()
  assinatura = porId ?? null
  if (!assinatura && empresaId) {
    const { data } = await admin.from('assinaturas').select('*').eq('empresa_id', empresaId).maybeSingle()
    assinatura = data ?? null
  }

  if (assinatura) {
    await admin
      .from('assinaturas')
      .update({
        status,
        valor: Number(d.auto_recurring?.transaction_amount ?? assinatura.valor ?? 0),
        periodo_inicio: d.auto_recurring?.start_date ?? assinatura.periodo_inicio ?? null,
        periodo_fim: d.auto_recurring?.end_date ?? assinatura.periodo_fim ?? null,
        proxima_cobranca: d.next_payment_date ?? assinatura.proxima_cobranca ?? null,
      })
      .eq('id', assinatura.id)
  }

  const empresaAlvo: string | null = empresaId ?? assinatura?.empresa_id ?? null
  if (!empresaAlvo) return

  if (status === 'autorizada') {
    await admin
      .from('empresas')
      .update({
        status: 'ativo',
        plano: assinatura?.plano_id ?? 'profissional',
        valor_mensal: Number(d.auto_recurring?.transaction_amount ?? assinatura?.valor ?? 0),
        trial_ate: null,
        mp_preapproval_id: id,
      })
      .eq('id', empresaAlvo)
  } else if (status === 'cancelada') {
    await admin.from('empresas').update({ status: 'cancelado' }).eq('id', empresaAlvo)
  }
}

async function tratarPagamento(admin: SupabaseClient, mpToken: string, id: string) {
  const resposta = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  const d = (await resposta.json().catch(() => ({}))) as Record<string, any>
  if (!resposta.ok) return

  const preapprovalId: string | null = d.metadata?.preapproval_id ?? d.preapproval_id ?? null
  let assinatura: Record<string, any> | null = null
  if (preapprovalId) {
    const { data } = await admin
      .from('assinaturas')
      .select('*')
      .eq('mp_preapproval_id', preapprovalId)
      .maybeSingle()
    assinatura = data ?? null
  }

  const empresaId: string | null = d.external_reference ?? assinatura?.empresa_id ?? null
  if (!empresaId) return

  const mpStatus = String(d.status ?? 'pending')
  const registro = {
    empresa_id: empresaId,
    assinatura_id: assinatura?.id ?? null,
    mp_payment_id: String(d.id ?? id),
    mp_preapproval_id: preapprovalId,
    plano_id: assinatura?.plano_id ?? null,
    status: mpStatus,
    valor: Number(d.transaction_amount ?? 0),
    moeda: d.currency_id ?? 'BRL',
    metodo: d.payment_method_id ?? d.payment_type_id ?? null,
    pago_em: d.date_approved ?? null,
    payload: d,
  }

  const { data: existente } = await admin
    .from('pagamentos')
    .select('id')
    .eq('mp_payment_id', registro.mp_payment_id)
    .maybeSingle()
  if (existente) await admin.from('pagamentos').update(registro).eq('id', existente.id)
  else await admin.from('pagamentos').insert(registro)

  if (mpStatus === 'approved' && assinatura) {
    const proxima = new Date()
    proxima.setMonth(proxima.getMonth() + 1)
    await admin
      .from('assinaturas')
      .update({ status: 'autorizada', proxima_cobranca: proxima.toISOString() })
      .eq('id', assinatura.id)
    await admin
      .from('empresas')
      .update({
        status: 'ativo',
        plano: assinatura.plano_id,
        valor_mensal: Number(d.transaction_amount ?? assinatura.valor ?? 0),
        trial_ate: null,
      })
      .eq('id', empresaId)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method === 'GET') return json({ ok: true })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'Ambiente Supabase incompleto.' }, 500)

    const body = (await req.json().catch(() => ({}))) as Record<string, any>
    const params = new URL(req.url).searchParams
    const tipo = String(body.type ?? body.topic ?? params.get('type') ?? '')
    const id = String(body.data?.id ?? params.get('data.id') ?? params.get('id') ?? '')
    if (!tipo || !id) return json({ ok: true, ignorado: true })

    if (!(await assinaturaValida(req, id))) {
      return json({ error: 'Assinatura do webhook invalida.' }, 401)
    }

    const mpToken = accessToken()
    if (!mpToken) return json({ error: 'Mercado Pago nao configurado.' }, 503)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    if (tipo.includes('payment')) {
      await tratarPagamento(admin, mpToken, id)
    } else if (tipo.includes('preapproval')) {
      await tratarPreapproval(admin, mpToken, id)
    }

    return json({ ok: true })
  } catch (erro) {
    // Retornamos 200 para o MP nao ficar reenviando indefinidamente; o erro fica logado.
    console.error('billing-webhook', erro)
    return json({ ok: false })
  }
})
