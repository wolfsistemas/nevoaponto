// PontoFlow - Edge Function: admin-criar-acesso
// Cria um usuario do Auth (e-mail/senha) e o perfil vinculado a um colaborador.
// Somente administradores autenticados podem chamar.
//
// Variaveis de ambiente injetadas automaticamente pelo Supabase:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'Ambiente Supabase incompleto.' }, 500)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Nao autenticado.' }, 401)

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Sessao invalida.' }, 401)

    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (perfilError || perfil?.role !== 'admin') {
      return json({ error: 'Apenas administradores podem criar acessos.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const nome = String(body.nome ?? '').trim()
    const login = String(body.login ?? '').trim().toLowerCase()
    const senha = String(body.senha ?? '')
    const role = ['admin', 'encarregado', 'funcionario'].includes(body.role)
      ? body.role
      : 'funcionario'
    const colaboradorId = body.colaborador_id ? String(body.colaborador_id) : null
    const obraId = body.obra_id ? String(body.obra_id) : null

    if (!nome) return json({ error: 'Informe o nome.' }, 400)
    if (!login || !/^[a-z0-9._-]+$/.test(login)) {
      return json({ error: 'Login invalido. Use letras, numeros, ponto, hifen ou underline.' }, 400)
    }
    if (senha.length < 6) return json({ error: 'A senha deve ter ao menos 6 caracteres.' }, 400)

    const email = login.includes('@') ? login : `${login}@pontoflow.app`

    const { data: criado, error: createError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (createError || !criado.user) {
      return json({ error: createError?.message ?? 'Falha ao criar usuario.' }, 400)
    }

    const { error: upsertError } = await admin.from('profiles').upsert({
      id: criado.user.id,
      nome,
      login,
      role,
      colaborador_id: colaboradorId,
      obra_id: obraId,
      ativo: true,
    })
    if (upsertError) return json({ error: upsertError.message }, 400)

    return json({ id: criado.user.id, email, login, role })
  } catch (erro) {
    return json({ error: erro instanceof Error ? erro.message : String(erro) }, 500)
  }
})
