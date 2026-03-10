import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SmartQueueLogo } from '@/components/SmartQueueLogo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha atualizada com sucesso!' });
      navigate('/login');
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <SmartQueueLogo size="lg" />
          <p className="text-muted-foreground">Link inválido ou expirado.</p>
          <Button onClick={() => navigate('/login')}>Voltar ao login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="flex justify-center"><SmartQueueLogo size="lg" /></div>
        <h1 className="text-2xl font-bold text-foreground text-center">Redefinir senha</h1>
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6 shadow-card space-y-5">
          <div className="space-y-2">
            <Label>Nova senha (mín. 8 caracteres)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12" />
            {confirm && password !== confirm && <p className="text-xs text-destructive">As senhas não coincidem</p>}
          </div>
          <Button type="submit" className="w-full h-12" disabled={loading || password.length < 8 || password !== confirm}>
            {loading ? <LoadingSpinner size={20} /> : 'Salvar nova senha'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
