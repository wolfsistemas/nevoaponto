// PontoFlow - Edge Function: criar-conta (auto-cadastro / multitenant)
// Cria empresa (trial), usuario admin e uma obra inicial.
// Endpoint publico (verify_jwt = false).

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

const TERMOS_VERSAO = '2026-09'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'Ambiente Supabase incompleto.' }, 500)

    const body = await req.json().catch(() => ({}))
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const empresaNome = String(body.empresa ?? '').trim()
    const nome = String(body.nome ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const senha = String(body.senha ?? '')
    const telefone = body.telefone ? String(body.telefone).trim() : null
    const cnpj = body.cnpj ? String(body.cnpj).trim() : null
    const aceitouTermos = body.aceitou_termos === true

    if (body.website) return json({ error: 'Cadastro invalido.' }, 400)
    if (!empresaNome) return json({ error: 'Informe o nome da empresa.' }, 400)
    if (!nome) return json({ error: 'Informe o seu nome.' }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail invalido.' }, 400)
    if (senha.length < 8) return json({ error: 'A senha deve ter ao menos 8 caracteres.' }, 400)
    if (!aceitouTermos) {
      return json({ error: 'E necessario aceitar os Termos de Uso e a Politica de Privacidade.' }, 400)
    }

    const trialAte = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

    const { data: empresa, error: empresaError } = await admin
      .from('empresas')
      .insert({
        nome: empresaNome,
        cnpj,
        email_contato: email,
        telefone,
        plano: 'trial',
        status: 'trial',
        trial_ate: trialAte,
        valor_mensal: 0,
        termos_aceitos_em: new Date().toISOString(),
        termos_versao: TERMOS_VERSAO,
      })
      .select()
      .single()
    if (empresaError || !empresa) {
      return json({ error: empresaError?.message ?? 'Falha ao criar a empresa.' }, 400)
    }

    const { data: criado, error: createError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, empresa: empresaNome },
    })
    if (createError || !criado.user) {
      await admin.from('empresas').delete().eq('id', empresa.id)
      return json({ error: createError?.message ?? 'Falha ao criar o usuario.' }, 400)
    }

    const { error: perfilError } = await admin.from('profiles').insert({
      id: criado.user.id,
      nome,
      login: email,
      email,
      role: 'admin',
      empresa_id: empresa.id,
      ativo: true,
    })
    if (perfilError) {
      await admin.auth.admin.deleteUser(criado.user.id)
      await admin.from('empresas').delete().eq('id', empresa.id)
      return json({ error: perfilError.message }, 400)
    }

    await admin.from('obras').insert({
      nome: 'Minha primeira obra',
      empresa_id: empresa.id,
      raio_tolerancia: 80,
      ativo: true,
    })

    return json({ ok: true, email, empresa_id: empresa.id, trial_ate: trialAte })
  } catch (erro) {
    return json({ error: erro instanceof Error ? erro.message : String(erro) }, 500)
  }
})
