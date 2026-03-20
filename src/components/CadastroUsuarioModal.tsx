import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, ArrowLeft, Check, Copy, User, Lock, Upload, ShieldCheck, Camera } from 'lucide-react';

interface CadastroUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user?: any) => void;
}

export function CadastroUsuarioModal({ isOpen, onClose, onSuccess }: CadastroUsuarioModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  const [createdUser, setCreatedUser] = useState<any>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [prioridade, setPrioridade] = useState('normal');

  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSuccessMode(false);
      setNome('');
      setEmail('');
      setCpf('');
      setTelefone('');
      setDataNascimento('');
      setPrioridade('normal');
      setSenha('');
      setConfirmarSenha('');
      setTermosAceitos(false);
      setCreatedUser(null);
    }
  }, [isOpen]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    setCpf(value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    setTelefone(value);
  };

  const getPasswordStrength = () => {
    let strength = 0;
    if (senha.length >= 8) strength += 25;
    if (/[A-Z]/.test(senha)) strength += 25;
    if (/[0-9]/.test(senha)) strength += 25;
    if (/[^A-Za-z0-9]/.test(senha)) strength += 25;
    return strength;
  };

  const getPasswordColor = () => {
    const s = getPasswordStrength();
    if (s === 0) return 'bg-[#2d2d45]';
    if (s <= 25) return 'bg-[#ff6b6b]';
    if (s <= 50) return 'bg-[#f59e0b]';
    if (s <= 75) return 'bg-[#7c6aff]';
    return 'bg-[#00d4aa]';
  };

  const handleNext = () => {
    if (step === 1) {
      if (!nome || !email) {
        toast({ title: 'Atenção', description: 'Preencha os campos obrigatórios (*)', variant: 'destructive' });
        return;
      }
      if (!email.includes('@')) {
        toast({ title: 'Atenção', description: 'Insira um e-mail válido.', variant: 'destructive' });
        return;
      }
    } else if (step === 2) {
      if (senha.length < 8) {
        toast({ title: 'Atenção', description: 'A senha deve ter no mínimo 8 caracteres.', variant: 'destructive' });
        return;
      }
      if (senha !== confirmarSenha) {
        toast({ title: 'Atenção', description: 'As senhas não coincidem.', variant: 'destructive' });
        return;
      }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!termosAceitos) {
      toast({ title: 'Atenção', description: 'Você deve aceitar os termos de uso.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    /*
     * NOTA: Utilizando a Edge Function via fetch em vez de supabase.auth.signUp()!
     * O motivo é que o signUp() efetua o login do novo usuário imediatamente, 
     * deslogando o administrador que está operando o painel, quebrando a UX!
     */
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('Session:', session);
      console.log('Access token:', session?.access_token);
      console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

      if (!session) {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('User:', user);
      }

      // Usar o token do localStorage como fallback
      const localToken = localStorage.getItem('sb-qlssrbkoxndiprbfjunk-auth-token');
      const parsedToken = localToken ? JSON.parse(localToken) : null;
      console.log('Local token:', parsedToken?.access_token);

      const authToken = session?.access_token || parsedToken?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-usuario-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
          },
          body: JSON.stringify({
            nome_completo: nome, 
            email, 
            senha,
            cpf: cpf || null, 
            telefone: telefone || null, 
            data_nascimento: dataNascimento || null, 
            grupo_prioridade: prioridade
          })
        }
      );
      
      const resData = await response.json();

      if (!response.ok) throw new Error(resData.erro || 'Erro na Edge Function');
      if (resData?.erro) throw new Error(resData.erro);

      const { data: profile } = await supabase.from('perfis').select('*').eq('id', resData.usuario.id).single();
      
      setCreatedUser(profile || resData.usuario);
      setLoading(false);
      setSuccessMode(true);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  // --- RENDERERS ---

  if (successMode) {
    return (
      <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md bg-[#111118] border-[#00d4aa]/30 p-0 overflow-hidden text-[#e8e8f0]">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-[#00d4aa] text-xl font-[Syne] font-bold">
              <Check className="text-[#00d4aa]" size={24} />
              Usuário cadastrado!
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-6 space-y-4">
            <p className="text-sm text-[#6b6b8a]">
              Passe as credenciais abaixo para o usuário:
            </p>
            
            <div className="bg-[#13131f] border border-[#2d2d45] rounded-lg p-4 font-mono text-[#e8e8f0] space-y-3 selectable">
              <div>
                <span className="text-xs text-[#6b6b8a] uppercase tracking-[1px] block mb-1">📧 Email:</span>
                <p className="font-bold text-base break-all select-all">{email}</p>
              </div>
              <div>
                <span className="text-xs text-[#6b6b8a] uppercase tracking-[1px] block mb-1">🔑 Senha:</span>
                <p className="font-bold text-base select-all">{senha}</p>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-11 border-[#7c6aff]/30 text-[#7c6aff] hover:bg-[#7c6aff]/10 font-semibold bg-transparent"
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${email}\nSenha: ${senha}`);
                toast({ title: 'Copiado', description: 'Credenciais copiadas!', className: 'bg-[#00d4aa] text-white border-none' });
              }}
            >
              <Copy size={16} className="mr-2" />
              📋 Copiar credenciais
            </Button>
            
            <p className="text-xs text-center text-[#6b6b8a]">
              O usuário pode trocar a senha após o primeiro acesso.
            </p>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 p-4 border-t border-[#1e1e2e] bg-[#13131f] sm:justify-between">
            <Button variant="outline" className="border-[#2d2d45] text-[#e8e8f0] bg-transparent hover:bg-[#1e1e2e] hover:text-[#e8e8f0]" onClick={() => { onClose(); onSuccess(); }}>
              Fechar
            </Button>
            <Button className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] hover:opacity-90 text-white min-w-[170px] border-0" onClick={() => onSuccess(createdUser)}>
              + Novo Atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-[#111118] border-[#2d2d45] text-[#e8e8f0] p-0 gap-0 overflow-hidden">
        <div className="bg-[#13131f] border-b border-[#1e1e2e] p-4 sm:px-6">
           <DialogHeader>
             <DialogTitle className="font-[Syne] text-xl text-[#e8e8f0] flex items-center gap-2">
               <User className="text-[#00d4aa]" size={20} />
               Cadastrar Novo Usuário
             </DialogTitle>
             <DialogDescription className="hidden">Cadastro completo de paciente</DialogDescription>
           </DialogHeader>
           
           <div className="flex items-center gap-2 mt-5">
             {[1, 2, 3].map(s => (
               <div key={s} className="flex items-center flex-1 last:flex-none">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? 'bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white shadow-sm' : 'bg-[#1e1e2e] text-[#6b6b8a]'}`}>
                    {step > s ? <Check size={16}/> : s}
                 </div>
                 {s < 3 && <div className={`h-1 flex-1 mx-2 rounded-full ${step > s ? 'bg-[#00d4aa]' : 'bg-[#1e1e2e]'}`} />}
               </div>
             ))}
           </div>
           
           <div className="flex justify-between text-xs font-semibold text-[#6b6b8a] mt-2 px-1 tracking-[0.5px]">
              <span className={step >= 1 ? 'text-[#e8e8f0]' : ''}>Dados</span>
              <span className={step >= 2 ? 'text-[#e8e8f0] text-center' : 'text-center'}>Acesso</span>
              <span className={step >= 3 ? 'text-[#e8e8f0] text-right' : 'text-right'}>Finalizar</span>
           </div>
        </div>
        
        <div className="p-4 sm:p-6 min-h-[300px] max-h-[60vh] overflow-y-auto">
           {step === 1 && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
               <div className="space-y-1.5 sm:col-span-2">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">Nome Completo *</label>
                 <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Maria da Silva" className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" />
               </div>
               <div className="space-y-1.5 sm:col-span-2">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">E-mail *</label>
                 <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@email.com" className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" />
               </div>
               <div className="space-y-1.5">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">CPF</label>
                 <Input value={cpf} onChange={handleCpfChange} placeholder="000.000.000-00" className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" />
               </div>
               <div className="space-y-1.5">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">Telefone</label>
                 <Input value={telefone} onChange={handlePhoneChange} placeholder="(00) 00000-0000" className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" />
               </div>
               <div className="space-y-1.5">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">Data de Nascimento</label>
                 <Input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" style={{ colorScheme: 'dark' }} />
               </div>
               <div className="space-y-1.5">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">Grupo Prioritário</label>
                 <Select value={prioridade} onValueChange={setPrioridade}>
                   <SelectTrigger className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus:ring-[#7c6aff]"><SelectValue/></SelectTrigger>
                   <SelectContent className="bg-[#13131f] border-[#2d2d45] text-[#e8e8f0]">
                     <SelectItem value="normal" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Normal (Sem Prioridade)</SelectItem>
                     <SelectItem value="idoso" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Idoso (60+)</SelectItem>
                     <SelectItem value="gestante" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Gestante</SelectItem>
                     <SelectItem value="deficiente" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">PCD</SelectItem>
                     <SelectItem value="lactante" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Lactante</SelectItem>
                     <SelectItem value="obeso" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Obeso</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             </div>
           )}

           {step === 2 && (
             <div className="space-y-5 animate-fade-in max-w-md mx-auto py-2">
               <div className="bg-[#7c6aff]/10 text-[#7c6aff] p-3 rounded-lg text-sm mb-4 border border-[#7c6aff]/20 flex items-start gap-2">
                 <Lock size={18} className="mt-0.5 flex-shrink-0" />
                 <p>A senha deve conter no mínimo 8 caracteres, mesclando letras, números ou símbolos.</p>
               </div>
               
               <div className="space-y-1.5">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">Senha de Acesso *</label>
                 <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" />
                 
                 {/* Força da Senha */}
                 <div className="mt-2 space-y-1">
                   <div className="flex gap-1 h-1.5">
                     <div className={`flex-1 rounded-full transition-colors ${getPasswordStrength() >= 25 ? getPasswordColor() : 'bg-[#2d2d45]'}`} />
                     <div className={`flex-1 rounded-full transition-colors ${getPasswordStrength() >= 50 ? getPasswordColor() : 'bg-[#2d2d45]'}`} />
                     <div className={`flex-1 rounded-full transition-colors ${getPasswordStrength() >= 75 ? getPasswordColor() : 'bg-[#2d2d45]'}`} />
                     <div className={`flex-1 rounded-full transition-colors ${getPasswordStrength() >= 100 ? getPasswordColor() : 'bg-[#2d2d45]'}`} />
                   </div>
                   <p className="text-xs text-[#6b6b8a] text-right uppercase tracking-[1px] mt-2">
                     {getPasswordStrength() <= 25 && 'Fraca'}
                     {getPasswordStrength() === 50 && 'Razoável'}
                     {getPasswordStrength() === 75 && 'Boa'}
                     {getPasswordStrength() === 100 && 'Forte!'}
                   </p>
                 </div>
               </div>
               
               <div className="space-y-1.5 mt-4">
                 <label className="text-sm font-medium text-[#6b6b8a] uppercase tracking-[1px] text-[11px]">Confirmar Senha *</label>
                 <Input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="••••••••" className="h-11 bg-[#13131f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" />
                 {confirmarSenha && senha !== confirmarSenha && (
                   <p className="text-xs text-[#ff6b6b] font-medium mt-1">As senhas não coincidem.</p>
                 )}
               </div>
             </div>
           )}

           {step === 3 && (
             <div className="space-y-6 animate-fade-in py-2">
               
               <div className="bg-[#13131f] p-4 border border-[#2d2d45] rounded-lg flex items-start gap-3">
                 <div className="mt-0.5">
                   <input 
                     type="checkbox" 
                     id="termos" 
                     checked={termosAceitos} 
                     onChange={e => setTermosAceitos(e.target.checked)}
                     className="w-4 h-4 rounded border-[#2d2d45] text-[#7c6aff] focus:ring-[#7c6aff] bg-[#111118]"
                   />
                 </div>
                 <label htmlFor="termos" className="text-sm text-[#e8e8f0] cursor-pointer">
                   Declaro que conferi os dados e que o paciente está ciente dos <a href="#" className="font-semibold text-[#7c6aff] hover:underline">Termos de Uso</a> e das 
                   Políticas de Privacidade sobre o tratamento de informações médicas.
                 </label>
               </div>
               
             </div>
           )}
        </div>
        
        <DialogFooter className="border-t border-[#1e1e2e] bg-[#13131f] p-4 sm:px-6 flex justify-between gap-3 flex-row sm:justify-between">
           <Button variant="outline" className="border-[#2d2d45] text-[#e8e8f0] bg-transparent hover:bg-[#1e1e2e] hover:text-[#e8e8f0]" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} disabled={loading}>
             {step > 1 ? <><ArrowLeft size={16} className="mr-2"/> Voltar</> : 'Cancelar'}
           </Button>
           
           {step < 3 ? (
             <Button 
               className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] hover:opacity-90 text-white min-w-[120px] border-0" 
               onClick={handleNext}
             >
               Próximo <ArrowRight size={16} className="ml-2"/>
             </Button>
           ) : (
             <Button 
                className="bg-gradient-to-r from-[#00d4aa] to-[#00b38f] hover:opacity-90 text-white min-w-[150px] border-0"
                onClick={handleSubmit}
                disabled={loading || !termosAceitos}
             >
               {loading ? <LoadingSpinner size={18} /> : <><Check size={18} className="mr-2"/> Criar Conta</>}
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
