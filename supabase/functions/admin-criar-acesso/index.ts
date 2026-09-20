// PontoFlow - Edge Function: admin-criar-acesso
// Cria um usuario do Auth (e-mail/senha) e o perfil vinculado a um colaborador,
// sempre dentro da empresa (tenant) de quem chama.
// Permitido para admin (da propria empresa) e superadmin (qualquer empresa).

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
      .select('role, empresa_id')
      .eq('id', userData.user.id)
      .single()
    if (perfilError || !perfil) return json({ error: 'Perfil nao encontrado.' }, 403)
    if (perfil.role !== 'admin' && perfil.role !== 'superadmin') {
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
    const perfilId = body.profile_id ? String(body.profile_id) : null

    const empresaId =
      perfil.role === 'superadmin' && body.empresa_id
        ? String(body.empresa_id)
        : (perfil.empresa_id as string | null)
    if (!empresaId) return json({ error: 'Empresa nao definida para o usuario.' }, 400)

    if (!nome) return json({ error: 'Informe o nome.' }, 400)
    if (!login || !/^[a-z0-9._-]+$/.test(login)) {
      return json({ error: 'Login invalido. Use letras, numeros, ponto, hifen ou underline.' }, 400)
    }

    const emailInformado = String(body.email ?? '').trim().toLowerCase()
    const email = emailInformado || (login.includes('@') ? login : `${login}@pontoflow.app`)

    // Modo edicao: atualiza um acesso existente. A senha e opcional
    // (em branco mantem a senha atual).
    if (perfilId) {
      const { data: alvo, error: alvoError } = await admin
        .from('profiles')
        .select('id, empresa_id, email')
        .eq('id', perfilId)
        .single()
      if (alvoError || !alvo) return json({ error: 'Acesso nao encontrado.' }, 404)
      if (perfil.role !== 'superadmin' && alvo.empresa_id !== empresaId) {
        return json({ error: 'Acesso pertence a outra empresa.' }, 403)
      }
      if (senha && senha.length < 8) {
        return json({ error: 'A senha deve ter ao menos 8 caracteres.' }, 400)
      }

      const authUpdate: { password?: string; email?: string; email_confirm?: boolean } = {}
      if (senha) authUpdate.password = senha
      if (email && email !== alvo.email) {
        authUpdate.email = email
        authUpdate.email_confirm = true
      }
      if (Object.keys(authUpdate).length > 0) {
        const { error: updAuthError } = await admin.auth.admin.updateUserById(perfilId, authUpdate)
        if (updAuthError) return json({ error: updAuthError.message }, 400)
      }

      const patch: Record<string, unknown> = { nome, login, email, role, empresa_id: empresaId }
      if (body.colaborador_id !== undefined) patch.colaborador_id = colaboradorId
      if (body.obra_id !== undefined) patch.obra_id = obraId
      const { error: updError } = await admin.from('profiles').update(patch).eq('id', perfilId)
      if (updError) return json({ error: updError.message }, 400)

      return json({ id: perfilId, email, login, role, atualizado: true })
    }

    if (senha.length < 8) return json({ error: 'A senha deve ter ao menos 8 caracteres.' }, 400)

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
      email,
      role,
      empresa_id: empresaId,
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
