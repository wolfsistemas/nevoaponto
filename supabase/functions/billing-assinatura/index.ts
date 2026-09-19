// PontoFlow - Edge Function: billing-assinatura
// Acoes autenticadas da assinatura da empresa (Mercado Pago).
//   body: { acao?: 'criar' | 'cancelar', plano_id?: string, empresa_id?: string }
// verify_jwt = true (chamada pelo app com a sessao do usuario).

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

const MP_API = 'https://api.mercadopago.com'

function accessToken(): string | undefined {
  return Deno.env.get('MP_ACCESS_TOKEN') ?? Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'Ambiente Supabase incompleto.' }, 500)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Nao autenticado.' }, 401)

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Sessao invalida.' }, 401)

    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('role, empresa_id, email, nome')
      .eq('id', userData.user.id)
      .single()
    if (perfilError || !perfil) return json({ error: 'Perfil nao encontrado.' }, 403)
    if (perfil.role !== 'admin' && perfil.role !== 'superadmin') {
      return json({ error: 'Apenas administradores podem gerenciar a assinatura.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const acao = String(body.acao ?? 'criar')
    const empresaId =
      perfil.role === 'superadmin' && body.empresa_id ? String(body.empresa_id) : perfil.empresa_id
    if (!empresaId) return json({ error: 'Empresa nao definida para o usuario.' }, 400)

    const mpToken = accessToken()
    if (!mpToken) {
      return json(
        { error: 'Mercado Pago nao configurado. Defina o segredo MP_ACCESS_TOKEN na Edge Function.' },
        503,
      )
    }

    if (acao === 'cancelar') {
      const { data: assinatura } = await admin
        .from('assinaturas')
        .select('id, mp_preapproval_id')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!assinatura?.mp_preapproval_id) {
        return json({ error: 'Nenhuma assinatura ativa encontrada.' }, 404)
      }

      const resposta = await fetch(`${MP_API}/preapproval/${assinatura.mp_preapproval_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'canceled' }),
      })
      const dados = (await resposta.json().catch(() => ({}))) as { message?: string }
      if (!resposta.ok) {
        return json({ error: dados?.message ?? 'Falha ao cancelar no Mercado Pago.' }, 502)
      }

      await admin
        .from('assinaturas')
        .update({ status: 'cancelada', cancelada_em: new Date().toISOString() })
        .eq('id', assinatura.id)
      await admin.from('empresas').update({ status: 'cancelado' }).eq('id', empresaId)
      return json({ ok: true })
    }

    // Acao padrao: criar checkout de assinatura recorrente.
    const planoId = String(body.plano_id ?? '')
    if (!planoId) return json({ error: 'Informe o plano desejado.' }, 400)

    const { data: plano } = await admin.from('planos').select('*').eq('id', planoId).single()
    if (!plano) return json({ error: 'Plano nao encontrado.' }, 404)
    if (Number(plano.valor_mensal) <= 0) {
      return json({ error: 'O plano selecionado e gratuito e nao precisa de assinatura.' }, 400)
    }

    const { data: empresa } = await admin.from('empresas').select('*').eq('id', empresaId).single()
    if (!empresa) return json({ error: 'Empresa nao encontrada.' }, 404)

    const origem = (Deno.env.get('APP_URL') ?? req.headers.get('origin') ?? '').replace(/\/+$/, '')
    const backUrl = origem ? `${origem}/#/assinatura` : undefined

    const payload: Record<string, unknown> = {
      reason: `PontoFlow - Plano ${plano.nome}`,
      external_reference: empresaId,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: Number(plano.valor_mensal),
        currency_id: 'BRL',
      },
      status: 'pending',
    }
    const payerEmail = empresa.email_contato ?? perfil.email ?? undefined
    if (payerEmail) payload.payer_email = payerEmail
    if (backUrl) payload.back_url = backUrl

    const resposta = await fetch(`${MP_API}/preapproval`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const dados = (await resposta.json().catch(() => ({}))) as {
      id?: string
      init_point?: string
      sandbox_init_point?: string
      message?: string
    }
    if (!resposta.ok) {
      return json({ error: dados?.message ?? 'Falha ao criar a assinatura no Mercado Pago.' }, 502)
    }

    const initPoint = dados.init_point ?? dados.sandbox_init_point ?? null
    if (!initPoint) return json({ error: 'Mercado Pago nao retornou o link de pagamento.' }, 502)

    await admin.from('assinaturas').upsert(
      {
        empresa_id: empresaId,
        plano_id: planoId,
        status: 'pendente',
        valor: Number(plano.valor_mensal),
        mp_preapproval_id: dados.id ?? null,
        mp_external_reference: empresaId,
        init_point: initPoint,
      },
      { onConflict: 'empresa_id' },
    )

    return json({ ok: true, init_point: initPoint, preapproval_id: dados.id ?? null })
  } catch (erro) {
    return json({ error: erro instanceof Error ? erro.message : String(erro) }, 500)
  }
})
