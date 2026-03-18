import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SmartQueueLogo } from '@/components/SmartQueueLogo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Zap, Smartphone, Bell, Users } from 'lucide-react';

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
      // Get the user's profile to check their role
      const { data: profileData } = await supabase
        .from('perfis')
        .select('perfil')
        .eq('id', authData.user.id)
        .single();

      if (profileData?.perfil === 'administrador') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[40%] gradient-primary flex-col items-center justify-center p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full border-2 border-current" />
          <div className="absolute bottom-32 right-16 w-24 h-24 rounded-full border-2 border-current" />
          <div className="absolute top-1/2 left-1/3 w-16 h-16 rounded-full border-2 border-current" />
        </div>

        <div className="relative z-10 text-center space-y-8">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-xl bg-primary-foreground/20 p-3">
              <Users size={40} className="text-primary-foreground" />
            </div>
            <span className="text-4xl font-bold">SmartQueue</span>
          </div>

          <p className="text-xl font-light opacity-90 max-w-xs mx-auto">
            Chega de filas. Seja inteligente.
          </p>

          {/* Illustration */}
          <div className="flex justify-center gap-3 py-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-medium"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {i}
              </div>
            ))}
          </div>

          <div className="flex gap-8 justify-center text-sm">
            <div className="flex flex-col items-center gap-2">
              <Zap size={24} />
              <span>Rápido</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Smartphone size={24} />
              <span>Mobile</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Bell size={24} />
              <span>Notificações</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden flex justify-center mb-4">
            <SmartQueueLogo size="lg" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Bem-vindo de volta</h1>
            <p className="text-muted-foreground">Entre na sua conta</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/recuperar-senha"
                className="text-sm text-primary hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? <LoadingSpinner size={20} /> : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-primary font-semibold hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
