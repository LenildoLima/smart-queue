import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/UserAvatar';
import { NotificationPanel } from '@/components/NotificationPanel';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LogOut,
  CalendarCheck,
  PhoneCall,
  Shield,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Edit2,
  Ban,
  CheckCircle,
  Plus,
  UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';
import { NovoAtendimentoModal } from '@/components/NovoAtendimentoModal';
import { CadastroUsuarioModal } from '@/components/CadastroUsuarioModal';

type Perfil = Tables<'perfis'> & { ativo?: boolean };

interface FilaItem {
  id: string;
  agendamento_id: string;
  unidade_id: string;
  posicao: number;
  criado_em: string;
  chamado_em: string | null;
  atendimento_inicio: string | null;
  atendimento_fim: string | null;
  numero_guiche: number | null;
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

interface AgendamentoItem {
  id: string;
  numero_senha: string | null;
  status: string;
  grupo_prioridade: string;
  data_agendamento: string;
  hora_agendamento: string;
  perfil: { nome_completo: string; url_avatar: string | null; telefone: string | null } | null;
  tipo_atendimento: { nome: string } | null;
}

const prioridadeConfig: Record<string, { label: string; className: string }> = {
  normal: { label: 'Normal', className: 'bg-[#111118] text-[#6b6b8a] border-[#2d2d45]' },
  idoso: { label: 'Idoso', className: 'bg-[#7c6aff]/10 text-[#7c6aff] border-[#7c6aff]/20' },
  gestante: { label: 'Gestante', className: 'bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20' },
  deficiente: { label: 'PCD', className: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20' },
  lactante: { label: 'Lactante', className: 'bg-[#ff6b6b]/10 text-[#ff6b6b] border-[#ff6b6b]/20' },
  obeso: { label: 'Obeso', className: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20' },
};

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  agendado: { label: 'Agendado', className: 'bg-[#7c6aff]/10 text-[#7c6aff] border border-[#7c6aff]/30' },
  aguardando: { label: 'Aguardando', className: 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30' },
  concluido: { label: 'Concluído', className: 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30' },
  cancelado: { label: 'Cancelado', className: 'bg-[#ff6b6b]/10 text-[#ff6b6b] border border-[#ff6b6b]/30' },
  nao_compareceu: { label: 'Não Compareceu', className: 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30' }
};

const isDataHoraPassada = (data: string, hora: string) => {
  const agora = new Date()
  const dataHoraAgendamento = new Date(`${data}T${hora}`)
  // Adiciona 30 minutos de tolerância
  dataHoraAgendamento.setMinutes(dataHoraAgendamento.getMinutes() + 30)
  return agora > dataHoraAgendamento
}

const Admin = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [resumo, setResumo] = useState({ agendados: 0, aguardando: 0, concluidos: 0, cancelados: 0 });
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estados dos Agendamentos
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);
  const [filtroAgtData, setFiltroAgtData] = useState('Hoje');
  const [filtroAgtStatus, setFiltroAgtStatus] = useState('Todos');
  const [filtroAgtBusca, setFiltroAgtBusca] = useState('');

  // Gestão de Usuários states
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('Todos');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [editingUser, setEditingUser] = useState<Perfil | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Perfil>>({});
  
  // Novo Atendimento Modal state
  const [isNovoAtendimentoOpen, setIsNovoAtendimentoOpen] = useState(false);
  const [preselectedUser, setPreselectedUser] = useState<any>(null);
  const [isCadastroUsuarioOpen, setIsCadastroUsuarioOpen] = useState(false);

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
      const { data: vinculo, error: vinculoError } = await supabase
        .from('administradores_unidades')
        .select('unidade_id')
        .eq('usuario_id', authUser.id)
        .single();

      if (vinculoError || !vinculo) {
        setErro('Sem unidade');
        setLoading(false);
        return;
      }

      setUnidadeId(vinculo.unidade_id);
      
      // PARTE 2 - Verificar se existe política que permite admin atualizar status dos agendamentos
      const { error: rlsError } = await supabase
        .from('agendamentos')
        .update({ atualizado_em: new Date().toISOString() })
        // @ts-ignore
        .eq('status', 'xxxxxx_impossible' as any);
        
      if (rlsError && (rlsError.code === '42501' || rlsError.message.includes('permission denied') || rlsError.message.includes('RLS'))) {
        console.warn('Aviso RLS: A política que permite o administrador atualizar o status dos agendamentos da própria unidade pode estar ausente ou configurada incorretamente no Supabase. Verifique as políticas da tabela agendamentos!');
      }

      setLoading(false);
    };
    init();
  }, []);

