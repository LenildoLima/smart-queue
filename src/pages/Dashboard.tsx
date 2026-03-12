import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { BottomNav } from '@/components/BottomNav';
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
  agendado: { label: 'Agendado', color: 'bg-primary text-primary-foreground' },
  aguardando: { label: 'Aguardando', color: 'bg-warning text-warning-foreground' },
  em_atendimento: { label: 'É sua vez!', color: 'bg-destructive text-destructive-foreground' },
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

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      const [perfilRes, agendamentoRes] = await Promise.all([
        supabase.from('perfis').select('*').eq('id', authUser.id).maybeSingle(),
        supabase
          .from('agendamentos')
          .select('*')
          .eq('usuario_id', authUser.id)
          .in('status', ['agendado', 'aguardando', 'em_atendimento'])
          .order('data_agendamento', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (perfilRes.data?.perfil === 'administrador' || perfilRes.data?.perfil === 'super_administrador') {
        setIsAdmin(true);
      }

      if (perfilRes.error) console.error('Erro ao buscar perfil:', perfilRes.error);
      if (perfilRes.data) setPerfil(perfilRes.data);
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
  const nome = perfil?.nome_completo?.split(' ')[0] || 'Usuário';
  const progressValue = fila && totalFila > 0 ? Math.max(0, ((totalFila - fila.posicao + 1) / totalFila) * 100) : 0;
  const status = agendamento ? statusConfig[agendamento.status] || statusConfig.agendado : null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DashboardHeader nomeCompleto={perfil?.nome_completo || ''} avatarUrl={perfil?.url_avatar} />

      <main className="container max-w-2xl py-6 space-y-5 animate-fade-in">
        {/* Welcome Card */}
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Olá, {nome}! 👋</h2>
              <p className="text-sm text-muted-foreground capitalize mt-1">{hoje}</p>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <Shield size={16} className="mr-1" />
                Painel Admin
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Active Appointment or Empty */}
        {agendamento ? (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Agendamento Ativo</CardTitle>
                {status && (
                  <Badge className={status.color}>{status.label}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Ticket number */}
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Sua senha</span>
                <span className="text-5xl font-extrabold text-primary tracking-widest">
                  {agendamento.numero_senha || '---'}
                </span>
              </div>

              {/* Queue position */}
              {fila && (
                <div className="rounded-lg bg-muted p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">Posição na fila</span>
                    <span className="text-3xl font-bold text-foreground">{fila.posicao}º</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {fila.posicao <= 1 ? 'Você é o próximo!' : `${fila.posicao - 1} pessoa(s) na sua frente`}
                  </p>
                </div>
              )}

              {/* Date & time */}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>📅 {format(new Date(agendamento.data_agendamento + 'T00:00:00'), "dd/MM/yyyy")}</span>
                <span>🕐 {agendamento.hora_agendamento.slice(0, 5)}</span>
              </div>

              {/* Cancel button */}
              {agendamento.status === 'agendado' && (
                <Button
                  variant="outline"
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleCancelar}
                >
                  <X size={16} />
                  Cancelar agendamento
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <div className="rounded-full bg-muted p-4">
                <CalendarPlus size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Você não tem agendamentos ativos</p>
              <Button onClick={() => navigate('/agendar')}>
                <CalendarPlus size={16} />
                Agendar agora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <AppointmentHistory />
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
