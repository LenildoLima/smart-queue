import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SmartQueueLogo } from '@/components/SmartQueueLogo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronLeft, ChevronRight, Camera, ImageIcon } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'idoso', label: 'Idoso (60+)' },
  { value: 'gestante', label: 'Gestante' },
  { value: 'pcd', label: 'Pessoa com deficiência' },
  { value: 'lactante', label: 'Lactante' },
  { value: 'obesidade', label: 'Obesidade grave' },
];

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const passwordStrength = (p: string): { level: number; label: string; color: string } => {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { level: 1, label: 'Fraca', color: 'bg-destructive' };
  if (score <= 2) return { level: 2, label: 'Média', color: 'bg-warning' };
  return { level: 3, label: 'Forte', color: 'bg-success' };
};

const Cadastro = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Step 1
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [nascimento, setNascimento] = useState('');

  // Step 2
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Step 3
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState('normal');
  const [termos, setTermos] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const canNext = () => {
    if (step === 1) return nome.trim() && email.trim();
    if (step === 2) return senha.length >= 8 && senha === confirmarSenha;
    if (step === 3) return termos;
    return false;
  };

  const handleSubmit = async () => {
    if (!canNext()) return;
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            nome_completo: nome.trim(),
            full_name: nome.trim(),
            display_name: nome.trim(),
          },
        },
      });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Erro ao criar conta');

      // Aguarda 1.5 segundos para o trigger criar o perfil
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Upload avatar
      let avatarUrl: string | null = null;
      if (avatar) {
        const fileExt = avatar.name.split('.').pop();
        const filePath = `${userId}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatares')
          .upload(filePath, avatar, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatares')
            .getPublicUrl(filePath);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Atualiza o perfil com todos os dados
      const { error: updateError } = await supabase.from('perfis').update({
        nome_completo: nome.trim(),
        cpf: cpf.replace(/\D/g, '') || null,
        telefone: telefone.replace(/\D/g, '') || null,
        data_nascimento: nascimento || null,
        grupo_prioridade: prioridade,
        url_avatar: avatarUrl,
      }).eq('id', userId);

      if (updateError) {
        console.error('Erro detalhado ao atualizar perfil:', updateError);
      } else {
        console.log('Perfil atualizado com sucesso!');
      }

      toast({ title: 'Bem-vindo ao SmartQueue!', description: 'Sua conta foi criada com sucesso.' });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Erro no cadastro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(senha);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        <div className="flex justify-center">
          <SmartQueueLogo size="lg" />
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">Criar sua conta</h1>
          <p className="text-muted-foreground text-sm">Preencha os dados abaixo</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  s < step
                    ? 'bg-success text-success-foreground'
                    : s === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? <Check size={16} /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-success' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-card space-y-5">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Dados Pessoais</p>
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className="h-11" />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Acesso</p>
              <div className="space-y-2">
                <Label>Senha * (mínimo 8 caracteres)</Label>
                <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" className="h-11" />
                {senha && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-muted'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Força: {strength.label}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Confirmar senha *</Label>
                <Input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="••••••••" className="h-11" />
                {confirmarSenha && senha !== confirmarSenha && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm font-semibold text-foreground">Perfil</p>

              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={32} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex gap-3">
                  <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />
                  <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                    <Camera size={16} className="mr-1" /> Tirar foto
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                    <ImageIcon size={16} className="mr-1" /> Galeria
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Grupo de prioridade</Label>
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                  className="w-full h-11 rounded-lg border bg-background px-3 text-sm text-foreground"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={termos} onChange={(e) => setTermos(e.target.checked)} className="mt-1 accent-primary" />
                <span className="text-sm text-muted-foreground">Li e aceito os Termos de Uso</span>
              </label>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setStep(step - 1)}>
                <ChevronLeft size={16} className="mr-1" /> Voltar
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" className="flex-1 h-11" disabled={!canNext()} onClick={() => setStep(step + 1)}>
                Próximo <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button type="button" className="flex-1 h-11" disabled={!canNext() || loading} onClick={handleSubmit}>
                {loading ? <LoadingSpinner size={20} /> : 'Criar conta'}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Cadastro;
