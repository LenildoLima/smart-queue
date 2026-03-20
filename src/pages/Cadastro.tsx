import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';
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

const STEPS = ['Dados Pessoais', 'Acesso', 'Perfil'];

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
  if (score <= 1) return { level: 1, label: 'Fraca', color: 'bg-[#ff6b6b]' };
  if (score <= 2) return { level: 2, label: 'Média', color: 'bg-[#f59e0b]' };
  return { level: 3, label: 'Forte', color: 'bg-[#00d4aa]' };
};

const inputClass = "w-full h-11 rounded-lg px-4 text-sm text-[#e8e8f0] placeholder:text-[#6b6b8a] outline-none transition-all";
const inputStyle = { background: '#111118', border: '1px solid #2d2d45' };
const labelClass = "block text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px] mb-1.5";

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

      await new Promise(resolve => setTimeout(resolve, 1500));

      let avatarUrl: string | null = null;
      if (avatar) {
        const fileExt = avatar.name.split('.').pop();
        const filePath = `${userId}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatares')
          .upload(filePath, avatar, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatares').getPublicUrl(filePath);
          avatarUrl = urlData.publicUrl;
        }
      }

      const { error: updateError } = await supabase.from('perfis').update({
        nome_completo: nome.trim(),
        cpf: cpf.replace(/\D/g, '') || null,
        telefone: telefone.replace(/\D/g, '') || null,
        data_nascimento: nascimento || null,
        grupo_prioridade: prioridade,
        url_avatar: avatarUrl || null,
      }).eq('id', userId);

      if (updateError) {
        console.error('Erro ao atualizar perfil:', updateError);
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
    <div className="min-h-screen bg-[#0a0a0f] font-[Inter] flex items-center justify-center p-4 relative">
      {/* Orbs decorativos */}
      <div style={{ position: 'fixed', width: '600px', height: '600px', background: 'rgba(124,106,255,0.08)', borderRadius: '50%', filter: 'blur(120px)', top: '-200px', left: '-100px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: '400px', height: '400px', background: 'rgba(0,212,170,0.06)', borderRadius: '50%', filter: 'blur(100px)', bottom: '-100px', right: '-100px', pointerEvents: 'none', zIndex: 0 }} />

      <div className="w-full max-w-lg space-y-7 animate-fade-in relative z-10">
        {/* Logo + Badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7c6aff] to-[#00d4aa] flex items-center justify-center shadow-[0_0_24px_rgba(124,106,255,0.4)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span
              className="text-2xl font-bold font-[Syne]"
              style={{ background: 'linear-gradient(135deg, #7c6aff, #00d4aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              SmartQueue
            </span>
          </div>
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase"
            style={{ background: 'rgba(124,106,255,0.1)', border: '1px solid rgba(124,106,255,0.2)', color: '#7c6aff' }}
          >
            // nova conta
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#e8e8f0] font-[Syne]">Criar sua conta</h1>
            <p className="text-[#6b6b8a] text-sm mt-1">Preencha os dados abaixo</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-0">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                  style={{
                    background: s < step
                      ? '#00d4aa'
                      : s === step
                      ? 'linear-gradient(135deg, #7c6aff, #00d4aa)'
                      : '#1e1e2e',
                    color: s <= step ? 'white' : '#6b6b8a',
                    boxShadow: s === step ? '0 0 16px rgba(124,106,255,0.4)' : 'none',
                    border: s < step ? '2px solid #00d4aa' : s === step ? 'none' : '1px solid #2d2d45',
                  }}
                >
                  {s < step ? <Check size={16} /> : s}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[1px]" style={{ color: s <= step ? '#7c6aff' : '#6b6b8a' }}>
                  {STEPS[s - 1]}
                </span>
              </div>
              {s < 3 && (
                <div
                  className="w-16 h-0.5 mb-4 transition-all duration-500"
                  style={{ background: s < step ? '#00d4aa' : '#2d2d45' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card do Step */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#13131f', border: '1px solid #2d2d45' }}>
          {/* Step 1 — Dados Pessoais */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-[#7c6aff] uppercase tracking-[2px]">// Dados Pessoais</p>
              <div className="space-y-1.5">
                <label className={labelClass}>Nome completo *</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>E-mail *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>CPF</label>
                  <input
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className={inputClass}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Telefone</label>
                  <input
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className={inputClass}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Data de nascimento</label>
                <input
                  type="date"
                  value={nascimento}
                  onChange={(e) => setNascimento(e.target.value)}
                  className={inputClass}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Acesso */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-[#7c6aff] uppercase tracking-[2px]">// Acesso</p>
              <div className="space-y-1.5">
                <label className={labelClass}>Senha * (mínimo 8 caracteres)</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                />
                {senha && (
                  <div className="space-y-1 mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength.level ? strength.color : 'bg-[#2d2d45]'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-[#6b6b8a]">
                      Força: <span className="text-[#e8e8f0] font-medium">{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Confirmar senha *</label>
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                />
                {confirmarSenha && senha !== confirmarSenha && (
                  <p className="text-xs text-[#ff6b6b] mt-1">As senhas não coincidem</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Perfil */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-[10px] font-bold text-[#7c6aff] uppercase tracking-[2px]">// Perfil</p>

              {/* Avatar com borda gradiente */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative inline-block rounded-full p-[3px]" style={{ background: 'linear-gradient(135deg, #7c6aff, #00d4aa)' }}>
                  <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#111118' }}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={32} className="text-[#6b6b8a]" />
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />
                  <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium text-[#e8e8f0] transition-all hover:border-[#7c6aff] hover:text-[#7c6aff]"
                    style={{ background: 'transparent', border: '1px solid #2d2d45' }}
                  >
                    <Camera size={15} /> Câmera
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium text-[#e8e8f0] transition-all hover:border-[#7c6aff] hover:text-[#7c6aff]"
                    style={{ background: 'transparent', border: '1px solid #2d2d45' }}
                  >
                    <ImageIcon size={15} /> Galeria
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Grupo de prioridade</label>
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                  className="w-full h-11 rounded-lg px-3 text-sm text-[#e8e8f0] outline-none transition-all"
                  style={{ background: '#111118', border: '1px solid #2d2d45', colorScheme: 'dark' }}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={termos}
                    onChange={(e) => setTermos(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center transition-all"
                    style={{
                      background: termos ? 'linear-gradient(135deg, #7c6aff, #00d4aa)' : 'transparent',
                      border: termos ? 'none' : '1px solid #2d2d45',
                      boxShadow: termos ? '0 0 10px rgba(124,106,255,0.3)' : 'none',
                    }}
                    onClick={() => setTermos(!termos)}
                  >
                    {termos && <Check size={13} className="text-white" />}
                  </div>
                </div>
                <span className="text-sm text-[#6b6b8a] leading-relaxed">Li e aceito os <span className="text-[#7c6aff] hover:underline cursor-pointer">Termos de Uso</span></span>
              </label>
            </div>
          )}

          {/* Navegação */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 h-11 rounded-lg text-sm font-medium text-[#e8e8f0] flex items-center justify-center gap-1 transition-all hover:border-[#7c6aff] hover:text-[#7c6aff]"
                style={{ background: 'transparent', border: '1px solid #2d2d45' }}
              >
                <ChevronLeft size={16} /> Voltar
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                disabled={!canNext()}
                onClick={() => setStep(step + 1)}
                className="flex-1 h-11 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1 transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7c6aff, #00d4aa)', boxShadow: '0 0 20px rgba(124,106,255,0.3)' }}
              >
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canNext() || loading}
                onClick={handleSubmit}
                className="flex-1 h-11 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7c6aff, #00d4aa)', boxShadow: '0 0 20px rgba(124,106,255,0.3)' }}
              >
                {loading ? <LoadingSpinner size={20} /> : 'Criar conta'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-[#6b6b8a]">
          Já tem conta?{' '}
          <Link to="/login" className="text-[#7c6aff] font-semibold hover:text-[#9d8fff] transition-colors hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Cadastro;
