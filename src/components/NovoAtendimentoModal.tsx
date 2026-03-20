import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Search, UserPlus, ArrowRight, ArrowLeft, Check, User as UserIcon, Calendar, Clock, AlertCircle, Copy } from 'lucide-react';
import { format, parseISO, addMinutes, isAfter, setHours, setMinutes, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NovoAtendimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  unidadeId: string;
  onSuccess: () => void;
  initialUser?: any;
}

export function NovoAtendimentoModal({ isOpen, onClose, unidadeId, onSuccess, initialUser }: NovoAtendimentoModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // STEP 1 - User
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // STEP 2 - Service
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);

  // STEP 3 - Date / Time
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotStatusMsg, setSlotStatusMsg] = useState('');

  // ----- RESET STATE ON OPEN -----
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (initialUser) {
        setSearchQuery(initialUser.nome_completo || initialUser.cpf || '');
        setUsers([initialUser]);
        setSelectedUser(initialUser);
      } else {
        setSearchQuery('');
        setUsers([]);
        setSelectedUser(null);
      }
      setSelectedService(null);
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
      setSelectedSlot(null);
      loadServices();
    }
  }, [isOpen, initialUser]);

  // ----- STEP 1: DEBOUNCE SEARCH -----
  useEffect(() => {
    if (searchQuery.length < 3) {
      setUsers([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .or(`nome_completo.ilike.%${searchQuery}%,cpf.ilike.%${searchQuery}%`)
        .limit(10);
      
      if (!error && data) setUsers(data);
      setLoading(false);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleNextStep = async () => {
    if (step === 1) {
      if (selectedUser) {
        setStep(2);
      } else {
        toast({ title: 'Atenção', description: 'Busque e selecione um paciente.', variant: 'destructive' });
      }
    } else {
      setStep(s => s + 1);
    }
  };

  // ----- STEP 2: LOAD SERVICES -----
  const loadServices = async () => {
    if (!unidadeId) return;
    const { data } = await supabase
      .from('tipos_atendimento')
      .select('*')
      .eq('unidade_id', unidadeId)
      .eq('ativo', true);
    if (data) setServices(data);
  };

  // ----- STEP 3: CHECK SCHEDULE AND SLOTS -----
  useEffect(() => {
    if (step === 3 && selectedService && selectedDate) {
      checkAvailability();
    }
  }, [step, selectedDate, selectedService]);

  const checkAvailability = async () => {
    setLoading(true);
    setSlotStatusMsg('');
    setAvailableSlots([]);

    const dt = parseISO(selectedDate);
    // Sunday = 0
    let diaDaSemana = dt.getDay() === 0 ? 7 : dt.getDay(); 

    // Find operating hours
    const { data: opData } = await supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('unidade_id', unidadeId)
      .eq('dia_semana', diaDaSemana)
      .single();

    if (!opData || !opData.aberto) {
      setSlotStatusMsg('Unidade fechada nesta data.');
      setLoading(false);
      return;
    }

    // Check Vagas Maximas
    const { data: agendas } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('unidade_id', unidadeId)
      .eq('tipo_atendimento_id', selectedService.id)
      .eq('data_agendamento', selectedDate)
      .not('status', 'in', '("cancelado","nao_compareceu")');

    const totalUsadas = agendas?.length || 0;
    if (totalUsadas >= selectedService.vagas_maximas_dia) {
      setSlotStatusMsg('Sem vagas para este dia. Selecione outro dia.');
      setLoading(false);
      return;
    }

    // Generate Slots
    let start = parse(opData.abre_as, 'HH:mm:ss', dt);
    const end = parse(opData.fecha_as, 'HH:mm:ss', dt);
    const duracao = selectedService.duracao_media_minutos;

    const slots: string[] = [];
    const now = new Date();
    const isToday = format(dt, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');

    while (!isAfter(addMinutes(start, duracao), end)) {
      if (isToday && start < now) {
         // skip past slots for today
      } else {
         const sltStr = format(start, 'HH:mm:ss');
         // Check if exact slot is taken (basic collision check)
         if (!agendas?.some(a => a.hora_agendamento === sltStr)) {
            slots.push(sltStr.substring(0, 5));
         }
      }
      start = addMinutes(start, duracao);
    }

    if (slots.length === 0) {
      setSlotStatusMsg('Nenhum horário livre restante neste dia.');
    } else {
      setAvailableSlots(slots);
    }

    setLoading(false);
  };

  // ----- STEP 4: CONFIRM AND CREATE -----
  const handleFinalize = async () => {
    setLoading(true);
    
    const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
    const hasVacancy = availableSlots.length > 0;
    
    // Create status
    let status = 'agendado';
    if (isToday && hasVacancy) {
      status = 'aguardando';
    }

    // Generate random code ex: CLT123
    const pfx = selectedService.nome.substring(0, 3).toUpperCase();
    const numeroSenha = `${pfx}${Math.floor(100 + Math.random() * 900)}`;

    const { data: agData, error: agError } = await supabase
      .from('agendamentos')
      .insert({
        unidade_id: unidadeId,
        usuario_id: selectedUser.id,
        tipo_atendimento_id: selectedService.id,
        data_agendamento: selectedDate,
        hora_agendamento: selectedSlot ? `${selectedSlot}:00` : format(new Date(), 'HH:mm:ss'),
        status: status as any,
        grupo_prioridade: selectedUser.grupo_prioridade || 'normal',
        numero_senha: numeroSenha,
        pontuacao_prioridade: selectedUser.grupo_prioridade !== 'normal' ? 10 : 0
      })
      .select('id')
      .single();

    if (agError) {
      toast({ title: 'Erro ao agendar', description: agError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (status === 'aguardando') {
      // Put in queue
      const { count } = await supabase.from('fila').select('id', { count: 'exact', head: true }).eq('unidade_id', unidadeId);
      await supabase.from('fila').insert({
        agendamento_id: agData.id,
        unidade_id: unidadeId,
        posicao: (count || 0) + 1,
      });
    }

    setLoading(false);
    toast({ 
      title: 'Sucesso!', 
      description: `Atendimento gerado. Senha: ${numeroSenha}`,
      className: 'bg-blue-600 text-white border-none'
    });
    
    onSuccess();
    onClose();
  };

  const renderStep1 = () => (
    <div className="space-y-4 animate-fade-in">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">Buscar Paciente (Nome ou CPF)</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#6b6b8a]" />
              <Input 
                autoFocus
                placeholder="Ex: João da Silva" 
                className="pl-9 h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="min-h-[200px] border border-[#2d2d45] rounded-lg p-2 bg-[#13131f]/50">
            {loading && <div className="p-4 flex justify-center"><LoadingSpinner size={20} /></div>}
            
            {!loading && users.length > 0 && (
              <div className="space-y-1">
                {users.map(u => (
                  <div 
                    key={u.id} 
                    onClick={() => setSelectedUser(u)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-[#7c6aff]/10 border border-[#7c6aff]/30' : 'hover:bg-[#1e1e2e] border border-transparent'}`}
                  >
                    <div className="w-10 h-10 bg-[#7c6aff]/20 text-[#7c6aff] rounded-full flex items-center justify-center font-bold text-lg">
                      {u.nome_completo?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#e8e8f0]">{u.nome_completo}</p>
                      <p className="text-sm text-[#6b6b8a]">{u.cpf ? `CPF: ${u.cpf}` : 'Sem CPF'} • {u.telefone || 'Sem Tel'}</p>
                    </div>
                    {selectedUser?.id === u.id && <Check className="text-[#00d4aa]" size={20} />}
                  </div>
                ))}
              </div>
            )}
            
            {!loading && searchQuery.length >= 3 && users.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center text-[#6b6b8a] px-4">
                <UserIcon size={32} className="mb-2 opacity-50" />
                <p>Nenhum paciente encontrado com "{searchQuery}".</p>
                <p className="mt-4 text-sm max-w-sm">
                  Use o botão <strong className="text-[#7c6aff]">'+ Cadastrar Usuário'</strong> no painel admin para criar um novo cadastro.
                </p>
              </div>
            )}
          </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4 animate-fade-in">
      <h3 className="font-semibold text-[#e8e8f0]">O que deseja agendar?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.length === 0 && <p className="text-[#6b6b8a] col-span-2 py-4 text-center">Nenhum serviço disponível.</p>}
        {services.map(s => (
          <div 
            key={s.id}
            onClick={() => setSelectedService(s)}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedService?.id === s.id ? 'border-[#7c6aff] bg-[#7c6aff]/10' : 'border-[#2d2d45] hover:border-[#7c6aff]/50 bg-[#13131f]'}`}
          >
            <p className="font-bold text-[#e8e8f0]">{s.nome}</p>
            <p className="text-sm text-[#6b6b8a] mt-1 flex items-center gap-1">
              <Clock size={14} /> aprox. {s.duracao_media_minutos} min
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
           <label className="text-sm font-semibold text-[#6b6b8a] uppercase tracking-[1px] text-[11px] flex items-center gap-2"><Calendar size={16}/> Data do Atendimento</label>
           <Input 
             type="date" 
             value={selectedDate} 
             onChange={e => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
             className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]"
             min={format(new Date(), 'yyyy-MM-dd')}
             style={{ colorScheme: 'dark' }}
           />
        </div>
      </div>
      
      <div className="border-t border-[#1e1e2e] pt-4">
         <label className="text-sm font-semibold text-[#6b6b8a] uppercase tracking-[1px] text-[11px] flex items-center gap-2 mb-3"><Clock size={16}/> Horários Disponíveis</label>
         
         {loading ? (
            <div className="py-8 flex justify-center"><LoadingSpinner size={24}/></div>
         ) : slotStatusMsg ? (
            <div className="bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 text-[#ff6b6b] p-4 rounded-lg flex gap-3 text-sm">
               <AlertCircle size={20} className="flex-shrink-0" />
               <p>{slotStatusMsg}</p>
            </div>
         ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[220px] overflow-y-auto pr-2 pb-2">
               {availableSlots.map(s => (
                  <Button
                    key={s}
                    variant="outline"
                    onClick={() => setSelectedSlot(s)}
                    className={`h-10 text-sm font-medium ${selectedSlot === s ? 'bg-[#7c6aff] text-white border-[#7c6aff] hover:bg-[#7c6aff]/90 hover:text-white' : 'border-[#2d2d45] text-[#e8e8f0] bg-transparent hover:bg-[#1e1e2e] hover:text-[#e8e8f0]'}`}
                  >
                    {s}
                  </Button>
               ))}
            </div>
         )}
      </div>
    </div>
  );

  const renderStep4 = () => {
    const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
    const hasVacancy = availableSlots.length > 0;
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-[#13131f] border border-[#2d2d45] rounded-xl p-5 space-y-4">
           <h3 className="font-bold text-lg text-[#e8e8f0] border-b border-[#1e1e2e] pb-2 font-[Syne]">Resumo da Solicitação</h3>
           
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <p className="text-xs text-[#6b6b8a] font-semibold uppercase tracking-[1px]">Paciente</p>
                 <p className="font-medium text-[#e8e8f0]">{selectedUser?.nome_completo}</p>
                 <Badge variant="outline" className="mt-1 border-[#2d2d45] text-[#6b6b8a]">{selectedUser?.grupo_prioridade || 'Normal'}</Badge>
              </div>
              <div>
                 <p className="text-xs text-[#6b6b8a] font-semibold uppercase tracking-[1px]">Serviço</p>
                 <p className="font-medium text-[#e8e8f0]">{selectedService?.nome}</p>
                 <p className="text-sm text-[#6b6b8a]">{selectedService?.duracao_media_minutos} min</p>
              </div>
              <div>
                 <p className="text-xs text-[#6b6b8a] font-semibold uppercase tracking-[1px]">Data e Hora</p>
                 <p className="font-medium text-[#00d4aa]">{format(parseISO(selectedDate), 'dd/MM/yyyy')}</p>
                 <p className="text-[#00d4aa] font-bold text-lg">{selectedSlot || 'Automático'}</p>
              </div>
           </div>
        </div>
        
        <div className="bg-[#7c6aff]/10 border border-[#7c6aff]/20 p-4 rounded-xl flex items-start gap-3">
           <AlertCircle className="text-[#7c6aff] mt-0.5 flex-shrink-0" size={20} />
           <div className="text-sm text-[#e8e8f0]">
              <strong className="block mb-1 text-[#7c6aff]">Ação que será executada:</strong>
              {isToday && hasVacancy ? (
                <span>Como a data é hoje e há disponibilidade, o paciente <b>entrará automaticamente na fila de espera (Status: Na Fila)</b>.</span>
              ) : (
                <span>O paciente ficará com status <b className="text-[#7c6aff]">Agendado</b> para a data escolhida.</span>
              )}
           </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-[#111118] border-[#2d2d45] text-[#e8e8f0] p-0 gap-0 overflow-hidden">
        {/* Header with Steps */}
        <div className="bg-[#13131f] border-b border-[#1e1e2e] p-4 sm:px-6">
           <DialogHeader>
             <DialogTitle className="font-[Syne] text-xl text-[#e8e8f0]">Novo Atendimento Presencial</DialogTitle>
             <DialogDescription className="hidden">Criação manual pelo Admin</DialogDescription>
           </DialogHeader>
           
           <div className="flex items-center gap-2 mt-4">
             {[1, 2, 3, 4].map(s => (
               <div key={s} className="flex items-center flex-1 last:flex-none">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? 'bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white' : 'bg-[#1e1e2e] text-[#6b6b8a]'}`}>
                    {step > s ? <Check size={16}/> : s}
                 </div>
                 {s < 4 && <div className={`h-1 flex-1 mx-2 rounded-full ${step > s ? 'bg-[#00d4aa]' : 'bg-[#1e1e2e]'}`} />}
               </div>
             ))}
           </div>
           
           <div className="flex justify-between text-xs font-semibold text-[#6b6b8a] mt-2 px-1">
              <span className={step >= 1 ? 'text-[#e8e8f0]' : ''}>Paciente</span>
              <span className={step >= 2 ? 'text-[#e8e8f0] text-center' : 'text-center'}>Serviço</span>
              <span className={step >= 3 ? 'text-[#e8e8f0] text-center' : 'text-center'}>Data</span>
              <span className={step >= 4 ? 'text-[#e8e8f0] text-right' : 'text-right'}>Confirmação</span>
           </div>
        </div>
        
        {/* Body */}
        <div className="p-4 sm:p-6 min-h-[350px]">
           {step === 1 && renderStep1()}
           {step === 2 && renderStep2()}
           {step === 3 && renderStep3()}
           {step === 4 && renderStep4()}
        </div>
        
        {/* Footer actions */}
        <DialogFooter className="border-t border-[#1e1e2e] bg-[#13131f] p-4 sm:px-6 flex justify-between gap-3 flex-row sm:justify-between">
           <Button variant="outline" className="border-[#2d2d45] text-[#e8e8f0] bg-transparent hover:bg-[#1e1e2e] hover:text-[#e8e8f0]" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}>
             {step > 1 ? <><ArrowLeft size={16} className="mr-2"/> Voltar</> : 'Cancelar'}
           </Button>
           
           {step < 4 ? (
             <Button 
               className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] hover:opacity-90 text-white min-w-[120px] border-0" 
               onClick={handleNextStep}
               disabled={
                 loading ||
                 (step === 1 && !selectedUser) || 
                 (step === 2 && !selectedService) || 
                 (step === 3 && !selectedSlot)
               }
             >
               Próximo <ArrowRight size={16} className="ml-2"/>
             </Button>
           ) : (
             <Button 
                className="bg-gradient-to-r from-[#00d4aa] to-[#00b38f] hover:opacity-90 text-white min-w-[150px] border-0"
                onClick={handleFinalize}
                disabled={loading}
             >
               {loading ? <LoadingSpinner size={18} /> : <><Check size={18} className="mr-2"/> Confirmar e Gerar</>}
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
