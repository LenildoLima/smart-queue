import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SmartQueueLogo } from '@/components/SmartQueueLogo';
import { UserAvatar } from '@/components/UserAvatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut,
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  PhoneCall,
  UserX,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Perfil = Tables<'perfis'>;

interface FilaItem {
  id: string;
  posicao: number;
  chamado_em: string | null;
  atendimento_inicio: string | null;
  atendimento_fim: string | null;
  numero_guiche: number | null;
  criado_em: string;
  unidade_id: string;
  agendamento_id: string;
  agendamento: {
    id: string;
    numero_senha: string | null;
    status: string;
    grupo_prioridade: string;
    tipo_atendimento_id: string;
    usuario_id: string;
    data_agendamento: string;
    hora_agendamento: string;
    perfil: { nome_completo: string } | null;
    tipo_atendimento: { nome: string } | null;
  };
}

const prioridadeConfig: Record<string, { label: string; className: string }> = {
  normal: { label: 'Normal', className: 'bg-muted text-muted-foreground' },
  idoso: { label: 'Idoso', className: 'bg-amber-100 text-amber-800' },
  gestante: { label: 'Gestante', className: 'bg-pink-100 text-pink-800' },
  deficiente: { label: 'PCD', className: 'bg-purple-100 text-purple-800' },
  lactante: { label: 'Lactante', className: 'bg-rose-100 text-rose-800' },
  obeso: { label: 'Obeso', className: 'bg-orange-100 text-orange-800' },
};

