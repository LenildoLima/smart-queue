import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AppointmentHistory } from '@/components/AppointmentHistory';
import { CalendarPlus, X, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Perfil = Tables<'perfis'>;
type Agendamento = Tables<'agendamentos'>;
type FilaRow = Tables<'fila'>;

const statusConfig: Record<string, { label: string; color: string }> = {
  agendado: { label: 'Agendado', color: 'border border-[#7c6aff] text-[#7c6aff] bg-transparent' },
  aguardando: { label: 'Aguardando', color: 'border border-[#f59e0b] text-[#f59e0b] bg-transparent' },
  em_atendimento: { label: 'É sua vez!', color: 'border border-[#00d4aa] text-[#00d4aa] bg-transparent animate-pulse shadow-[0_0_10px_rgba(0,212,170,0.5)]' },
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [fila, setFila] = useState<FilaRow | null>(null);
  const [totalFila, setTotalFila] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch profile + active appointment using getUser() to ensure auth is ready
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // ensure auth is ready
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      // select all fields to avoid TS error with Perfil type
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (perfilError) console.error('Erro ao buscar perfil:', perfilError);
      if (perfilData) {
        setPerfil(perfilData);
        if (perfilData.perfil === 'administrador' || perfilData.perfil === 'super_administrador') {
          setIsAdmin(true);
        }
      }

      const agendamentoRes = await supabase
        .from('agendamentos')
        .select('*')
        .eq('usuario_id', authUser.id)
        .in('status', ['agendado', 'aguardando', 'em_atendimento'])
        .order('data_agendamento', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (agendamentoRes.data) {
        setAgendamento(agendamentoRes.data);
        await fetchFila(agendamentoRes.data);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const fetchFila = async (ag: Agendamento) => {
    const [filaRes, totalRes] = await Promise.all([
      supabase
        .from('fila')
        .select('*')
        .eq('agendamento_id', ag.id)
        .is('atendimento_fim', null)
        .maybeSingle(),
      supabase
        .from('fila')
        .select('id', { count: 'exact', head: true })
        .eq('unidade_id', ag.unidade_id)
        .is('atendimento_fim', null),
    ]);

    if (filaRes.data) setFila(filaRes.data);
    if (totalRes.count !== null) setTotalFila(totalRes.count);
  };

  // Realtime subscription on fila
  useEffect(() => {
    if (!agendamento) return;

    const channel = supabase
      .channel('fila-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fila',
          filter: `unidade_id=eq.${agendamento.unidade_id}`,
        },
        () => {
          // Refresh queue data on any change
          fetchFila(agendamento);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agendamento]);

  // Also subscribe to agendamento status changes
  useEffect(() => {
    if (!agendamento) return;

    const channel = supabase
      .channel('agendamento-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agendamentos',
          filter: `id=eq.${agendamento.id}`,
        },
        (payload) => {
          const updated = payload.new as Agendamento;
          if (['concluido', 'cancelado', 'nao_compareceu'].includes(updated.status)) {
            setAgendamento(null);
            setFila(null);
          } else {
            setAgendamento(updated);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agendamento]);

  const handleCancelar = async () => {
    if (!agendamento) return;
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado', cancelado_em: new Date().toISOString(), motivo_cancelamento: 'Cancelado pelo usuário' })
      .eq('id', agendamento.id);

    if (error) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    } else {
      setAgendamento(null);
      setFila(null);
      toast({ title: 'Agendamento cancelado' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  // use the full nome_completo, fallback to a generic label if not available
  const nome = perfil?.nome_completo || 'Usuário';
  const progressValue = fila && totalFila > 0 ? Math.max(0, ((totalFila - fila.posicao + 1) / totalFila) * 100) : 0;
  const status = agendamento ? statusConfig[agendamento.status] || statusConfig.agendado : null;

  return (
    <div className="min-h-screen bg-transparent pb-20 md:pb-0 font-[Inter]">
      <DashboardHeader isAdmin={isAdmin} />

      <main className="container max-w-2xl py-6 space-y-5 animate-fade-in">
        {/* Welcome Card */}
        <Card className="bg-[#13131f] border-[#2d2d45]">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-[#7c6aff] text-xs font-bold mb-1 tracking-wider uppercase">// dashboard</div>
              <h2 className="text-xl font-bold text-[#e8e8f0] font-[Syne]">Olá, {nome}! 👋</h2>
              <p className="text-sm text-[#6b6b8a] capitalize mt-1">{hoje}</p>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="border-[#7c6aff] text-[#7c6aff] hover:bg-[#7c6aff] hover:text-white">
                <Shield size={16} className="mr-1" />
                Painel Admin
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Active Appointment or Empty */}
        {agendamento ? (
          <Card className="bg-[#13131f] border-[#2d2d45]">
            <CardHeader className="pb-3 border-b border-[#1e1e2e]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-[#e8e8f0] font-[Syne]">Agendamento Ativo</CardTitle>
                {status && (
                  <Badge className={status.color}>{status.label}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Ticket number */}
              <div className="flex flex-col items-center gap-1 py-5">
                <span className="text-xs text-[#6b6b8a] uppercase tracking-wider font-medium">Sua senha</span>
                <span className="text-6xl font-extrabold text-[#7c6aff] tracking-widest font-[Syne] drop-shadow-[0_0_15px_rgba(124,106,255,0.4)]">
                  {agendamento.numero_senha || '---'}
                </span>
              </div>

              {/* Queue position */}
              {fila && (
                <div className="rounded-lg bg-[#111118] border border-[#1e1e2e] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6b6b8a] font-medium">Posição na fila</span>
                    <span className="text-3xl font-bold text-[#e8e8f0] font-[Syne]">{fila.posicao}º</span>
                  </div>
                  <Progress value={progressValue} className="h-2 bg-[#1e1e2e] [&>div]:bg-[#00d4aa]" />
                  <p className="text-xs text-[#6b6b8a] text-center">
                    {fila.posicao <= 1 ? <span className="text-[#00d4aa] font-bold drop-shadow-[0_0_8px_rgba(0,212,170,0.5)]">Você é o próximo!</span> : `${fila.posicao - 1} pessoa(s) na sua frente`}
                  </p>
                </div>
              )}

              {/* Date & time */}
              <div className="flex justify-between text-sm text-[#6b6b8a]">
                <span>📅 {format(new Date(agendamento.data_agendamento + 'T00:00:00'), "dd/MM/yyyy")}</span>
                <span>🕐 {agendamento.hora_agendamento.slice(0, 5)}</span>
              </div>

              {/* Cancel button */}
              {agendamento.status === 'agendado' && (
                <Button
                  variant="outline"
                  className="w-full border-[#ff6b6b] text-[#ff6b6b] hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b]"
                  onClick={handleCancelar}
                >
                  <X size={16} className="mr-2" />
                  Cancelar agendamento
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#13131f] border-[#2d2d45] border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <div className="rounded-full bg-[#7c6aff]/10 p-4 shadow-[0_0_20px_rgba(124,106,255,0.2)]">
                <CalendarPlus size={32} className="text-[#7c6aff]" />
              </div>
              <p className="text-[#6b6b8a] font-medium">Você não tem agendamentos ativos</p>
              <Button onClick={() => navigate('/agendar')} className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white border-0 hover:opacity-90 transition-opacity">
                <CalendarPlus size={16} className="mr-2" />
                Agendar agora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <AppointmentHistory />
      </main>

    </div>
  );
};

export default Dashboard;
