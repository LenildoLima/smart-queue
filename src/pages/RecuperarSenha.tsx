import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

const RecuperarSenha = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] font-[Inter] flex items-center justify-center p-4 relative">
      {/* Orbs decorativos */}
      <div style={{ position: 'fixed', width: '600px', height: '600px', background: 'rgba(124,106,255,0.08)', borderRadius: '50%', filter: 'blur(120px)', top: '-200px', left: '-100px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: '400px', height: '400px', background: 'rgba(0,212,170,0.06)', borderRadius: '50%', filter: 'blur(100px)', bottom: '-100px', right: '-100px', pointerEvents: 'none', zIndex: 0 }} />

      <div className="w-full max-w-md space-y-7 animate-fade-in relative z-10">
        {/* Logo */}
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
            // recuperação
          </div>
        </div>

        {/* Estado de sucesso */}
        {sent ? (
          <div className="rounded-2xl p-8 text-center space-y-5" style={{ background: '#13131f', border: '1px solid #2d2d45' }}>
            <div
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)' }}
            >
              <CheckCircle2 size={32} className="text-[#00d4aa]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#e8e8f0] font-[Syne]">E-mail enviado!</h2>
              <p className="text-sm text-[#6b6b8a] leading-relaxed">
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </p>
            </div>
            <Link to="/login">
              <button
                className="mt-2 flex items-center gap-2 mx-auto h-10 px-6 rounded-lg text-sm font-medium text-[#7c6aff] transition-all hover:text-[#9d8fff]"
                style={{ background: 'rgba(124,106,255,0.1)', border: '1px solid rgba(124,106,255,0.2)' }}
              >
                <ArrowLeft size={16} /> Voltar ao login
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* Título */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-[#e8e8f0] font-[Syne]">Recuperar senha</h1>
              <p className="text-sm text-[#6b6b8a]">
                Informe seu e-mail para receber o link de recuperação
              </p>
            </div>

            {/* Card formulário */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl p-6 space-y-5"
              style={{ background: '#13131f', border: '1px solid #2d2d45' }}
            >
              <div className="space-y-1.5">
                <label htmlFor="recover-email" className="block text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b8a]" />
                  <input
                    id="recover-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-12 rounded-lg pl-10 pr-4 text-sm text-[#e8e8f0] placeholder:text-[#6b6b8a] outline-none transition-all"
                    style={{ background: '#111118', border: '1px solid #2d2d45' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#7c6aff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#2d2d45')}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #7c6aff, #00d4aa)', boxShadow: '0 0 20px rgba(124,106,255,0.3)' }}
              >
                {loading ? <LoadingSpinner size={20} /> : 'Enviar link de recuperação'}
              </button>
            </form>

            <p className="text-center text-sm text-[#6b6b8a]">
              <Link
                to="/login"
                className="text-[#7c6aff] font-semibold hover:text-[#9d8fff] transition-colors hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Voltar ao login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default RecuperarSenha;