  // Fetch summary + queue when unidadeId is set
  const fetchData = useCallback(async () => {
    if (!unidadeId) return;

    const hoje = process.env.NODE_ENV === 'development' ? new Date().toISOString().split('T')[0] : format(new Date(), 'yyyy-MM-dd');

    const [todosRes, filaRes, usuariosRes, agendamentosRes] = await Promise.all([
      supabase.from('agendamentos').select('status')
        .eq('unidade_id', unidadeId).eq('data_agendamento', hoje),
      supabase
        .from('fila')
        .select('*, agendamento:agendamentos!fila_agendamento_id_fkey(id, numero_senha, status, grupo_prioridade, tipo_atendimento_id, usuario_id, data_agendamento, hora_agendamento, perfil:perfis!agendamentos_usuario_id_fkey(nome_completo), tipo_atendimento:tipos_atendimento!agendamentos_tipo_atendimento_id_fkey(nome))')
        .eq('unidade_id', unidadeId)
        .is('atendimento_fim', null)
        .in('agendamentos.status', ['aguardando', 'em_atendimento'])
        .order('posicao', { ascending: true }),
      supabase.from('perfis').select('*').order('nome_completo', { ascending: true }),
      supabase
        .from('agendamentos')
        .select('id, numero_senha, status, grupo_prioridade, data_agendamento, hora_agendamento, perfil:perfis!agendamentos_usuario_id_fkey(nome_completo, url_avatar, telefone), tipo_atendimento:tipos_atendimento!agendamentos_tipo_atendimento_id_fkey(nome)')
        .eq('unidade_id', unidadeId)
        .order('data_agendamento', { ascending: false })
        .order('hora_agendamento', { ascending: true }),
    ]);
    
    // Calcular os resumos na memoria baseado em todosRes
    const stList = todosRes.data || [];
    setResumo({
      agendados: stList.filter(s => s.status !== 'cancelado').length,
      aguardando: stList.filter(s => s.status === 'aguardando').length,
      concluidos: stList.filter(s => s.status === 'concluido').length,
      cancelados: stList.filter(s => s.status === 'cancelado').length,
    });

    if (filaRes.data) {
      // Garante que o item da fila possua um agendamento válido nos status corretos (caso o in não estrito anule o objeto relacionado)
      const filaValida = (filaRes.data as unknown as FilaItem[]).filter(f => 
        f.agendamento && ['aguardando', 'em_atendimento'].includes(f.agendamento.status)
      );
      setFila(filaValida);
    }
    
    if (usuariosRes.data) {
      setUsuarios(usuariosRes.data as Perfil[]);
    }

    if (agendamentosRes.data) {
      setAgendamentos(agendamentosRes.data as unknown as AgendamentoItem[]);
    }
  }, [unidadeId]);

