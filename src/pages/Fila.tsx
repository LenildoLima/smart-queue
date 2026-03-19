import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Ticket, AlertCircle, History, CalendarDays, Activity, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// Tipos
interface AgendamentoAtivo {
  id: string;
  numero_senha: string;
  status: string;
  data_agendamento: string;
  hora_agendamento: string;
  unidade_id: string;
  servico: string;
}

interface FilaState {
  id: string;
  posicao: number;
  pessoasRestantes: number;
  totalFila: number;
}

interface HistoricoItem {
  id: string;
  data_atendimento: string;
  duracao_minutos: number | null;
  tempo_espera_minutos: number | null;
  status: string;
  servico: string;
}

export default function Fila() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [agendamento, setAgendamento] = useState<AgendamentoAtivo | null>(null);
  const [filaInfo, setFilaInfo] = useState<FilaState | null>(null);
  const [previsao, setPrevisao] = useState<number | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchFilaData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Verificar agendamentos na fila
      const { data: ags } = await supabase
        .from('agendamentos')
        .select('id, numero_senha, status, data_agendamento, hora_agendamento, unidade_id, tipos_atendimento(nome)')
        .eq('usuario_id', user.id)
        .in('status', ['aguardando', 'em_atendimento'])
        .limit(1)
        .maybeSingle();

      if (ags) {
        setAgendamento({
          id: ags.id,
          numero_senha: ags.numero_senha || '-',
          status: ags.status,
          data_agendamento: ags.data_agendamento,
          hora_agendamento: ags.hora_agendamento,
          unidade_id: ags.unidade_id || '',
          servico: (ags.tipos_atendimento as any)?.nome || 'Serviço'
        });

        // 2. Tentar buscar info da fila
        const { data: filaEntry } = await supabase
          .from('fila')
          .select('id, posicao, unidade_id')
          .eq('agendamento_id', ags.id)
          .is('finalizado_em', null)
          .maybeSingle();

        if (filaEntry) {
          // Busca todos não finalizados da unidade para achar contagem
          const { data: todosFila } = await supabase
            .from('fila')
            .select('id, posicao, agendamento_id')
            .eq('unidade_id', filaEntry.unidade_id)
            .is('finalizado_em', null);

          if (todosFila) {
            // Conta os que ainda não foram atendidos e têm posicao válida
            // "Faltam" são aqueles que estão aguardando e na frente (posicao menor)

            // Vamos buscar os status de todos os agendamentos da fila
            const idsFiltro = todosFila.map(t => t.agendamento_id).filter(Boolean);
            const { data: agStatus } = await supabase
              .from('agendamentos')
              .select('id, status')
              .in('id', idsFiltro);

            let restantes = 0;
            const statusMap: Record<string, string> = {};
            if (agStatus) {
              agStatus.forEach(a => { statusMap[a.id] = a.status; });
            }

            todosFila.forEach(t => {
              if (t.posicao < filaEntry.posicao && statusMap[t.agendamento_id] === 'aguardando') {
                restantes++;
              }
            });

            // Total na fila pode ser todo mundo aguardando ou em atendimento
            const total = todosFila.length;

            setFilaInfo({
              id: filaEntry.id,
              posicao: filaEntry.posicao,
              pessoasRestantes: restantes,
              totalFila: total > 0 ? total : 1
            });
          }
        }

        // 3. Previsão de Espera Edge Function
        try {
          const { data: prevData, error: prevError } = await supabase.functions.invoke('previsao-espera', {
            body: { agendamento_id: ags.id }
          });
          if (prevData && prevData.previsaoMinutos !== undefined) {
            setPrevisao(prevData.previsaoMinutos);
          } else {
            console.log("Sem retorno de previsão", prevError);
          }
        } catch (e) {
          console.error("Erro na edge function previsão", e);
        }

      } else {
        setAgendamento(null);
        setFilaInfo(null);
        setPrevisao(null);
      }

      // 4. Buscar histórico
      const { data: hist } = await supabase
        .from('historico_atendimentos')
        .select('*')
        .eq('usuario_id', user.id)
        .order('data_atendimento', { ascending: false })
        .limit(3);

      if (hist && hist.length > 0) {
        // Necessitamos o nome do serviço
        const tiposIds = [...new Set(hist.map(h => h.tipo_atendimento_id).filter(Boolean))];
        const { data: tipos } = await supabase
          .from('tipos_atendimento')
          .select('id, nome')
          .in('id', tiposIds);

        const tiposMap: Record<string, string> = {};
        tipos?.forEach(t => { tiposMap[t.id] = t.nome; });

        setHistorico(hist.map(h => ({
          id: h.id,
          data_atendimento: h.data_atendimento,
          duracao_minutos: h.duracao_minutos,
          tempo_espera_minutos: h.tempo_espera_minutos,
          status: h.status,
          servico: h.tipo_atendimento_id ? tiposMap[h.tipo_atendimento_id] : 'Atendimento'
        })));
      } else {
        setHistorico([]);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFilaData();
  }, [fetchFilaData]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('user-fila-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila' }, () => {
        fetchFilaData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `usuario_id=eq.${user.id}` }, () => {
        fetchFilaData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFilaData]);

  const progressBarValue = filaInfo && filaInfo.totalFila > 0 
    ? Math.max(0, 100 - (filaInfo.pessoasRestantes / filaInfo.totalFila) * 100) 
    : 0;

  return (
    <AppLayout>
      <div className="container max-w-4xl py-8 min-h-[calc(100vh-4rem)] space-y-6 animate-fade-in bg-slate-50/50">
        
        {/* Cabecalho Date-Time */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Minha Posição na Fila</h1>
            <p className="text-sm font-medium text-slate-500 mt-1 capitalize flex items-center gap-2">
              <CalendarDays size={16} />
              {format(currentTime, "EEEE, d 'de' MMMM", { locale: ptBR })} 
              <span className="mx-2">•</span> 
              <Clock size={16} />
              {format(currentTime, "HH:mm:ss")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><LoadingSpinner size={32} /></div>
        ) : (
          <div className="space-y-6">
            
            {/* CARD PRINCIPAL (ATOR) */}
            {agendamento ? (
              <Card className="rounded-2xl shadow-xl shadow-blue-900/5 border-blue-100 overflow-hidden bg-white">
                {/* Highlight banner para 'em_atendimento' */}
                {agendamento.status === 'em_atendimento' && (
                  <div className="bg-amber-500 text-white p-4 font-bold flex items-center justify-center gap-2 animate-pulse rounded-t-2xl">
                    <AlertCircle size={22} />
                    🔔 É a sua vez! Dirija-se ao atendimento.
                  </div>
                )}
                
                <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-8">
                  
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-2">Sua Senha</span>
                    <div className="bg-slate-50 rounded-2xl px-8 py-4 border-2 border-slate-100 flex items-center gap-4">
                      <Ticket size={32} className="text-blue-600" />
                      <span className="text-5xl sm:text-7xl font-black text-slate-800 tracking-tighter">
                        {agendamento.numero_senha}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
                    <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 flex flex-col items-center">
                      <span className="text-xs font-bold text-blue-600/70 uppercase mb-1">Status</span>
                      <div className={`mt-2 font-bold px-4 py-1.5 rounded-full text-sm inline-flex items-center gap-2
                        ${agendamento.status === 'aguardando' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}
                      `}>
                        {agendamento.status === 'aguardando' ? '🟡 Você está na fila' : '🟠 É a sua vez!'}
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase mb-1">Detalhes</span>
                      <span className="font-semibold text-slate-800">{agendamento.servico}</span>
                      <span className="text-sm text-slate-500 mt-0.5">{agendamento.hora_agendamento.substring(0,5)}</span>
                    </div>
                  </div>

                  {/* Informações da Fila */}
                  {filaInfo && agendamento.status === 'aguardando' && (
                    <div className="w-full max-w-2xl space-y-4">
                      
                      <div className="flex justify-between items-end">
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-500">Sua Posição na Fila</p>
                          <p className="text-3xl font-black text-blue-600">
                            {filaInfo.pessoasRestantes + 1}º
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-500">Estimativa</p>
                          <p className="font-bold text-slate-700">
                            {previsao !== null ? `~${previsao} min` : 'Calculando...'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Progress value={progressBarValue} className="h-3" />
                        <p className="text-xs text-center text-slate-400 font-medium">
                          Progresso de Atendimento
                        </p>
                      </div>
                      
                    </div>
                  )}
                  
                </CardContent>
              </Card>
            ) : (
              /* CARD VAZIO */
              <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden bg-white">
                <CardContent className="p-12 flex flex-col items-center text-center space-y-4">
                  <div className="bg-slate-50 p-6 rounded-full">
                    <Clock size={48} className="text-slate-300" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">Você não está na fila no momento</h2>
                  <p className="text-slate-500 max-w-sm">
                    Faça um agendamento para entrar na fila e iniciar seu atendimento no momento agendado.
                  </p>
                  <Button 
                    onClick={() => navigate('/agendar')} 
                    className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 shadow-md"
                  >
                    Agendar agora
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* HISTÓRICO */}
            <div className="pt-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <History className="text-slate-400" size={20} />
                Histórico de Atendimentos
              </h3>
              
              {historico.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {historico.map(h => (
                    <Card key={h.id} className="rounded-xl shadow-sm border-slate-200 bg-white hover:border-blue-100 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-semibold text-slate-700">
                            {format(new Date(h.data_atendimento + 'T00:00:00'), 'dd/MM/yyyy')}
                          </CardTitle>
                          {h.status === 'concluido' ? (
                            <CheckCircle2 size={16} className="text-green-500" />
                          ) : (
                            <Activity size={16} className="text-slate-400" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="font-bold text-slate-800">{h.servico}</p>
                        <div className="flex flex-col gap-1 mt-3">
                          <span className="text-xs text-slate-500">
                            Espera: <span className="font-semibold text-slate-700">{h.tempo_espera_minutos !== null ? `${h.tempo_espera_minutos} min` : '-'}</span>
                          </span>
                          <span className="text-xs text-slate-500">
                            Status: <span className="font-semibold capitalize text-slate-700">{h.status.replace('_', ' ')}</span>
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="rounded-xl border-dashed border-2 border-slate-200 bg-transparent">
                  <CardContent className="p-8 text-center text-slate-500">
                    Nenhum atendimento finalizado encontrado no seu histórico recente.
                  </CardContent>
                </Card>
              )}
            </div>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
