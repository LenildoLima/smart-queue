// =============================================================
//  previsao-espera/index.ts
//
//  Calcula o tempo estimado de espera para um agendamento
//  com base na posição na fila e na duração média dos serviços.
//
//  Endpoint: POST /functions/v1/previsao-espera
//
//  Body esperado:
//  {
//    "agendamento_id": "uuid-do-agendamento"
//  }
//
//  Resposta:
//  {
//    "posicao_atual": 5,
//    "pessoas_a_frente": 4,
//    "minutos_estimados": 60,
//    "previsao_horario": "14:30",
//    "duracao_media_servico": 15,
//    "prioridades_a_frente": 2
//  }
// =============================================================

import { criarClienteSupabase, respostaErro, respostaJson } from "../_compartilhado/supabase.ts";

Deno.serve(async (req: Request) => {

  // ── CORS para o Lovable/frontend ────────────────────────────
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
  let agendamento_id: string;
  try {
    const body = await req.json();
    agendamento_id = body?.agendamento_id;
    if (!agendamento_id) throw new Error("Campo obrigatório ausente");
  } catch {
    return respostaErro("Body inválido. Informe o campo 'agendamento_id'.");
  }

  const supabase = criarClienteSupabase();

  // ── 1. Busca o agendamento com o tipo de atendimento ────────
  const { data: agendamento, error: erroAgendamento } = await supabase
    .from("agendamentos")
    .select(`
      id,
      unidade_id,
      usuario_id,
      status,
      grupo_prioridade,
      pontuacao_prioridade,
      tipo_atendimento_id,
      tipos_atendimento ( duracao_media_minutos, nome )
    `)
    .eq("id", agendamento_id)
    .single();

  if (erroAgendamento || !agendamento) {
    return respostaErro("Agendamento não encontrado.", 404);
  }

  if (!["agendado", "aguardando"].includes(agendamento.status)) {
    return respostaErro(
      `Agendamento com status '${agendamento.status}' não está na fila ativa.`,
      422
    );
  }

  // ── 2. Busca a posição atual na fila ────────────────────────
  const { data: entradaFila, error: erroFila } = await supabase
    .from("fila")
    .select("posicao")
    .eq("agendamento_id", agendamento_id)
    .is("finalizado_em", null)
    .single();

  if (erroFila || !entradaFila) {
    return respostaErro(
      "Este agendamento ainda não entrou na fila. Status deve ser 'aguardando'.",
      404
    );
  }

  const minhaPosicao: number = entradaFila.posicao;

  // ── 3. Busca todos na fila desta unidade com posição menor ──
  //    (ou seja, as pessoas que ainda estão à frente)
  const { data: pessoasAFrente, error: erroFrente } = await supabase
    .from("fila")
    .select(`
      posicao,
      agendamento_id,
      agendamentos ( grupo_prioridade, pontuacao_prioridade, tipo_atendimento_id,
        tipos_atendimento ( duracao_media_minutos )
      )
    `)
    .eq("unidade_id", agendamento.unidade_id)
    .lt("posicao", minhaPosicao)
    .is("finalizado_em", null)
    .order("posicao", { ascending: true });

  if (erroFrente) {
    return respostaErro("Erro ao consultar fila.", 500);
  }

  const quantidadeAFrente = pessoasAFrente?.length ?? 0;

  // ── 4. Calcula tempo estimado ────────────────────────────────
  //    Soma a duração média de cada serviço das pessoas à frente
  //    Se não encontrar o serviço, usa a duração média do próprio agendamento

  const duracaoProprio: number =
    (agendamento.tipos_atendimento as { duracao_media_minutos: number })
      ?.duracao_media_minutos ?? 15;

  let minutosAcumulados = 0;
  let prioridadesAFrente = 0;

  for (const pessoa of pessoasAFrente ?? []) {
    const agend = pessoa.agendamentos as {
      grupo_prioridade: string;
      tipos_atendimento: { duracao_media_minutos: number } | null;
    } | null;

    const duracao = agend?.tipos_atendimento?.duracao_media_minutos ?? duracaoProprio;
    minutosAcumulados += duracao;

    if (agend?.grupo_prioridade !== "normal") {
      prioridadesAFrente++;
    }
  }

  // ── 5. Calcula o horário previsto de atendimento ─────────────
  const agora = new Date();
  const previsaoMs = agora.getTime() + minutosAcumulados * 60 * 1000;
  const previsaoHorario = new Date(previsaoMs).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  // ── 6. Define nível de alerta ────────────────────────────────
  let alerta: "longe" | "chegando" | "proximo" | "agora";
  if (quantidadeAFrente === 0) {
    alerta = "agora";
  } else if (quantidadeAFrente <= 2) {
    alerta = "proximo";
  } else if (quantidadeAFrente <= 5) {
    alerta = "chegando";
  } else {
    alerta = "longe";
  }

  // ── Resposta ─────────────────────────────────────────────────
  return respostaJson({
    agendamento_id,
    posicao_atual: minhaPosicao,
    pessoas_a_frente: quantidadeAFrente,
    minutos_estimados: minutosAcumulados,
    previsao_horario: previsaoHorario,
    duracao_media_servico: duracaoProprio,
    prioridades_a_frente: prioridadesAFrente,
    alerta,                         // longe | chegando | proximo | agora
    calculado_em: agora.toISOString(),
  });
});
