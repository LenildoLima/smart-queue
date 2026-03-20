import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Zap, Smartphone, Bell } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
    } else if (authData.user) {
      const { data: profileData } = await supabase
        .from('perfis')
        .select('perfil')
        .eq('id', authData.user.id)
        .single();

      if (profileData?.perfil === 'administrador' || profileData?.perfil === 'super_administrador') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] font-[Inter]">
      {/* Orbs decorativos globais */}
      <div style={{ position: 'fixed', width: '600px', height: '600px', background: 'rgba(124,106,255,0.08)', borderRadius: '50%', filter: 'blur(120px)', top: '-200px', left: '-100px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: '400px', height: '400px', background: 'rgba(0,212,170,0.06)', borderRadius: '50%', filter: 'blur(100px)', bottom: '-100px', right: '-100px', pointerEvents: 'none', zIndex: 0 }} />

      {/* ===== COLUNA ESQUERDA (desktop) ===== */}
      <div className="hidden lg:flex lg:w-[40%] flex-col items-center justify-center p-12 bg-[#111118] relative overflow-hidden border-r border-[#1e1e2e]">
        {/* Grid sutil */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,106,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,106,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        {/* Orb decorativo esquerda */}
        <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'rgba(124,106,255,0.12)', borderRadius: '50%', filter: 'blur(80px)', top: '-80px', left: '-80px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '200px', height: '200px', background: 'rgba(0,212,170,0.08)', borderRadius: '50%', filter: 'blur(60px)', bottom: '-60px', right: '-60px', pointerEvents: 'none' }} />

        <div className="relative z-10 text-center space-y-10 max-w-xs">
          {/* Logo */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7c6aff] to-[#00d4aa] flex items-center justify-center shadow-[0_0_24px_rgba(124,106,255,0.5)]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span
                className="text-3xl font-bold font-[Syne]"
                style={{ background: 'linear-gradient(135deg, #7c6aff, #00d4aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                SmartQueue
              </span>
            </div>
            <p className="text-[#6b6b8a] text-sm leading-relaxed">
              Chega de filas.<br />
              <span className="text-[#e8e8f0] font-semibold">Seja inteligente.</span>
            </p>
          </div>

          {/* Benefícios */}
          <div className="space-y-4">
            {[
              { icon: Zap, label: 'Rápido', desc: 'Atendimento ágil e eficiente', color: '#7c6aff', bg: 'rgba(124,106,255,0.1)' },
              { icon: Smartphone, label: 'Mobile', desc: 'Acesse de qualquer dispositivo', color: '#00d4aa', bg: 'rgba(0,212,170,0.1)' },
              { icon: Bell, label: 'Notificações', desc: 'Seja avisado na sua vez', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
            ].map(({ icon: Icon, label, desc, color, bg }) => (
              <div key={label} className="flex items-center gap-4 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-[#e8e8f0]">{label}</p>
                  <p className="text-xs text-[#6b6b8a]">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Círculos decorativos */}
          <div className="flex justify-center gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: i === 1 ? 'linear-gradient(135deg, #7c6aff, #00d4aa)' : 'rgba(124,106,255,0.12)',
                  color: i === 1 ? 'white' : '#7c6aff',
                  border: i === 1 ? 'none' : '1px solid rgba(124,106,255,0.2)',
                  boxShadow: i === 1 ? '0 0 16px rgba(124,106,255,0.4)' : 'none',
                }}
              >
                {i}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== COLUNA DIREITA ===== */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md space-y-8 animate-fade-in">

          {/* Header mobile */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c6aff] to-[#00d4aa] flex items-center justify-center shadow-[0_0_20px_rgba(124,106,255,0.4)]">
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
            <p className="text-xs text-[#6b6b8a]">Chega de filas. Seja inteligente.</p>
          </div>

          {/* Badge + título */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase" style={{ background: 'rgba(124,106,255,0.1)', border: '1px solid rgba(124,106,255,0.2)', color: '#7c6aff' }}>
              // acesso ao sistema
            </div>
            <h1 className="text-3xl font-bold text-[#e8e8f0] font-[Syne]">Bem-vindo de volta</h1>
            <p className="text-[#6b6b8a]">Entre na sua conta para continuar</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 rounded-lg px-4 text-sm text-[#e8e8f0] placeholder:text-[#6b6b8a] outline-none transition-all"
                style={{ background: '#111118', border: '1px solid #2d2d45' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Senha</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-12 rounded-lg px-4 pr-12 text-sm text-[#e8e8f0] placeholder:text-[#6b6b8a] outline-none transition-all"
                  style={{ background: '#111118', border: '1px solid #2d2d45' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/recuperar-senha" className="text-sm text-[#7c6aff] hover:text-[#9d8fff] transition-colors hover:underline">
                Esqueci minha senha
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c6aff, #00d4aa)', boxShadow: '0 0 20px rgba(124,106,255,0.3)' }}
            >
              {loading ? <LoadingSpinner size={20} /> : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-[#6b6b8a]">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-[#7c6aff] font-semibold hover:text-[#9d8fff] transition-colors hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
