// =============================================================
//  notificar-fila/index.ts
//
//  Verifica a fila de uma unidade e envia notificações
//  para usuários que estão próximos de serem atendidos.
//
//  Deve ser chamada via:
//    - Supabase Database Webhook (ao UPDATE na tabela `fila`)
//    - Cron job agendado pelo Supabase (pg_cron) a cada ~1 min
//    - Chamada manual do painel admin
//
//  Endpoint: POST /functions/v1/notificar-fila
//
//  Body esperado:
//  {
//    "unidade_id": "uuid-da-unidade",
//    "limite_pessoas": 3          // opcional — padrão: 3
//  }
//
//  O que faz:
//    1. Busca todos os usuários aguardando na fila da unidade
//    2. Para cada um, chama internamente previsao-espera
//    3. Se pessoas_a_frente <= limite_pessoas → cria notificação
//    4. Evita duplicatas (não re-notifica quem já foi avisado)
//
//  Resposta:
//  {
//    "notificacoes_enviadas": 2,
//    "detalhes": [...]
//  }
// =============================================================

import { criarClienteSupabase, respostaErro, respostaJson } from "../_compartilhado/supabase.ts";

// ── Constantes ───────────────────────────────────────────────
const LIMITE_PADRAO_PESSOAS = 3; // notifica quando faltam até X pessoas

Deno.serve(async (req: Request) => {

  // ── CORS ────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return respostaErro("Método não permitido. Use POST.", 405);
  }

  // ── Leitura do body ─────────────────────────────────────────
  let unidade_id: string;
  let limite_pessoas: number;

  try {
    const body = await req.json();
    unidade_id = body?.unidade_id;
    limite_pessoas = body?.limite_pessoas ?? LIMITE_PADRAO_PESSOAS;

    if (!unidade_id) throw new Error("Campo 'unidade_id' obrigatório.");
  } catch {
    return respostaErro("Body inválido. Informe o campo 'unidade_id'.");
  }

  const supabase = criarClienteSupabase();

  // ── 1. Busca toda a fila ativa da unidade ───────────────────
  const { data: filaAtiva, error: erroFila } = await supabase
    .from("fila")
    .select(`
      id,
      posicao,
      agendamento_id,
      agendamentos (
        id,
        usuario_id,
        status,
        numero_senha,
        grupo_prioridade,
        tipo_atendimento_id
      )
    `)
    .eq("unidade_id", unidade_id)
    .is("finalizado_em", null)
    .is("chamado_em", null)          // apenas quem ainda não foi chamado
    .order("posicao", { ascending: true });

  if (erroFila) {
    return respostaErro("Erro ao buscar fila da unidade.", 500);
  }

  if (!filaAtiva || filaAtiva.length === 0) {
    return respostaJson({ mensagem: "Fila vazia. Nenhuma notificação enviada.", notificacoes_enviadas: 0 });
  }

  // ── 2. Para cada entrada na fila, calcula pessoas à frente ──
  const notificacoesEnviadas: object[] = [];
  const erros: object[] = [];

  for (const entrada of filaAtiva) {
    const agend = entrada.agendamentos as {
      id: string;
      usuario_id: string;
      status: string;
      numero_senha: string | null;
      grupo_prioridade: string;
    } | null;

    if (!agend || agend.status !== "aguardando") continue;

    // Conta quantas pessoas estão à frente nesta fila
    const pessoasAFrente = filaAtiva.filter(
      (e) => e.posicao < entrada.posicao
    ).length;

    // Só notifica se estiver dentro do limite
    if (pessoasAFrente > limite_pessoas) continue;

    // ── 3. Verifica se já existe notificação recente (evita spam) ──
    const { data: notifExistente } = await supabase
      .from("notificacoes")
      .select("id, criado_em")
      .eq("usuario_id", agend.usuario_id)
      .eq("agendamento_id", agend.id)
      .in("status", ["pendente", "enviada"])
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (notifExistente) {
      // Ignora se a última notificação foi há menos de 5 minutos
      const criadoEm = new Date(notifExistente.criado_em).getTime();
      const agora    = Date.now();
      const cincoMin = 5 * 60 * 1000;

      if (agora - criadoEm < cincoMin) continue;
    }

    // ── 4. Monta mensagem personalizada ────────────────────────
    const { titulo, mensagem } = montarMensagem(
      pessoasAFrente,
      agend.numero_senha,
      agend.grupo_prioridade
    );

    // ── 5. Insere notificação na tabela ─────────────────────────
    const { error: erroInsert } = await supabase
      .from("notificacoes")
      .insert({
        usuario_id:     agend.usuario_id,
        agendamento_id: agend.id,
        titulo,
        mensagem,
        status:         "pendente",
      });

    if (erroInsert) {
      erros.push({
        agendamento_id: agend.id,
        erro: erroInsert.message,
      });
      continue;
    }

    notificacoesEnviadas.push({
      agendamento_id:  agend.id,
      usuario_id:      agend.usuario_id,
      numero_senha:    agend.numero_senha,
      posicao:         entrada.posicao,
      pessoas_a_frente: pessoasAFrente,
      titulo,
    });
  }

  // ── 6. Retorna resumo ────────────────────────────────────────
  return respostaJson({
    unidade_id,
    notificacoes_enviadas: notificacoesEnviadas.length,
    detalhes:              notificacoesEnviadas,
    erros:                 erros.length > 0 ? erros : undefined,
    verificado_em:         new Date().toISOString(),
  });
});


// =============================================================
//  Helpers
// =============================================================

function montarMensagem(
  pessoasAFrente: number,
  numeroSenha: string | null,
  grupoPrioridade: string
): { titulo: string; mensagem: string } {
  const senha = numeroSenha ? ` (Senha: ${numeroSenha})` : "";
  const isPrioritario = grupoPrioridade !== "normal";

  if (pessoasAFrente === 0) {
    return {
      titulo:   "🔔 É a sua vez!",
      mensagem: `${isPrioritario ? "Atendimento prioritário: sua" : "Sua"} vez chegou${senha}. Dirija-se ao guichê agora.`,
    };
  }

  if (pessoasAFrente === 1) {
    return {
      titulo:   "⏳ Quase lá! Falta 1 pessoa.",
      mensagem: `Você é o próximo${senha}. Fique atento e dirija-se ao local de atendimento.`,
    };
  }

  return {
    titulo:   `⏳ Faltam ${pessoasAFrente} pessoas na sua frente.`,
    mensagem: `Prepare-se${senha}. Em breve será a sua vez. Fique próximo ao local de atendimento.`,
  };
}
