import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AppLayout } from '@/components/AppLayout';
import { AdminLayout } from '@/components/AdminLayout';
import { UserAvatar } from '@/components/UserAvatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Camera, ImageIcon, Save, Lock } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Perfil = Tables<'perfis'>;

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
  if (score <= 1) return { level: 1, label: 'Fraca', color: 'bg-[#ff6b6b]' };
  if (score <= 2) return { level: 2, label: 'Média', color: 'bg-[#f59e0b]' };
  return { level: 3, label: 'Forte', color: 'bg-[#00d4aa]' };
};

const Perfil = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile data
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [grupoPrioridade, setGrupoPrioridade] = useState('normal');

  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password change
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const { data: perfilData, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        toast({ title: 'Erro ao carregar perfil', description: error.message, variant: 'destructive' });
        return;
      }

      setPerfil(perfilData);
      setNomeCompleto(perfilData.nome_completo || '');
      setEmail(user.email || '');
      setCpf(perfilData.cpf || '');
      setTelefone(perfilData.telefone || '');
      setDataNascimento(perfilData.data_nascimento || '');
      setGrupoPrioridade(perfilData.grupo_prioridade || 'normal');

      setLoading(false);
    };

    loadProfile();
  }, [user, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    try {
      let avatarUrl = perfil?.url_avatar;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatares')
          .upload(filePath, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatares')
            .getPublicUrl(filePath);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Update profile
      const { error: updateError } = await supabase.from('perfis').update({
        nome_completo: nomeCompleto,
        cpf: cpf.replace(/\D/g, ''),
        telefone: telefone.replace(/\D/g, ''),
        data_nascimento: dataNascimento,
        grupo_prioridade: grupoPrioridade as any,
        url_avatar: avatarUrl,
      }).eq('id', user.id);

      if (updateError) throw updateError;

      toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas com sucesso.' });

      // Refresh profile data
      const { data: updatedPerfil } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', user.id)
        .single();
      if (updatedPerfil) setPerfil(updatedPerfil);

      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (novaSenha !== confirmarSenha) {
      toast({ title: 'Erro', description: 'As senhas não coincidem.', variant: 'destructive' });
      return;
    }

    if (novaSenha.length < 8) {
      toast({ title: 'Erro', description: 'A nova senha deve ter pelo menos 8 caracteres.', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) throw error;

      toast({ title: 'Senha alterada', description: 'Sua senha foi atualizada com sucesso.' });

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const strength = passwordStrength(novaSenha);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <LoadingSpinner />
      </div>
    );
  }

  const isAdminProfile = perfil?.perfil === 'administrador' || perfil?.perfil === 'super_administrador';

  const content = (
    <main className="container max-w-2xl py-6 space-y-6 animate-fade-in pl-4 pr-4 md:pl-0 md:pr-0">
        {/* Avatar Section */}
        <Card className="bg-[#13131f] border-[#2d2d45]">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative mb-4 group cursor-pointer inline-block rounded-full bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] p-1">
                <div className="w-32 h-32 rounded-full bg-[#111118] flex items-center justify-center overflow-hidden border-4 border-[#13131f]">
                  {avatarPreview || perfil?.url_avatar ? (
                    <img src={avatarPreview || perfil?.url_avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserAvatar src={null} name={nomeCompleto} size={120} />
                  )}
                </div>
                <p className="text-xs text-[#6b6b8a]">Força: <span className="text-[#e8e8f0] font-medium">{strength.label}</span></p>
              </div>
              <div className="flex gap-3">
                <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()} className="bg-transparent border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff]">
                  <Camera size={16} className="mr-1" /> Tirar foto
                </Button>
                <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()} className="bg-transparent border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff]">
                  <ImageIcon size={16} className="mr-1" /> Alterar foto
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Data */}
        <Card className="bg-[#13131f] border-[#2d2d45]">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#e8e8f0] font-[Syne]">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Nome completo *</Label>
              <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Seu nome completo" className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff] placeholder:text-[#6b6b8a]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">E-mail</Label>
              <Input value={email} readOnly className="bg-[#111118]/50 border-[#2d2d45] cursor-not-allowed text-[#6b6b8a]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">CPF</Label>
                <Input value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff] placeholder:text-[#6b6b8a]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff] placeholder:text-[#6b6b8a]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Data de nascimento</Label>
              <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Grupo de prioridade</Label>
              <select
                value={grupoPrioridade}
                onChange={(e) => setGrupoPrioridade(e.target.value)}
                className="w-full h-11 rounded-md border border-[#2d2d45] bg-[#111118] px-3 text-sm text-[#e8e8f0] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7c6aff]"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white border-0 hover:opacity-90">
              <Save size={16} className="mr-1" />
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card className="bg-[#13131f] border-[#2d2d45]">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#e8e8f0] font-[Syne]">Alterar Senha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Senha atual</Label>
              <Input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} placeholder="••••••••" className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff] placeholder:text-[#6b6b8a]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Nova senha *</Label>
              <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="••••••••" className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff] placeholder:text-[#6b6b8a]" />
              {novaSenha && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-[#1e1e2e]'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-[#6b6b8a]">Força: <span className="text-[#e8e8f0] font-medium">{strength.label}</span></p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-[1.5px]">Confirmar nova senha *</Label>
              <Input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="••••••••" className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff] placeholder:text-[#6b6b8a]" />
              {confirmarSenha && novaSenha !== confirmarSenha && (
                <p className="text-xs text-[#ff6b6b]">As senhas não coincidem</p>
              )}
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword} variant="outline" className="w-full bg-transparent border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff]">
              <Lock size={16} className="mr-1" />
              {changingPassword ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </CardContent>
        </Card>
    </main>
  );

  if (isAdminProfile) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return (
    <AppLayout>
      <DashboardHeader isAdmin={false} />
      {content}
    </AppLayout>
  );

  if (isAdmin) {
    return <AdminLayout>{ProfileContent}</AdminLayout>;
  }

  return (
    <AppLayout>
      <div className="animate-fade-in font-[Inter]">
        <DashboardHeader isAdmin={false} />
        {ProfileContent}
      </div>
    </AppLayout>
  );
};

export default Perfil;