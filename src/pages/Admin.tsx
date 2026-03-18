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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

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
  normal: { label: 'Normal', className: 'bg-muted text-muted-foreground' },
  idoso: { label: 'Idoso', className: 'bg-amber-100 text-amber-800' },
  gestante: { label: 'Gestante', className: 'bg-pink-100 text-pink-800' },
  deficiente: { label: 'PCD', className: 'bg-purple-100 text-purple-800' },
  lactante: { label: 'Lactante', className: 'bg-rose-100 text-rose-800' },
  obeso: { label: 'Obeso', className: 'bg-orange-100 text-orange-800' },
};

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  agendado: { label: 'Agendado', className: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
  aguardando: { label: 'Aguardando', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800 hover:bg-green-200' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800 hover:bg-red-200' },
  nao_compareceu: { label: 'Não Compareceu', className: 'bg-orange-100 text-orange-800 hover:bg-orange-200' }
};

const isDataPassada = (data: string) => {
  const hoje = new Date().toISOString().split('T')[0]
  return data < hoje
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
        .eq('status', 'xxxxxx_impossible');
        
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
      setFila(filaRes.data as unknown as FilaItem[]);
    }
    
    if (usuariosRes.data) {
      setUsuarios(usuariosRes.data as Perfil[]);
    }

    if (agendamentosRes.data) {
      setAgendamentos(agendamentosRes.data as unknown as AgendamentoItem[]);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfis' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unidadeId, fetchData]);

  const handleChamarProximo = async () => {
    if (!unidadeId) return;

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

    // Buscar a ultima posicao da fila desta unidade hoje
    const { count } = await supabase
      .from('fila')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId); // idealmente filtrado pela data de hj tambem na fila se a regra mandar

    const proximaPosicao = (count || 0) + 1;

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
    const { error: agError } = await supabase
      .from('agendamentos')
      .update({
        status: novoStatus as any,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', agendamentoId);

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
    { label: 'Agendados hoje', value: resumo.agendados, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Em espera', value: resumo.aguardando, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Concluídos', value: resumo.concluidos, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Cancelados', value: resumo.cancelados, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
              <Shield size={12} className="mr-1" />
              Painel Admin
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <NotificationPanel />
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

        {/* Agendamentos */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarCheck size={20} className="text-primary" />
                Agendamentos
              </CardTitle>
              
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar paciente ou senha..." 
                    className="pl-9 bg-background"
                    value={filtroAgtBusca}
                    onChange={(e) => setFiltroAgtBusca(e.target.value)}
                  />
                </div>
                
                <Select value={filtroAgtData} onValueChange={setFiltroAgtData}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-background">
                    <SelectValue placeholder="Data" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todas as Datas</SelectItem>
                    <SelectItem value="Hoje">Hoje</SelectItem>
                    <SelectItem value="Próximos 7 dias">Próximos 7 dias</SelectItem>
                    <SelectItem value="Este mês">Este mês</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroAgtStatus} onValueChange={setFiltroAgtStatus}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos Status</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="aguardando">Na Fila</SelectItem>
                    <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px] pl-6">Data</TableHead>
                    <TableHead className="w-[100px]">Horário</TableHead>
                    <TableHead>Senha / Paciente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agendamentosFilter.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum agendamento encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agendamentosFilter.map((ag) => {
                      const st = statusBadgeConfig[ag.status] || statusBadgeConfig['agendado'];
                      
                      const parts = ag.data_agendamento.split('-');
                      const formatedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ag.data_agendamento;
                      
                      return (
                        <TableRow key={ag.id} className={ag.status === 'cancelado' ? "opacity-60 bg-muted/20" : ""}>
                          <TableCell className="pl-6 text-sm text-muted-foreground">
                            {formatedDate}
                          </TableCell>
                          <TableCell className="font-medium">
                            {ag.hora_agendamento.slice(0, 5)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatar src={ag.perfil?.url_avatar} name={ag.perfil?.nome_completo || ''} size={36} />
                              <div className="flex flex-col">
                                <span className="font-semibold text-primary">{ag.numero_senha || '-'}</span>
                                <span className="text-sm truncate max-w-[180px]">{ag.perfil?.nome_completo || 'Sem nome'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span>{ag.tipo_atendimento?.nome || 'Atendimento'}</span>
                              {ag.grupo_prioridade && ag.grupo_prioridade !== 'normal' && (
                                <span className="text-xs text-warning uppercase font-bold">{ag.grupo_prioridade}</span>
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
                              {ag.status === 'agendado' && !isDataPassada(ag.data_agendamento) && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="h-8 shadow-none bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => handleMoverParaFila(ag.id)}
                                  disabled={actionLoading === `chamar_${ag.id}`}
                                  title="Chamar para fila"
                                >
                                  {actionLoading === `chamar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Chamar'}
                                </Button>
                              )}
                              
                              {ag.status === 'agendado' && isDataPassada(ag.data_agendamento) && (
                                <>
                                  <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-8 shadow-none bg-zinc-200 text-zinc-500 cursor-not-allowed"
                                    disabled={true}
                                    title="Data já passou"
                                  >
                                    Chamar
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 shadow-none"
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
                                    className="h-8 shadow-none bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => handleAtualizarStatusAgendamento(ag.id, 'em_atendimento')}
                                    disabled={actionLoading === `atualizar_${ag.id}`}
                                  >
                                    {actionLoading === `atualizar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Em atendimento'}
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 shadow-none"
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
                                    className="h-8 shadow-none bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleAtualizarStatusAgendamento(ag.id, 'concluido')}
                                    disabled={actionLoading === `atualizar_${ag.id}`}
                                  >
                                    {actionLoading === `atualizar_${ag.id}` ? <LoadingSpinner size={14} /> : 'Concluir'}
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 shadow-none"
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
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                 <Users size={20} className="text-primary" />
                 Fila em Tempo Real
              </CardTitle>
              <Button onClick={handleChamarProximo} className="bg-success hover:bg-success/90 text-success-foreground">
                <PhoneCall size={16} className="mr-1" />
                Chamar próximo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fila.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p>Fila vazia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fila.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center font-bold">
                        {item.posicao}
                      </Badge>
                      <div>
                        <p className="font-medium text-foreground">
                          {item.agendamento?.perfil?.nome_completo || `Paciente ${item.id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.agendamento?.tipo_atendimento?.nome || 'Atendimento'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={item.chamado_em ? 'default' : 'secondary'}>
                      {item.chamado_em ? 'Chamado' : 'Aguardando'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gestão de Usuários */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users size={20} className="text-primary" />
                  Gestão de Usuários
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Gerencie os perfis de acesso e status no sistema.</p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome..." 
                    className="pl-9 bg-background"
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                  />
                </div>
                
                <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-background">
                    <SelectValue placeholder="Perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos Perfis</SelectItem>
                    <SelectItem value="usuario">Usuários</SelectItem>
                    <SelectItem value="administrador">Administradores</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos Status</SelectItem>
                    <SelectItem value="Ativos">Ativos</SelectItem>
                    <SelectItem value="Inativos">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[250px] pl-6">Usuário</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosFilter.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum usuário encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuariosFilter.map((u) => {
                      const isAtivo = u.ativo !== false;
                      return (
                        <TableRow key={u.id} className={!isAtivo ? "opacity-60 bg-muted/20" : ""}>
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
                              <span className="text-muted-foreground">{u.telefone || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.grupo_prioridade ? (
                              <Badge variant="outline" className={prioridadeConfig[u.grupo_prioridade]?.className || ''}>
                                {prioridadeConfig[u.grupo_prioridade]?.label || u.grupo_prioridade}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`capitalize ${u.perfil === 'administrador' ? 'bg-orange-100 text-orange-800 hover:bg-orange-100 hover:text-orange-800' : 'bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800'}`}>
                              {u.perfil || 'usuario'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isAtivo ? (
                              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Ativo</Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
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
                                className={`h-8 gap-1 ${isAtivo ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Completo</label>
              <Input 
                value={editFormData.nome_completo || ''} 
                onChange={e => setEditFormData({...editFormData, nome_completo: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input 
                value={editFormData.telefone || ''} 
                onChange={e => setEditFormData({...editFormData, telefone: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Grupo de Prioridade</label>
              <Select 
                value={editFormData.grupo_prioridade || 'normal'} 
                onValueChange={(v) => setEditFormData({...editFormData, grupo_prioridade: v as any})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="idoso">Idoso (60+)</SelectItem>
                  <SelectItem value="gestante">Gestante</SelectItem>
                  <SelectItem value="deficiente">PCD</SelectItem>
                  <SelectItem value="lactante">Lactante</SelectItem>
                  <SelectItem value="obeso">Obeso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Perfil de Acesso</label>
              <Select 
                value={editFormData.perfil || 'usuario'} 
                onValueChange={(v) => setEditFormData({...editFormData, perfil: v as any})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuário</SelectItem>
                  <SelectItem value="administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveUser} disabled={actionLoading === 'save_user'}>
              {actionLoading === 'save_user' ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
