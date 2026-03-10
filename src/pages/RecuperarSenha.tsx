import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SmartQueueLogo } from '@/components/SmartQueueLogo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="flex justify-center">
          <SmartQueueLogo size="lg" />
        </div>

        {sent ? (
          <div className="rounded-lg border bg-card p-8 shadow-card text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground">E-mail enviado!</h2>
            <p className="text-sm text-muted-foreground">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-4">
                <ArrowLeft size={16} className="mr-2" /> Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
              <p className="text-sm text-muted-foreground">
                Informe seu e-mail para receber o link de recuperação
              </p>
            </div>

            <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6 shadow-card space-y-5">
              <div className="space-y-2">
                <Label htmlFor="recover-email">E-mail</Label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="recover-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? <LoadingSpinner size={20} /> : 'Enviar link de recuperação'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
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