const Admin = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [resumo, setResumo] = useState({ agendados: 0, aguardando: 0, concluidos: 0, cancelados: 0 });
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check admin access and load initial data
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { navigate('/login'); return; }

      // Check if admin
      const { data: perfilData } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!perfilData || perfilData.perfil === 'usuario') {
        navigate('/dashboard');
        return;
      }
      setPerfil(perfilData);

      // Get admin's unit
      const { data: adminUnidade } = await supabase
        .from('administradores_unidades')
        .select('unidade_id')
        .eq('usuario_id', authUser.id)
        .limit(1)
        .maybeSingle();

      if (!adminUnidade) {
        toast({ title: 'Sem unidade', description: 'Você não está associado a nenhuma unidade.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      setUnidadeId(adminUnidade.unidade_id);
      setLoading(false);
    };
    init();
  }, []);

  // Fetch summary + queue when unidadeId is set
  const fetchData = useCallback(async () => {
    if (!unidadeId) return;

    const hoje = format(new Date(), 'yyyy-MM-dd');

    const [agendadosRes, aguardandoRes, concluidosRes, canceladosRes, filaRes] = await Promise.all([
      supabase.from('agendamentos').select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId).eq('data_agendamento', hoje).eq('status', 'agendado'),
      supabase.from('agendamentos').select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId).eq('data_agendamento', hoje).eq('status', 'aguardando'),
      supabase.from('agendamentos').select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId).eq('data_agendamento', hoje).eq('status', 'concluido'),
      supabase.from('agendamentos').select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId).eq('data_agendamento', hoje).eq('status', 'cancelado'),
      supabase
        .from('fila')
        .select('*, agendamento:agendamentos!fila_agendamento_id_fkey(id, numero_senha, status, grupo_prioridade, tipo_atendimento_id, usuario_id, data_agendamento, hora_agendamento, perfil:perfis!agendamentos_usuario_id_fkey(nome_completo), tipo_atendimento:tipos_atendimento!agendamentos_tipo_atendimento_id_fkey(nome))')
        .eq('unidade_id', unidadeId)
        .is('atendimento_fim', null)
        .order('posicao', { ascending: true }),
    ]);

    setResumo({
      agendados: agendadosRes.count ?? 0,
      aguardando: aguardandoRes.count ?? 0,
      concluidos: concluidosRes.count ?? 0,
      cancelados: canceladosRes.count ?? 0,
    });

    if (filaRes.data) {
      setFila(filaRes.data as unknown as FilaItem[]);
    }
  }, [unidadeId]);

  useEffect(() => {
    if (unidadeId) fetchData();
  }, [unidadeId, fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!unidadeId) return;

    const channel = supabase
      .channel('admin-fila-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila', filter: `unidade_id=eq.${unidadeId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `unidade_id=eq.${unidadeId}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unidadeId, fetchData]);

  const handleChamarProximo = async () => {
    const proximo = fila.find(f => f.agendamento?.status === 'aguardando');
    if (!proximo) {
      toast({ title: 'Fila vazia', description: 'Não há ninguém aguardando.' });
      return;
    }
    setActionLoading(proximo.id);
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'em_atendimento' })
      .eq('id', proximo.agendamento_id);

    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      await supabase.from('fila').update({ chamado_em: new Date().toISOString(), atendimento_inicio: new Date().toISOString() }).eq('id', proximo.id);
      toast({ title: 'Chamado!', description: `Senha ${proximo.agendamento?.numero_senha} chamada.` });
    }
    setActionLoading(null);
  };

  const handleConcluir = async (item: FilaItem) => {
    setActionLoading(item.id);
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'concluido' })
      .eq('id', item.agendamento_id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: 'Concluído', description: `Atendimento da senha ${item.agendamento?.numero_senha} finalizado.` });
    setActionLoading(null);
  };

  const handleNaoCompareceu = async (item: FilaItem) => {
    setActionLoading(item.id);
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'nao_compareceu' })
      .eq('id', item.agendamento_id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: 'Não compareceu', description: `Senha ${item.agendamento?.numero_senha} marcada como não compareceu.` });
    setActionLoading(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getTempoEspera = (criadoEm: string) => {
    const diff = Math.floor((Date.now() - new Date(criadoEm).getTime()) / 60000);
    if (diff < 1) return '<1 min';
    if (diff < 60) return `${diff} min`;
    return `${Math.floor(diff / 60)}h ${diff % 60}min`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const summaryCards = [
    { label: 'Agendados hoje', value: resumo.agendados, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Em espera', value: resumo.aguardando, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Concluídos', value: resumo.concluidos, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Cancelados', value: resumo.cancelados, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <SmartQueueLogo size="sm" />
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
              <Shield size={12} className="mr-1" />
              Painel Admin
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm font-medium text-foreground">
              {perfil?.nome_completo}
            </span>
            <UserAvatar src={perfil?.url_avatar} name={perfil?.nome_completo || ''} size={36} />
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-6 space-y-6 animate-fade-in">
        {/* Date */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground capitalize">{hoje}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${card.bg}`}>
                  <card.icon size={22} className={card.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Queue */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">Fila em Tempo Real</CardTitle>
              <Button onClick={handleChamarProximo} className="bg-success hover:bg-success/90 text-success-foreground">
                <PhoneCall size={16} className="mr-1" />
                Chamar próximo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fila.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Clock size={40} className="mx-auto mb-2 opacity-50" />
                <p className="font-medium">Fila vazia</p>
                <p className="text-sm">Nenhum paciente na fila no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fila.map((item) => {
                  const ag = item.agendamento;
                  const prio = prioridadeConfig[ag?.grupo_prioridade || 'normal'] || prioridadeConfig.normal;
                  const isAtendimento = ag?.status === 'em_atendimento';

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-4 transition-colors ${
                        isAtendimento
                          ? 'border-destructive/40 bg-destructive/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        {/* Left: info */}
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="text-2xl font-extrabold text-primary tracking-wider min-w-[70px]">
                            {ag?.numero_senha || '---'}
                          </span>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {ag?.perfil?.nome_completo || 'Sem nome'}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {ag?.tipo_atendimento?.nome || 'Atendimento'}
                              </span>
                              <Badge className={prio.className + ' text-xs'}>{prio.label}</Badge>
                              {isAtendimento && (
                                <Badge className="bg-destructive text-destructive-foreground text-xs">Em atendimento</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: time + actions */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm text-muted-foreground font-mono">
                            ⏱ {getTempoEspera(item.criado_em)}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-success text-success hover:bg-success hover:text-success-foreground"
                              disabled={actionLoading === item.id}
                              onClick={() => handleConcluir(item)}
                            >
                              <CheckCircle2 size={14} className="mr-1" />
                              Concluir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              disabled={actionLoading === item.id}
                              onClick={() => handleNaoCompareceu(item)}
                            >
                              <UserX size={14} className="mr-1" />
                              Não veio
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
