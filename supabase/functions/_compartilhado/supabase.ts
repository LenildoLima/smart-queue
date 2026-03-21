// =============================================================
//  _compartilhado/supabase.ts
//  Cliente Supabase reutilizável entre as Edge Functions
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function criarClienteSupabase() {
  const url  = Deno.env.get("SUPABASE_URL")!;
  const key  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ── Tipos compartilhados ─────────────────────────────────────

export interface EntradaFila {
  id: string;
  agendamento_id: string;
  unidade_id: string;
  posicao: number;
  chamado_em: string | null;
  iniciado_em: string | null;
  finalizado_em: string | null;
  numero_guiche: number | null;
  criado_em: string;
}

export interface Agendamento {
  id: string;
  unidade_id: string;
  usuario_id: string;
  tipo_atendimento_id: string;
  data_agendada: string;
  hora_agendada: string;
  grupo_prioridade: string;
  pontuacao_prioridade: number;
  status: string;
  numero_senha: string | null;
}

export interface TipoAtendimento {
  id: string;
  unidade_id: string;
  nome: string;
  duracao_media_minutos: number;
}

export interface Perfil {
  id: string;
  nome_completo: string;
}

// ── Resposta padrão ──────────────────────────────────────────

export function respostaJson(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function respostaErro(mensagem: string, status = 400): Response {
  return respostaJson({ erro: mensagem }, status);
}