  useEffect(() => {
    if (!unidadeId) return;

    // Busca inicial
    fetchData();

    // Escuta mudanças nas tabelas
    const canalFila = supabase
      .channel('admin-fila-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fila',
        filter: `unidade_id=eq.${unidadeId}`
      }, () => {
        fetchData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agendamentos',
        filter: `unidade_id=eq.${unidadeId}`
      }, () => {
        fetchData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'perfis'
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalFila);
    };
  }, [unidadeId, fetchData]);

  const handleChamarProximo = async () => {
    if (!unidadeId) return;

    // Finalizar atendimentos anteriores que já foram chamados mas não finalizados
    await supabase
      .from('fila')
      .update({ atendimento_fim: new Date().toISOString() })
      .eq('unidade_id', unidadeId)
      .is('atendimento_fim', null)
      .not('chamado_em', 'is', null);

    // Buscar próximo da fila (ordenado por posição, sem atendimento_fim)
    const { data: proximo, error: filaError } = await supabase
      .from('fila')
      .select('*')
      .eq('unidade_id', unidadeId)
      .is('atendimento_fim', null)
      .order('posicao', { ascending: true })
      .limit(1)
      .single();

    if (filaError || !proximo) {
      toast({ title: 'Fila vazia', description: 'Não há ninguém aguardando.' });
      return;
    }

    // Atualizar agendamento para em atendimento
    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        status: 'em_atendimento',
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', proximo.agendamento_id);

    if (updateError) {
      toast({ title: 'Erro', description: updateError.message, variant: 'destructive' });
      return;
    }

    // Atualizar fila com chamado_em e atendimento_inicio
    const { error: filaUpdateError } = await supabase
      .from('fila')
      .update({
        chamado_em: new Date().toISOString(),
        iniciado_em: new Date().toISOString(),
        atendimento_inicio: new Date().toISOString(),
      })
      .eq('id', proximo.id);

    if (filaUpdateError) {
      toast({ title: 'Erro', description: filaUpdateError.message, variant: 'destructive' });
    } else {
      setAgendamentos(prev => prev.map(a => 
        a.id === proximo.agendamento_id ? { ...a, status: 'em_atendimento' } : a
      ));
      toast({ title: 'Chamado!', description: `Paciente chamado.` });
    }
  };

  const handleMoverParaFila = async (agendamentoId: string) => {
    setActionLoading(`chamar_${agendamentoId}`);

    // Buscar a ultima posicao da fila desta unidade
    const { data: filaData } = await supabase
      .from('fila')
      .select('posicao')
      .eq('unidade_id', unidadeId)
      .is('atendimento_fim', null)
      .order('posicao', { ascending: false })
      .limit(1)
      .maybeSingle()

    const proximaPosicao = (filaData?.posicao ?? 0) + 1;

    // Atualiza status do agendamento
    const { error: agError } = await supabase
      .from('agendamentos')
      .update({
        status: 'aguardando',
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', agendamentoId);

    if (agError) {
      setActionLoading(null);
      toast({ title: 'Erro ao chamar', description: agError.message, variant: 'destructive' });
      return;
    }

    // Insere na fila
    const { error: filaError } = await supabase
      .from('fila')
      .insert({
        agendamento_id: agendamentoId,
        unidade_id: unidadeId!,
        posicao: proximaPosicao,
      });

    setActionLoading(null);
    if (filaError) {
      toast({ title: 'Erro na fila', description: filaError.message, variant: 'destructive' });
      return;
    }
    
    setAgendamentos(prev => prev.map(a => 
      a.id === agendamentoId ? { ...a, status: 'aguardando' } : a
    ));
    
    toast({ title: 'Enviado para fila', description: 'O paciente foi movido para a fila de espera.', className: 'bg-success text-success-foreground' });
  };

  const handleAtualizarStatusAgendamento = async (agendamentoId: string, novoStatus: string) => {
    setActionLoading(`atualizar_${agendamentoId}`);

    if (novoStatus === 'em_atendimento') {
      await supabase
        .from('fila')
        .update({ iniciado_em: new Date().toISOString() })
        .eq('agendamento_id', agendamentoId);
    }

    const { error: agError } = await supabase
      .from('agendamentos')
      .update({
        status: novoStatus as any,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', agendamentoId);

    if (novoStatus === 'concluido') {
      // Busca iniciado_em da fila
      const { data: filaEntry } = await supabase
        .from('fila')
        .select('chamado_em, iniciado_em')
        .eq('agendamento_id', agendamentoId)
        .single();
        
      const agora = new Date();
      const iniciado = filaEntry?.iniciado_em ? new Date(filaEntry.iniciado_em) : agora;
      const chamado = filaEntry?.chamado_em ? new Date(filaEntry.chamado_em) : agora;
      
      const duracaoMin = Math.round((agora.getTime() - iniciado.getTime()) / 60000);
      const esperaMin = Math.round((iniciado.getTime() - chamado.getTime()) / 60000);
      
      await supabase
        .from('fila')
        .update({ atendimento_fim: agora.toISOString(), finalizado_em: agora.toISOString() })
        .eq('agendamento_id', agendamentoId);
        
      await supabase
        .from('historico_atendimentos')
        .update({ 
          tempo_espera_minutos: esperaMin,
          duracao_minutos: duracaoMin
        })
        .eq('agendamento_id', agendamentoId);
    } else if (novoStatus === 'nao_compareceu') {
      await supabase
        .from('fila')
        .update({ atendimento_fim: new Date().toISOString() })
        .eq('agendamento_id', agendamentoId);
    }

    setActionLoading(null);
    if (agError) {
      toast({ title: 'Erro ao atualizar', description: agError.message, variant: 'destructive' });
      return;
    }
    
    setAgendamentos(prev => prev.map(a => 
      a.id === agendamentoId ? { ...a, status: novoStatus } : a
    ));
    
    toast({ title: 'Status atualizado', description: `O agendamento foi marcado como ${statusBadgeConfig[novoStatus]?.label || novoStatus}.`, className: 'bg-success text-success-foreground' });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold text-foreground">Erro de acesso</h2>
          <p className="text-muted-foreground">{erro}</p>
          <p className="text-sm text-muted-foreground">
            Contacte o administrador do sistema para ser associado a uma unidade.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setActionLoading('save_user');
    const { error } = await supabase
      .from('perfis')
      .update(editFormData)
      .eq('id', editingUser.id);
      
    setActionLoading(null);
    
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    
    toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso.' });
    setIsEditDialogOpen(false);
    fetchData();
  };

  const handleToggleUserStatus = async (id: string, isAtivo: boolean) => {
    setActionLoading(`toggle_${id}`);
    const newStatus = !isAtivo;
    const { error } = await supabase
      .from('perfis')
      .update({ ativo: newStatus } as any)
      .eq('id', id);
      
    setActionLoading(null);
    
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }
    
    toast({ title: 'Status atualizado', description: `Usuário ${newStatus ? 'reativado' : 'desativado'} com sucesso.` });
    fetchData();
  };

  const usuariosFilter = usuarios.filter((u) => {
    const isAtivo = u.ativo !== false;
    
    if (filtroNome && !u.nome_completo?.toLowerCase().includes(filtroNome.toLowerCase())) {
      return false;
    }
    if (filtroPerfil !== 'Todos' && u.perfil !== filtroPerfil) {
      return false;
    }
    if (filtroStatus === 'Ativos' && !isAtivo) return false;
    if (filtroStatus === 'Inativos' && isAtivo) return false;
    
    return true;
  });

  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const summaryCards = [
    { label: 'Agendados hoje', value: resumo.agendados, icon: CalendarCheck, color: 'text-[#7c6aff]', bg: 'bg-[#7c6aff]/10' },
    { label: 'Em espera', value: resumo.aguardando, icon: Clock, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
    { label: 'Concluídos', value: resumo.concluidos, icon: CheckCircle2, color: 'text-[#00d4aa]', bg: 'bg-[#00d4aa]/10' },
    { label: 'Cancelados', value: resumo.cancelados, icon: XCircle, color: 'text-[#ff6b6b]', bg: 'bg-[#ff6b6b]/10' },
  ];

  const dateStrHoje = format(new Date(), 'yyyy-MM-dd');
  const date7 = new Date();
  date7.setDate(date7.getDate() + 7);
  const dateStr7 = format(date7, 'yyyy-MM-dd');
  const currMonth = dateStrHoje.substring(0, 7);

  const agendamentosFilter = agendamentos.filter((ag) => {
    // Busca
    if (filtroAgtBusca) {
      const term = filtroAgtBusca.toLowerCase();
      const matchNome = ag.perfil?.nome_completo?.toLowerCase().includes(term);
      const matchSenha = ag.numero_senha?.toLowerCase().includes(term);
      if (!matchNome && !matchSenha) return false;
    }
    
    // Status
    if (filtroAgtStatus !== 'Todos' && ag.status !== filtroAgtStatus) {
      return false;
    }

    // Data
    if (filtroAgtData === 'Hoje' && ag.data_agendamento !== dateStrHoje) return false;
    if (filtroAgtData === 'Próximos 7 dias') {
      if (ag.data_agendamento < dateStrHoje || ag.data_agendamento > dateStr7) return false;
    }
    if (filtroAgtData === 'Este mês' && !ag.data_agendamento.startsWith(currMonth)) return false;

    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] font-[Inter] text-[#e8e8f0]">
      {/* Background Elements */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(124,106,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,106,255,0.03) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'fixed', width: '600px', height: '600px', background: 'rgba(124,106,255,0.08)', borderRadius: '50%',
        filter: 'blur(120px)', top: '-200px', left: '-100px', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'fixed', width: '400px', height: '400px', background: 'rgba(0,212,170,0.06)', borderRadius: '50%',
        filter: 'blur(100px)', bottom: '-100px', right: '-100px', pointerEvents: 'none', zIndex: 0
      }} />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#1e1e2e] bg-[#111118]/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className="bg-[#7c6aff]/10 text-[#7c6aff] border-[#7c6aff]/20 hover:bg-[#7c6aff]/20">
              <Shield size={12} className="mr-1" />
              Painel Admin
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <NotificationPanel />
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair" className="text-[#e8e8f0] hover:bg-[#1e1e2e] hover:text-[#7c6aff]">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-6 space-y-6 animate-fade-in relative z-10">
        {/* Date */}
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8f0] font-[Syne]">Painel Administrativo</h1>
          <p className="text-sm text-[#6b6b8a] capitalize">{hoje}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Card key={card.label} className="bg-[#13131f] border-[#2d2d45]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${card.bg}`}>
                  <card.icon size={22} className={card.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#e8e8f0] font-[Syne]">{card.value}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#6b6b8a]">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agendamentos */}
        <Card className="bg-[#13131f] border-[#2d2d45]">
          <CardHeader className="pb-3 border-b border-[#1e1e2e]">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg flex items-center gap-2 text-[#e8e8f0]">
                  <CalendarCheck size={20} className="text-[#7c6aff]" />
                  Agendamentos
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-[#7c6aff] text-[#7c6aff] hover:bg-[#7c6aff]/10 bg-transparent shadow-sm h-8"
                    onClick={() => setIsCadastroUsuarioOpen(true)}
                  >
                    <UserPlus size={16} className="mr-1.5" />
                    Cadastrar Usuário
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0 shadow-sm h-8"
                    onClick={() => setIsNovoAtendimentoOpen(true)}
                  >
                    <Plus size={16} className="mr-1.5" />
                    Novo Atendimento
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-2.5 top-2.5 text-[#6b6b8a]" />
                  <Input 
                    placeholder="Buscar paciente ou senha..." 
                    className="pl-9 bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]"
                    value={filtroAgtBusca}
                    onChange={(e) => setFiltroAgtBusca(e.target.value)}
                  />
                </div>
                
                <Select value={filtroAgtData} onValueChange={setFiltroAgtData}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus:ring-[#7c6aff]">
                    <SelectValue placeholder="Data" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0]">
                    <SelectItem value="Todos" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Todas as Datas</SelectItem>
                    <SelectItem value="Hoje" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Hoje</SelectItem>
                    <SelectItem value="Próximos 7 dias" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Próximos 7 dias</SelectItem>
                    <SelectItem value="Este mês" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Este mês</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroAgtStatus} onValueChange={setFiltroAgtStatus}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus:ring-[#7c6aff]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0]">
                    <SelectItem value="Todos" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Todos Status</SelectItem>
                    <SelectItem value="agendado" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Agendado</SelectItem>
                    <SelectItem value="aguardando" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Na Fila</SelectItem>
                    <SelectItem value="em_atendimento" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Em Atendimento</SelectItem>
                    <SelectItem value="concluido" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Concluído</SelectItem>
                    <SelectItem value="cancelado" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#111118]">
                  <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                    <TableHead className="w-[120px] pl-6 text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Data</TableHead>
                    <TableHead className="w-[100px] text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Horário</TableHead>
                    <TableHead className="text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Senha / Paciente</TableHead>
                    <TableHead className="text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Serviço</TableHead>
                    <TableHead className="text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Status</TableHead>
                    <TableHead className="text-right pr-6 text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agendamentosFilter.length === 0 ? (
                    <TableRow className="border-[#1e1e2e]">
                      <TableCell colSpan={6} className="h-24 text-center text-[#6b6b8a]">
                        Nenhum agendamento encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agendamentosFilter.map((ag) => {
                      const st = statusBadgeConfig[ag.status] || statusBadgeConfig['agendado'];
                      
                      const parts = ag.data_agendamento.split('-');
                      const formatedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ag.data_agendamento;
                      
                      return (
                        <TableRow key={ag.id} className={`${ag.status === 'cancelado' ? "opacity-60 bg-[#111118]/20" : ""} border-[#1e1e2e] hover:bg-[#1e1e2e] text-[#e8e8f0]`}>
                          <TableCell className="pl-6 text-sm text-[#6b6b8a]">
                            {formatedDate}
                          </TableCell>
                          <TableCell className="font-medium text-[#e8e8f0]">
                            {ag.hora_agendamento.slice(0, 5)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatar src={ag.perfil?.url_avatar} name={ag.perfil?.nome_completo || ''} size={36} />
                              <div className="flex flex-col">
                                <span className="font-semibold text-[#7c6aff]">{ag.numero_senha || '-'}</span>
                                <span className="text-sm truncate max-w-[180px] text-[#e8e8f0]">{ag.perfil?.nome_completo || 'Sem nome'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm text-[#e8e8f0]">
                              <span>{ag.tipo_atendimento?.nome || 'Atendimento'}</span>
                              {ag.grupo_prioridade && ag.grupo_prioridade !== 'normal' && (
                                <span className="text-[10px] text-[#f59e0b] uppercase tracking-[1px] font-bold mt-1">{ag.grupo_prioridade}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={st.className}>
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              {ag.status === 'agendado' && !isDataHoraPassada(ag.data_agendamento, ag.hora_agendamento) && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="h-8 shadow-none bg-[rgba(124,106,255,0.15)] text-[#7c6aff] border border-[#7c6aff] hover:bg-[rgba(124,106,255,0.25)]"
                                  onClick={() => handleMoverParaFila(ag.id)}
                                  disabled={actionLoading === `chamar_${ag.id}`}
                                  title="Chamar para fila"
                                >
                                  {actionLoading === `chamar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Chamar'}
                                </Button>
                              )}
                              
                              {ag.status === 'agendado' && isDataHoraPassada(ag.data_agendamento, ag.hora_agendamento) && (
                                <>
                                  <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-8 shadow-none bg-[#1e1e2e] text-[#6b6b8a] border border-[#2d2d45] cursor-not-allowed hover:bg-[#1e1e2e]"
                                    disabled={true}
                                    title="Data já passou"
                                  >
                                    Chamar
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 shadow-none bg-[rgba(255,107,107,0.15)] text-[#ff6b6b] border border-[#ff6b6b] hover:bg-[rgba(255,107,107,0.25)]"
                                    onClick={() => handleAtualizarStatusAgendamento(ag.id, 'nao_compareceu')}
                                    disabled={actionLoading === `atualizar_${ag.id}`}
                                    title="Marcar como não compareceu"
                                  >
                                    {actionLoading === `atualizar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Não compareceu'}
                                  </Button>
                                </>
                              )}

                              {ag.status === 'aguardando' && (
                                <>
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="h-8 shadow-none bg-[rgba(0,212,170,0.15)] text-[#00d4aa] border border-[#00d4aa] hover:bg-[rgba(0,212,170,0.25)]"
                                    onClick={() => handleAtualizarStatusAgendamento(ag.id, 'em_atendimento')}
                                    disabled={actionLoading === `atualizar_${ag.id}`}
                                  >
                                    {actionLoading === `atualizar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Em atendimento'}
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 shadow-none bg-[rgba(255,107,107,0.15)] text-[#ff6b6b] border border-[#ff6b6b] hover:bg-[rgba(255,107,107,0.25)]"
                                    onClick={() => handleAtualizarStatusAgendamento(ag.id, 'nao_compareceu')}
                                    disabled={actionLoading === `atualizar_${ag.id}`}
                                  >
                                    {actionLoading === `atualizar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Não compareceu'}
                                  </Button>
                                </>
                              )}

                              {ag.status === 'em_atendimento' && (
                                <>
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="h-8 shadow-none bg-[rgba(0,212,170,0.15)] text-[#00d4aa] border border-[#00d4aa] hover:bg-[rgba(0,212,170,0.25)]"
                                    onClick={() => handleAtualizarStatusAgendamento(ag.id, 'concluido')}
                                    disabled={actionLoading === `atualizar_${ag.id}`}
                                  >
                                    {actionLoading === `atualizar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Concluir'}
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 shadow-none bg-[rgba(255,107,107,0.15)] text-[#ff6b6b] border border-[#ff6b6b] hover:bg-[rgba(255,107,107,0.25)]"
                                    onClick={() => handleAtualizarStatusAgendamento(ag.id, 'nao_compareceu')}
                                    disabled={actionLoading === `atualizar_${ag.id}`}
                                  >
                                    {actionLoading === `atualizar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Não compareceu'}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Fila em Tempo Real */}
        <Card className="bg-[#13131f] border-[#2d2d45]">
          <CardHeader className="pb-3 border-b border-[#1e1e2e]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2 text-[#e8e8f0]">
                 <Users size={20} className="text-[#7c6aff]" />
                 Fila em Tempo Real
              </CardTitle>
              <Button onClick={handleChamarProximo} className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0 shadow-none">
                <PhoneCall size={16} className="mr-1" />
                Chamar próximo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fila.length === 0 ? (
              <div className="text-center py-8 text-[#6b6b8a]">
                <Users size={48} className="mx-auto mb-2 opacity-30" />
                <p>Fila vazia</p>
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                {fila.map((item, index) => {
                  const st = statusBadgeConfig[item.agendamento?.status || 'aguardando'] || statusBadgeConfig['aguardando'];
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-[#111118] border border-[#2d2d45] rounded-xl">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[#7c6aff] border-[#7c6aff] bg-transparent">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium text-[#e8e8f0]">
                            {item.agendamento?.perfil?.nome_completo || `Paciente ${item.id.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-[#6b6b8a]">
                            {item.agendamento?.tipo_atendimento?.nome || 'Atendimento'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={st.className}>
                        {st.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gestão de Usuários */}
        <Card className="bg-[#13131f] border-[#2d2d45]">
          <CardHeader className="pb-3 border-b border-[#1e1e2e]">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-[#e8e8f0]">
                  <Users size={20} className="text-[#00d4aa]" />
                  Gestão de Usuários
                </CardTitle>
                <p className="text-sm text-[#6b6b8a] mt-1">Gerencie os perfis de acesso e status no sistema.</p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-2.5 top-2.5 text-[#6b6b8a]" />
                  <Input 
                    placeholder="Buscar por nome..." 
                    className="pl-9 bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]"
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                  />
                </div>
                
                <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus:ring-[#7c6aff]">
                    <SelectValue placeholder="Perfil" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0]">
                    <SelectItem value="Todos" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Todos Perfis</SelectItem>
                    <SelectItem value="usuario" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Usuários</SelectItem>
                    <SelectItem value="administrador" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Administradores</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus:ring-[#7c6aff]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0]">
                    <SelectItem value="Todos" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Todos Status</SelectItem>
                    <SelectItem value="Ativos" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Ativos</SelectItem>
                    <SelectItem value="Inativos" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#111118]">
                  <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                    <TableHead className="w-[250px] pl-6 text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Usuário</TableHead>
                    <TableHead className="text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Contato</TableHead>
                    <TableHead className="text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Prioridade</TableHead>
                    <TableHead className="text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Perfil</TableHead>
                    <TableHead className="text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Status</TableHead>
                    <TableHead className="text-right pr-6 text-[#6b6b8a] text-[11px] uppercase tracking-[1px] font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosFilter.length === 0 ? (
                    <TableRow className="border-[#1e1e2e]">
                      <TableCell colSpan={6} className="h-24 text-center text-[#6b6b8a]">
                        Nenhum usuário encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuariosFilter.map((u) => {
                      const isAtivo = u.ativo !== false;
                      return (
                        <TableRow key={u.id} className={`${!isAtivo ? "opacity-60 bg-[#111118]/20" : ""} border-[#1e1e2e] hover:bg-[#1e1e2e] text-[#e8e8f0]`}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              <UserAvatar src={u.url_avatar} name={u.nome_completo || ''} size={36} />
                              <div className="flex flex-col">
                                <span className="font-medium truncate max-w-[180px]">{u.nome_completo || 'Sem nome'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span className="text-[#6b6b8a]">{u.telefone || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.grupo_prioridade ? (
                              <Badge variant="outline" className={prioridadeConfig[u.grupo_prioridade]?.className || ''}>
                                {prioridadeConfig[u.grupo_prioridade]?.label || u.grupo_prioridade}
                              </Badge>
                            ) : (
                              <span className="text-[#6b6b8a] text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`capitalize border ${u.perfil === 'administrador' ? 'bg-[#7c6aff]/10 text-[#7c6aff] border-[#7c6aff]/20' : 'bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20'}`}>
                              {u.perfil || 'usuario'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isAtivo ? (
                              <Badge variant="outline" className="border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">Ativo</Badge>
                            ) : (
                              <Badge variant="outline" className="border-[#ff6b6b]/30 bg-[#ff6b6b]/10 text-[#ff6b6b]">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 text-[#7c6aff] border-[#7c6aff]/30 bg-transparent hover:bg-[#7c6aff]/10"
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditFormData({
                                    nome_completo: u.nome_completo,
                                    telefone: u.telefone,
                                    grupo_prioridade: u.grupo_prioridade as any,
                                    perfil: u.perfil
                                  });
                                  setIsEditDialogOpen(true);
                                }}
                                title="Editar usuário"
                              >
                                <Edit2 size={14} />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className={`h-8 gap-1 ${isAtivo ? 'text-[#ff6b6b] border-[#ff6b6b]/30 hover:bg-[#ff6b6b]/10 bg-transparent' : 'text-[#00d4aa] border-[#00d4aa]/30 hover:bg-[#00d4aa]/10 bg-transparent'}`}
                                onClick={() => handleToggleUserStatus(u.id, isAtivo)}
                                disabled={actionLoading === `toggle_${u.id}`}
                              >
                                {isAtivo ? (
                                  <><Ban size={14} /> Desativar</>
                                ) : (
                                  <><CheckCircle size={14} /> Reativar</>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Modal Edição de Usuário */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#111118] border-[#2d2d45] text-[#e8e8f0]">
          <DialogHeader>
            <DialogTitle className="font-[Syne] text-lg text-[#e8e8f0]">Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px]">Nome Completo</label>
              <Input 
                value={editFormData.nome_completo || ''} 
                onChange={e => setEditFormData({...editFormData, nome_completo: e.target.value})} 
                className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px]">Telefone</label>
              <Input 
                value={editFormData.telefone || ''} 
                onChange={e => setEditFormData({...editFormData, telefone: e.target.value})} 
                className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px]">Grupo de Prioridade</label>
              <Select 
                value={editFormData.grupo_prioridade || 'normal'} 
                onValueChange={(v) => setEditFormData({...editFormData, grupo_prioridade: v as any})}
              >
                <SelectTrigger className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus:ring-[#7c6aff]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0]">
                  <SelectItem value="normal" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Normal</SelectItem>
                  <SelectItem value="idoso" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Idoso (60+)</SelectItem>
                  <SelectItem value="gestante" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Gestante</SelectItem>
                  <SelectItem value="deficiente" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">PCD</SelectItem>
                  <SelectItem value="lactante" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Lactante</SelectItem>
                  <SelectItem value="obeso" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Obeso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px]">Perfil de Acesso</label>
              <Select 
                value={editFormData.perfil || 'usuario'} 
                onValueChange={(v) => setEditFormData({...editFormData, perfil: v as any})}
              >
                <SelectTrigger className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus:ring-[#7c6aff]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0]">
                  <SelectItem value="usuario" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Usuário</SelectItem>
                  <SelectItem value="administrador" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#2d2d45] text-[#e8e8f0] hover:bg-[#1e1e2e] hover:text-white" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0" onClick={handleSaveUser} disabled={actionLoading === 'save_user'}>
              {actionLoading === 'save_user' ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cadastro de Usuário */}
      <CadastroUsuarioModal 
        isOpen={isCadastroUsuarioOpen} 
        onClose={() => setIsCadastroUsuarioOpen(false)}
        onSuccess={(newUser) => {
          setIsCadastroUsuarioOpen(false);
          fetchData();
          if (newUser) {
            setPreselectedUser(newUser);
            setIsNovoAtendimentoOpen(true);
          }
        }}
      />
      
      {/* Modal de Novo Atendimento */}
      {unidadeId && (
        <NovoAtendimentoModal 
          isOpen={isNovoAtendimentoOpen} 
          onClose={() => {
             setIsNovoAtendimentoOpen(false);
             setPreselectedUser(null);
          }} 
          unidadeId={unidadeId}
          onSuccess={() => {
            fetchData();
          }}
          initialUser={preselectedUser}
        />
      )}
    </div>
  );
};

export const sqlJobNaoCompareceu = `
-- Job automático: marca como nao_compareceu todo dia 00:01
SELECT cron.schedule(
  'smartqueue-nao-compareceu',
  '1 0 * * *',
  $$
    UPDATE agendamentos
    SET status = 'nao_compareceu'
    WHERE data_agendamento < CURRENT_DATE
      AND status IN ('agendado', 'aguardando');
  $$
);
`;

export default Admin;
