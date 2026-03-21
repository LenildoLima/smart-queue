import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const body = await req.json()
    const { 
      nome_completo, email, senha, cpf, 
      telefone, data_nascimento, grupo_prioridade 
    } = body

    if (!email || !senha || !nome_completo) {
      return new Response(
        JSON.stringify({ erro: 'Campos obrigatórios: nome_completo, email, senha' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: authData, error: authError } = 
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { 
          nome_completo,
          full_name: nome_completo,
          display_name: nome_completo
        }
      })

    if (authError) {
      return new Response(
        JSON.stringify({ erro: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await new Promise(r => setTimeout(r, 1500))

    const { error: updateError } = await supabaseAdmin
      .from('perfis')
      .update({
        nome_completo,
        cpf: cpf || null,
        telefone: telefone || null,
        data_nascimento: data_nascimento || null,
        grupo_prioridade: grupo_prioridade || 'normal'
      })
      .eq('id', authData.user.id)

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError)
    }

    return new Response(
      JSON.stringify({ 
        sucesso: true,
        usuario: {
          id: authData.user.id,
          email: authData.user.email
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ erro: err.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
