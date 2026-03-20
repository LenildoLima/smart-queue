import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Calendar } from '@/components/ui/calendar';
import {
  MapPin,
  Clock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react';
import { format, isBefore, startOfDay, addMinutes, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Unidade = Tables<'unidades'>;
type TipoAtendimento = Tables<'tipos_atendimento'>;
type HorarioFuncionamento = Tables<'horarios_funcionamento'>;
type Perfil = Tables<'perfis'>;

// Auxiliares
const ETAPAS = [
  { id: 1, titulo: 'Unidade', icon: MapPin },
  { id: 2, titulo: 'Atendimento', icon: Info },
  { id: 3, titulo: 'Data e Hora', icon: CalendarDays },
  { id: 4, titulo: 'Confirmação', icon: CheckCircle2 },
];

export default function Agendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [etapa, setEtapa] = useState(1);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  // Estados dos Dados
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [tiposAtendimento, setTiposAtendimento] = useState<TipoAtendimento[]>([]);
  const [horariosFuncionamento, setHorariosFuncionamento] = useState<HorarioFuncionamento[]>([]);
  const [horariosOcupados, setHorariosOcupados] = useState<string[]>([]);
  const [horariosDisponiveisDia, setHorariosDisponiveisDia] = useState<string[]>([]);

  // Estados de Seleção
  const [unidadeSel, setUnidadeSel] = useState<Unidade | null>(null);
  const [tipoSel, setTipoSel] = useState<TipoAtendimento | null>(null);
  const [dataSel, setDataSel] = useState<Date | undefined>(undefined);
  const [horaSel, setHoraSel] = useState<string | null>(null);

  // Estado de Sucesso
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      
      const { data: perfilData } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (perfilData) setPerfil(perfilData);

      // Buscar unidades ativas
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('*')
        .eq('ativa', true)
        .order('nome');

      if (unidadesData) setUnidades(unidadesData);
      setLoading(false);
    };

    init();
  }, [user]);

  // Ao selecionar uma unidade, carrega os tipos de atendimento dela
  useEffect(() => {
    if (!unidadeSel) return;
    
    const fetchTipos = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .eq('unidade_id', unidadeSel.id)
        .eq('ativo', true)
        .order('nome');
        
      if (data) setTiposAtendimento(data);
      
      const { data: funcData } = await supabase
        .from('horarios_funcionamento')
        .select('*')
        .eq('unidade_id', unidadeSel.id);
        
      if (funcData) setHorariosFuncionamento(funcData);
      setLoading(false);
    };
    fetchTipos();
  }, [unidadeSel]);

  // Ao selecionar uma data, busca os agendamentos ocupados no dia
  useEffect(() => {
    if (!unidadeSel || !dataSel || !tipoSel) return;

    const fetchAgendamentosDia = async () => {
      setLoading(true);
      const dataStr = format(dataSel, 'yyyy-MM-dd');
      
      const { data: ocupados } = await supabase
        .from('agendamentos')
        .select('hora_agendamento')
        .eq('unidade_id', unidadeSel.id)
        .eq('data_agendamento', dataStr)
        .not('status', 'in', '("cancelado","nao_compareceu")');

      // Extrair 'HH:mm' omitindo os segundos do DB
      const ocupadosHora = ocupados?.map(a => a.hora_agendamento.substring(0, 5)) || [];
      setHorariosOcupados(ocupadosHora);

      // Calcular slots livres do dia baseados no funcionamento
      // Obter dia_semana (0=Domingo, 1=Segunda... pro date-fns)
      // Supabase pode usar 1=Segunda, precisamos bater corretamente (vamos supor 0-6 dom-sab)
      const diaDaSemana = dataSel.getDay(); 
      const funcionamentoDia = horariosFuncionamento.find(h => h.dia_semana === diaDaSemana && h.aberto);

      const isToday = format(dataSel, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      const now = new Date();

      if (!funcionamentoDia) {
        setHorariosDisponiveisDia([]);
      } else {
        const slots: string[] = [];
        let atual = parse(funcionamentoDia.abre_as, 'HH:mm:ss', new Date());
        const limite = parse(funcionamentoDia.fecha_as, 'HH:mm:ss', new Date());
        
        while (isBefore(atual, limite) || atual.getTime() === limite.getTime()) {
          const slotStr = format(atual, 'HH:mm');
          
          // Se for hoje, só mostrar horários futuros (+30 min de margem opcional, usando agora normal)
          if (isToday) {
            const slotTime = new Date();
            slotTime.setHours(atual.getHours(), atual.getMinutes(), 0);
            if (isBefore(slotTime, now)) {
              atual = addMinutes(atual, tipoSel.duracao_media_minutos || 15);
              continue;
            }
          }
          
          slots.push(slotStr);
          atual = addMinutes(atual, tipoSel.duracao_media_minutos || 15);
        }
        setHorariosDisponiveisDia(slots);
      }
      
      setLoading(false);
    };
    
    fetchAgendamentosDia();
  }, [dataSel, unidadeSel, tipoSel, horariosFuncionamento]);

  const handleNext = () => {
    if (etapa === 1 && !unidadeSel) { toast({title: 'Atenção', description: 'Selecione uma unidade para continuar.'}); return;}
    if (etapa === 2 && !tipoSel) { toast({title: 'Atenção', description: 'Selecione o tipo de atendimento.'}); return; }
    if (etapa === 3 && (!dataSel || !horaSel)) { toast({title: 'Atenção', description: 'Selecione a data e o horário.'}); return; }
    setEtapa(e => e + 1);
  };
  
  const handleBack = () => {
    setEtapa(e => e - 1);
  };

  const confirmarAgendamento = async () => {
    if (!user || !unidadeSel || !tipoSel || !dataSel || !horaSel || !perfil) return;
    
    setSubmitting(true);
    
    const grupo_prioridade = perfil.grupo_prioridade || 'normal';
    
    const { data: inserirData, error } = await supabase
      .from('agendamentos')
      .insert({
        unidade_id: unidadeSel.id,
        usuario_id: user.id,
        tipo_atendimento_id: tipoSel.id,
        data_agendamento: format(dataSel, 'yyyy-MM-dd'),
        hora_agendamento: horaSel + ':00', // Adiciona os segundos exigidos no banco
        grupo_prioridade,
        status: 'agendado',
      })
      .select('numero_senha')
      .single();

    setSubmitting(false);

    if (error) {
      toast({ title: 'Erro ao agendar', description: error.message, variant: 'destructive' });
      return;
    }
    
    setSenhaGerada(inserirData.numero_senha);
    setEtapa(5); // Tela de Sucesso
  };

  if (loading && etapa === 1) {
    return <div className="flex min-h-screen items-center justify-center bg-transparent"><LoadingSpinner /></div>;
  }

  // Renderização da Tela de Sucesso (Etapa 5)
  if (etapa === 5 && senhaGerada) {
    return (
      <div className="min-h-screen bg-transparent pb-20 md:pb-0 font-[Inter]">
        <DashboardHeader isAdmin={perfil?.perfil === 'administrador'} />
        <main className="container max-w-2xl py-12 space-y-8 animate-fade-in text-center">
          <div className="mx-auto w-24 h-24 bg-[#00d4aa]/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-[#00d4aa]" />
          </div>
          <h1 className="text-3xl font-bold text-[#e8e8f0] font-[Syne]">Agendamento Confirmado!</h1>
          <p className="text-[#6b6b8a] text-lg">Sua senha foi gerada com sucesso e já está na fila.</p>
          
          <Card className="max-w-md mx-auto border-[#7c6aff] bg-[#7c6aff]/10">
            <CardContent className="p-8">
              <span className="text-[10px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a] mb-2 block">Sua Senha</span>
              <span className="text-6xl font-black text-[#e8e8f0] font-[Syne] tracking-widest">{senhaGerada}</span>
            </CardContent>
          </Card>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button size="lg" onClick={() => navigate('/dashboard')} className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white border-0 hover:opacity-90">
              Ver minha posição na fila
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/dashboard')} className="bg-transparent border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff]">
              Voltar ao Início
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-20 md:pb-0 flex flex-col font-[Inter]">
      <DashboardHeader isAdmin={perfil?.perfil === 'administrador'} />

      <main className="container max-w-3xl py-6 flex-1 flex flex-col animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#e8e8f0] font-[Syne]">Novo Agendamento</h1>
          <p className="text-sm text-[#6b6b8a] mt-1">Siga as etapas para concluir a sua reserva.</p>
        </div>

        {/* Stepper visual */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
          {ETAPAS.map((step, idx) => (
            <div key={step.id} className="flex relative items-center min-w-fit flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300
                  ${etapa === step.id ? 'bg-[#7c6aff]/15 border-[#7c6aff] text-[#7c6aff]' : 
                    etapa > step.id ? 'bg-[#00d4aa]/15 border-[#00d4aa] text-[#00d4aa]' : 'bg-transparent border-[#2d2d45] text-[#6b6b8a]'}
                `}>
                  <step.icon size={18} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-[1.5px] ${etapa >= step.id ? 'text-[#e8e8f0]' : 'text-[#6b6b8a]'}`}>{step.titulo}</span>
              </div>
              {idx < ETAPAS.length - 1 && (
                <div className={`absolute top-5 left-1/2 w-full h-0.5 -mt-px -z-0 transition-colors duration-300 ${etapa > step.id ? 'bg-[#00d4aa]' : 'bg-[#2d2d45]'}`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#13131f] rounded-xl border border-[#2d2d45] p-4 sm:p-6 shadow-sm min-h-[400px]">
          
          {/* ETAPA 1: UNIDADE */}
          {etapa === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-[11px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a] mb-4">Selecione o Local</h2>
              {unidades.length === 0 ? (
                 <p className="text-[#6b6b8a] text-center py-8">Nenhuma unidade disponível no momento.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {unidades.map(unidade => (
                    <Card 
                      key={unidade.id} 
                      className={`cursor-pointer transition-all bg-[#111118] border-[#2d2d45] hover:border-[#7c6aff] ${unidadeSel?.id === unidade.id ? 'border-[#7c6aff] ring-1 ring-[#7c6aff] bg-[#7c6aff]/10' : ''}`}
                      onClick={() => setUnidadeSel(unidade)}
                    >
                      <CardContent className="p-4 flex flex-col gap-2">
                        <div className="font-semibold text-[#e8e8f0] text-base">{unidade.nome}</div>
                        <div className="text-sm text-[#6b6b8a] flex items-start gap-1">
                          <MapPin size={14} className="mt-0.5 shrink-0" />
                          <span>{unidade.endereco}, {unidade.cidade} - {unidade.estado}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2: TIPO ATENDIMENTO */}
          {etapa === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-[11px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a] mb-4">O que deseja agendar?</h2>
              {tiposAtendimento.length === 0 ? (
                 <p className="text-[#6b6b8a] text-center py-8">Nenhum atendimento disponível nesta unidade.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {tiposAtendimento.map(tipo => (
                    <Card 
                      key={tipo.id} 
                      className={`cursor-pointer transition-all bg-[#111118] border-[#2d2d45] hover:border-[#7c6aff] flex flex-col h-full ${tipoSel?.id === tipo.id ? 'border-[#7c6aff] ring-1 ring-[#7c6aff] bg-[#7c6aff]/10' : ''}`}
                      onClick={() => setTipoSel(tipo)}
                    >
                      <CardContent className="p-4 flex flex-col gap-2 flex-1">
                        <div className="font-semibold text-[#e8e8f0] text-base">{tipo.nome}</div>
                        {tipo.descricao && <p className="text-sm text-[#6b6b8a] flex-1">{tipo.descricao}</p>}
                        <div className="mt-2 text-xs font-medium inline-flex items-center text-[#7c6aff] bg-[#7c6aff]/10 px-2 py-1 rounded w-fit border border-[#7c6aff]/20">
                          <Clock size={12} className="mr-1" />
                          ~{tipo.duracao_media_minutos} minutos
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3: DATA E HORA */}
          {etapa === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1">
                  <h2 className="text-[11px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a] mb-4">Escolha a Data</h2>
                  <div className="border border-[#2d2d45] rounded-xl p-2 flex justify-center bg-[#13131f] text-[#e8e8f0] [&_.rdp-day]:text-[#e8e8f0] [&_.rdp-day_button:hover]:bg-[#7c6aff]/20 [&_.rdp-button_disabled]:text-[#6b6b8a] [&_.rdp-button_disabled]:cursor-not-allowed">
                    <Calendar
                      mode="single"
                      selected={dataSel}
                      onSelect={(day) => {
                        setDataSel(day);
                        setHoraSel(null); // reseta a hora se trocar o dia
                      }}
                      disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                      className="rounded-md"
                      classNames={{
                        day_selected: "bg-[#7c6aff] text-white hover:bg-[#7c6aff] hover:text-white focus:bg-[#7c6aff] focus:text-white",
                        day_today: "border border-[#7c6aff] text-[#e8e8f0]"
                      }}
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <h2 className="text-[11px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a] mb-4">Escolha o Horário</h2>
                  {!dataSel ? (
                    <div className="h-full flex items-center justify-center p-8 border border-dashed border-[#2d2d45] rounded-lg text-[#6b6b8a] text-sm text-center">
                      Selecione uma data no calendário 
                      <br />para visualizar os horários disponíveis.
                    </div>
                  ) : loading ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : horariosDisponiveisDia.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-8 border border-dashed border-[#2d2d45] rounded-lg text-[#6b6b8a] text-sm text-center bg-[#111118]/30">
                      Infelizmente não há horários de <br/>funcionamento para este dia.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                       {horariosDisponiveisDia.map(hora => {
                         const ocupado = horariosOcupados.includes(hora);
                         return (
                           <button
                             key={hora}
                             disabled={ocupado}
                             onClick={() => setHoraSel(hora)}
                             className={`
                               py-2 text-sm font-medium rounded-md transition-all border
                               ${ocupado ? 'opacity-50 bg-[#13131f] text-[#6b6b8a] cursor-not-allowed border-[#2d2d45]' : 
                                 horaSel === hora ? 'bg-[#7c6aff] text-white border-[#7c6aff] shadow-sm' : 
                                 'bg-[#111118] text-[#e8e8f0] border-[#2d2d45] hover:border-[#7c6aff] hover:text-[#7c6aff]'
                               }
                             `}
                           >
                             {hora}
                           </button>
                         )
                       })}
                    </div>
                  )}
                  {dataSel && !loading && horariosDisponiveisDia.length > 0 && horariosDisponiveisDia.every(h => horariosOcupados.includes(h)) && (
                    <p className="text-sm text-[#ff6b6b] mt-4 text-center">Todos os horários estão agendados para este dia.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 4: CONFIRMAÇÃO */}
          {etapa === 4 && (
            <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[#e8e8f0] font-[Syne]">Resumo do Agendamento</h2>
                <p className="text-[#6b6b8a] text-sm">Verifique os dados antes de confirmar.</p>
              </div>

              <div className="bg-[#111118] rounded-xl p-5 border border-[#2d2d45] space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-[#7c6aff]/10 p-2 rounded-lg text-[#7c6aff]"><MapPin size={20}/></div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a]">Local de Atendimento</h4>
                    <p className="font-medium text-[#e8e8f0] text-base">{unidadeSel?.nome}</p>
                    <p className="text-sm text-[#6b6b8a]">{unidadeSel?.endereco}, {unidadeSel?.cidade}</p>
                  </div>
                </div>
                
                <hr className="border-[#1e1e2e]" />
                
                <div className="flex items-start gap-4">
                   <div className="bg-[#7c6aff]/10 p-2 rounded-lg text-[#7c6aff]"><Info size={20} /></div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a]">Serviço</h4>
                    <p className="font-medium text-[#e8e8f0] text-base">{tipoSel?.nome}</p>
                  </div>
                </div>

                <hr className="border-[#1e1e2e]" />
                
                <div className="flex items-start gap-4">
                   <div className="bg-[#7c6aff]/10 p-2 rounded-lg text-[#7c6aff]"><CalendarDays size={20} /></div>
                  <div className="flex flex-wrap gap-x-8 gap-y-2">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a]">Data</h4>
                      <p className="font-medium text-[#e8e8f0] text-base">{dataSel ? format(dataSel, "dd 'de' MMMM, yyyy", { locale: ptBR }) : '-'}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a]">Horário</h4>
                      <p className="font-medium text-[#e8e8f0] text-base">{horaSel}</p>
                    </div>
                  </div>
                </div>
                
                <hr className="border-[#1e1e2e]" />

                <div className="flex items-start gap-4">
                   <div className="bg-[#f59e0b]/15 p-2 rounded-lg text-[#f59e0b]"><CheckCircle2 size={20} /></div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[1.5px] font-bold text-[#6b6b8a]">Seu Perfil/Prioridade</h4>
                    <Badge variant="outline" className="mt-1 capitalize bg-transparent border-[#7c6aff] text-[#7c6aff] bg-[#7c6aff]/10">{perfil?.grupo_prioridade || 'Normal'}</Badge>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Rodapé de Navegação */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-[#1e1e2e]">
          <Button 
            variant="outline" 
            onClick={handleBack} 
            disabled={etapa === 1 || submitting}
            className="w-28 bg-transparent border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff]"
          >
            <ChevronLeft size={16} className="mr-1" />
            Voltar
          </Button>

          {etapa < 4 ? (
            <Button 
              onClick={handleNext} 
              className="w-28 bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white border-0 hover:opacity-90"
            >
              Próximo
              <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={confirmarAgendamento} 
              disabled={submitting}
              className="w-40 bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white border-0 hover:opacity-90"
            >
              {submitting ? <LoadingSpinner size={16} /> : 'Confirmar'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
