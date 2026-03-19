import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardHeader } from '@/components/DashboardHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, FileDown, Calendar, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, max } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type TipoRelatorio = 'diario' | 'mensal';

const COLORS = {
  agendado: '#2563EB',
  aguardando: '#F59E0B',
  concluido: '#22C55E',
  cancelado: '#EF4444',
  nao_compareceu: '#94A3B8',
  em_atendimento: '#0ea5e9' // Added fallback for this status
};

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  aguardando: 'Aguardando',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  nao_compareceu: 'Não Compareceu',
  em_atendimento: 'Em Atendimento'
};

export default function Relatorios() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);

  // Filtros
  const [tipoOpc, setTipoOpc] = useState<TipoRelatorio>('diario');
  const [dataDia, setDataDia] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mesAno, setMesAno] = useState(format(new Date(), 'yyyy-MM'));
  
  // Dados
  const [fetchingData, setFetchingData] = useState(false);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  
  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  useEffect(() => {
    const init = async () => {
      if (!user) return navigate('/login');

      // Check admin status
      const { data: perfilData } = await supabase
        .from('perfis')
        .select('perfil')
        .eq('id', user.id)
        .single();

      if (!perfilData || (perfilData.perfil !== 'administrador' && perfilData.perfil !== 'super_administrador')) {
        return navigate('/dashboard');
      }
      setIsAdmin(true);

      // Get unidade admin
      const { data: vinculo } = await supabase
        .from('administradores_unidades')
        .select('unidade_id')
        .eq('usuario_id', user.id)
        .single();

      if (vinculo) {
        setUnidadeId(vinculo.unidade_id);
      }
      
      setLoading(false);
    };

    init();
  }, [user, navigate]);

  useEffect(() => {
    if (unidadeId) {
      handleGerarRelatorio();
    }
  }, [unidadeId]); // Initial fetch when unidade is known

  const fetchRelatorioData = async (dataInicio: string, dataFim: string) => {
    if (!unidadeId) return;
    setFetchingData(true);
    setPaginaAtual(1); // resettar paginação

    // Query 1 - busca os agendamentos para o resumo
    const { data: agendamentosData } = await supabase
      .from('agendamentos')
      .select('status, data_agendamento')
      .eq('unidade_id', unidadeId)
      .gte('data_agendamento', dataInicio)
      .lte('data_agendamento', dataFim);

    if (agendamentosData) setAgendamentos(agendamentosData);

    // Query 2 - busca o histórico
    const { data: historicoBase } = await supabase
      .from('historico_atendimentos')
      .select('*')
      .eq('unidade_id', unidadeId)
      .gte('data_atendimento', dataInicio)
      .lte('data_atendimento', dataFim)
      .order('data_atendimento', { ascending: false });

    if (!historicoBase || historicoBase.length === 0) {
      setHistorico([]);
      setFetchingData(false);
      return;
    }

    const agendamentoIds = [...new Set(historicoBase.map(h => h.agendamento_id).filter(Boolean))];
    const usuarioIds = [...new Set(historicoBase.map(h => h.usuario_id).filter(Boolean))];

    // Query 3 - busca agendamentos para pegar numero_senha
    const { data: agendamentosRel } = await supabase
      .from('agendamentos')
      .select('id, numero_senha, tipo_atendimento_id, tipos_atendimento(nome)')
      .in('id', agendamentoIds);

    // Query 4 - busca perfis para pegar nome
    const { data: perfisRel } = await supabase
      .from('perfis')
      .select('id, nome_completo')
      .in('id', usuarioIds);

    // Combina os dados
    const historicoCompleto = historicoBase.map(h => {
      const ag = agendamentosRel?.find(a => a.id === h.agendamento_id);
      const pf = perfisRel?.find(p => p.id === h.usuario_id);
      return {
        ...h,
        numero_senha: ag?.numero_senha,
        nome_paciente: pf?.nome_completo,
        tipo_nome: (ag?.tipos_atendimento as any)?.nome
      };
    });

    setHistorico(historicoCompleto);
    setFetchingData(false);
  };

  const handleGerarRelatorio = () => {
    if (tipoOpc === 'diario') {
      fetchRelatorioData(dataDia, dataDia);
    } else {
      const start = mesAno + "-01";
      const dt = parseISO(start);
      // Data fim do mes
      const fimMesObj = endOfMonth(dt);
      const end = format(fimMesObj, 'yyyy-MM-dd');
      fetchRelatorioData(start, end);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Senha', 'Paciente', 'Serviço', 'Espera (min)', 'Duração (min)', 'Status'];
    const rows = historico.map(h => [
      format(new Date(h.data_atendimento + 'T00:00:00'), 'dd/MM/yyyy'),
      h.numero_senha || '-',
      h.nome_paciente || '-',
      h.tipo_nome || '-',
      h.tempo_espera_minutos !== null ? h.tempo_espera_minutos : '-',
      h.duracao_minutos !== null ? h.duracao_minutos : '-',
      STATUS_LABELS[h.status] || h.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + headers.join(";") + "\n" 
        + rows.map(e => e.join(";")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = tipoOpc === 'diario' ? dataDia : mesAno;
    link.setAttribute("download", `relatorio_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ----- CALCULOS DE RESUMO -----
  const resumo = useMemo(() => {
    const total = agendamentos.length;
    let concluidos = 0, cancelados = 0, naoCompareceu = 0;
    agendamentos.forEach(a => {
      if (a.status === 'concluido') concluidos++;
      if (a.status === 'cancelado') cancelados++;
      if (a.status === 'nao_compareceu') naoCompareceu++;
    });
    
    const validos = total - cancelados;
    const taxaComparecimento = validos > 0 ? Math.round((concluidos / validos) * 100) : 0;
    
    // Media de espera a partir do historico
    const historicoValido = historico.filter(h => h.tempo_espera_minutos !== null && h.tempo_espera_minutos !== undefined);
    const somaEspera = historicoValido.reduce((acc, h) => acc + h.tempo_espera_minutos, 0);
    const mediaEspera = historicoValido.length > 0 ? Math.round(somaEspera / historicoValido.length) : 0;

    return { total, concluidos, cancelados, naoCompareceu, taxaComparecimento, mediaEspera };
  }, [agendamentos, historico]);

  // ----- GRAFICO DE PIZZA -----
  const pizzaData = useMemo(() => {
    const hash: any = {};
    agendamentos.forEach(a => {
      if (!hash[a.status]) hash[a.status] = 0;
      hash[a.status]++;
    });
    
    return Object.keys(hash).map(status => ({
      name: STATUS_LABELS[status] || status,
      value: hash[status],
      color: (COLORS as any)[status] || '#000'
    })).filter(d => d.value > 0);
  }, [agendamentos]);

  // ----- GRAFICO DE BARRAS (MENSAL) -----
  const barData = useMemo(() => {
    if (tipoOpc === 'diario') return [];
    
    const dailyCounts: Record<string, number> = {};
    agendamentos.forEach(a => {
      const day = a.data_agendamento.substring(8, 10);
      if (!dailyCounts[day]) dailyCounts[day] = 0;
      dailyCounts[day]++;
    });
    
    return Object.entries(dailyCounts)
      .map(([day, count]) => ({ day, count }))
      .sort((a,b) => Number(a.day) - Number(b.day));
  }, [agendamentos, tipoOpc]);

  // ----- PAGINAÇAO TABELA DETALHADA -----
  const paginatedData = useMemo(() => {
    const start = (paginaAtual - 1) * itensPorPagina;
    return historico.slice(start, start + itensPorPagina);
  }, [historico, paginaAtual]);

  const totalPaginas = Math.ceil(historico.length / itensPorPagina) || 1;

  if (loading) {
    return (
      <AppLayout>
        <DashboardHeader isAdmin={isAdmin} />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <DashboardHeader isAdmin={isAdmin} />
      <main className="container max-w-6xl py-6 space-y-6 animate-fade-in bg-slate-50 min-h-[calc(100vh-4rem)] rounded-tl-3xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Relatórios Gerenciais</h1>
            <p className="text-sm text-slate-500 mt-1">Acompanhe as métricas de atendimentos da sua unidade.</p>
          </div>
        </div>
        
        {/* 1. FILTROS NO TOPO */}
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="p-4 sm:p-6 flex flex-col md:flex-row items-end gap-4">
            <div className="w-full md:w-auto flex-1 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tipo de Relatório</label>
              <Select value={tipoOpc} onValueChange={(v: TipoRelatorio) => setTipoOpc(v)}>
                <SelectTrigger className="w-full sm:w-[200px] h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {tipoOpc === 'diario' ? (
              <div className="w-full md:w-auto flex-1 space-y-2">
                <label className="text-sm font-semibold text-slate-700">Data do Relatório</label>
                <Input 
                  type="date" 
                  value={dataDia} 
                  onChange={(e) => setDataDia(e.target.value)} 
                  className="h-11 bg-white"
                />
              </div>
            ) : (
              <div className="w-full md:w-auto flex-1 space-y-2">
                <label className="text-sm font-semibold text-slate-700">Mês e Ano</label>
                <Input 
                  type="month" 
                  value={mesAno} 
                  onChange={(e) => setMesAno(e.target.value)} 
                  className="h-11 bg-white"
                />
              </div>
            )}
            
            <Button 
              onClick={handleGerarRelatorio} 
              disabled={fetchingData}
              className="w-full md:w-auto h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-8 shadow-sm"
            >
              {fetchingData ? <LoadingSpinner size={18} /> : 'Gerar Relatório'}
            </Button>
          </CardContent>
        </Card>

        {fetchingData ? (
          <div className="py-20 flex justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-6">
            
            {/* 2. CARDS DE RESUMO */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="rounded-xl shadow-sm overflow-hidden border-slate-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
                  <span className="text-3xl font-bold text-slate-800">{resumo.total}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Agendamentos</span>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm overflow-hidden border-slate-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
                  <span className="text-3xl font-bold text-green-500">{resumo.concluidos}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Concluídos</span>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm overflow-hidden border-slate-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
                  <span className="text-3xl font-bold text-red-500">{resumo.cancelados}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cancelados</span>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm overflow-hidden border-slate-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
                  <span className="text-3xl font-bold text-amber-500">{resumo.naoCompareceu}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Não Compareceu</span>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm overflow-hidden border-blue-100 bg-blue-50/50">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
                  <span className="text-3xl font-black text-blue-600">{resumo.taxaComparecimento}%</span>
                  <span className="text-xs font-bold text-blue-800/70 uppercase tracking-wider">Tx. Comparecimento</span>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm overflow-hidden border-slate-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
                  <span className="text-2xl font-bold text-slate-700">{resumo.mediaEspera} <span className="text-sm font-normal">min</span></span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Espera Média</span>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 3. GRÁFICO DE PIZZA */}
              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                    <PieChartIcon size={18} className="text-blue-600" />
                    Atendimentos por Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  {pizzaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pizzaData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pizzaData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">Sem dados para o período</div>
                  )}
                </CardContent>
              </Card>

              {/* 4. GRÁFICO DE BARRAS (só mensal) */}
              <Card className={`rounded-xl shadow-sm border-slate-200 ${tipoOpc === 'diario' ? 'opacity-50 pointer-events-none' : ''}`}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                    <Activity size={18} className="text-blue-600" />
                    Agendamentos por Dia
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  {tipoOpc === 'mensal' && barData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} name="Agendamentos" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      {tipoOpc === 'diario' ? 'Disponível apenas no Relatório Mensal' : 'Sem dados para o período'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 5. TABELA DETALHADA E 6. EXPORTAR CSV */}
            <Card className="rounded-xl shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="border-b bg-white flex flex-row items-center justify-between py-4">
                <CardTitle className="text-base text-slate-800">Histórico Detalhado</CardTitle>
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={historico.length === 0} className="text-slate-600 border-slate-300">
                  <FileDown size={14} className="mr-2" />
                  Exportar CSV
                </Button>
              </CardHeader>
              <div className="overflow-x-auto bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-600 w-[110px]">Data</TableHead>
                      <TableHead className="font-semibold text-slate-600 w-[90px]">Senha</TableHead>
                      <TableHead className="font-semibold text-slate-600">Paciente</TableHead>
                      <TableHead className="font-semibold text-slate-600">Serviço</TableHead>
                      <TableHead className="font-semibold text-slate-600 w-[100px] text-center">Espera</TableHead>
                      <TableHead className="font-semibold text-slate-600 w-[100px] text-center">Duração</TableHead>
                      <TableHead className="font-semibold text-slate-600 w-[130px] text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                          Nenhum registro encontrado para este período.
                        </TableCell>
                      </TableRow>
                    ) : (paginatedData.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50 border-slate-100">
                        <TableCell className="text-slate-600">{format(new Date(item.data_atendimento + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-bold text-slate-700">{item.numero_senha || '-'}</TableCell>
                        <TableCell className="font-medium text-slate-800">{item.nome_paciente || '-'}</TableCell>
                        <TableCell className="text-slate-600">{item.tipo_nome || '-'}</TableCell>
                        <TableCell className="text-center text-slate-600">
                          {item.tempo_espera_minutos !== null && item.tempo_espera_minutos !== undefined ? `${item.tempo_espera_minutos} min` : '-'}
                        </TableCell>
                        <TableCell className="text-center text-slate-600">
                          {item.duracao_minutos !== null && item.duracao_minutos !== undefined ? `${item.duracao_minutos} min` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant="outline" 
                            style={{ 
                              color: (COLORS as any)[item.status] || '#000', 
                              backgroundColor: ((COLORS as any)[item.status] || '#000') + '15',
                              borderColor: ((COLORS as any)[item.status] || '#000') + '30',
                            }}
                          >
                            {STATUS_LABELS[item.status] || item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )))}
                  </TableBody>
                </Table>
              </div>
              
              {/* PAGINAÇÃO */}
              {historico.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50">
                  <span className="text-sm text-slate-500">
                    Mostrando {((paginaAtual - 1) * itensPorPagina) + 1} a {Math.min(paginaAtual * itensPorPagina, historico.length)} de {historico.length} registros
                  </span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      disabled={paginaAtual === 1}
                      className="h-8 w-8 p-0 border-slate-300"
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <span className="text-sm font-medium text-slate-700 mx-2">
                      Página {paginaAtual} de {totalPaginas}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="h-8 w-8 p-0 border-slate-300"
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

          </div>
        )}
      </main>
    </AppLayout>
  );
}
