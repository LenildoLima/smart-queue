import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserAvatar } from './UserAvatar';
import { SmartQueueLogo } from './SmartQueueLogo';
import { LogOut, Menu, X, Shield, BarChart2, User, ChevronRight } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: ReactNode;
}

interface UnidadeInfo {
  nome: string;
  endereco: string | null;
  cidade: string | null;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [perfil, setPerfil] = useState<{ nome_completo: string; url_avatar?: string | null } | null>(null);
  const [unidade, setUnidade] = useState<UnidadeInfo | null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      if (!user) return;
      
      const { data: profileData } = await supabase
        .from('perfis')
        .select('nome_completo, url_avatar')
        .eq('id', user.id)
        .single();
      if (profileData) setPerfil(profileData);

      const { data: adminUnidade } = await supabase
        .from('administradores_unidades')
        .select('unidade_id')
        .eq('usuario_id', user.id)
        .limit(1)
        .maybeSingle();

      if (adminUnidade) {
        const { data: unitData } = await supabase
          .from('unidades')
          .select('nome, endereco, cidade')
          .eq('id', adminUnidade.unidade_id)
          .single();
        if (unitData) setUnidade(unitData);
      }
    };
    fetchAdminData();
  }, [user]);

  const getPageBadge = () => {
    if (location.pathname === '/admin') return '// painel admin';
    if (location.pathname === '/relatorios') return '// relatórios e estatísticas';
    if (location.pathname === '/perfil') return '// perfil do administrador';
    if (location.pathname === '/unidades') return '// gestão de unidades';
    return '// plataforma de atendimento';
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin', label: 'Admin', icon: Shield },
    { to: '/relatorios', label: 'Relatórios', icon: BarChart2 },
    { to: '/perfil', label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0a0a0f] text-[#e8e8f0] font-[Inter] relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(124,106,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,106,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] bg-[rgba(124,106,255,0.08)] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-[-100px] w-[400px] h-[400px] bg-[rgba(0,212,170,0.06)] rounded-full blur-[120px]" />
      </div>

      {/* Header fixo - largura total */}
      <header className="fixed top-0 left-0 right-0 w-full z-50">

        {/* Barra superior */}
        <div className="h-20 w-full bg-[#111118] border-b border-[#2d2d45] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="w-full h-full flex items-center justify-between px-6 md:px-10">

            {/* ESQUERDA: Logo */}
            <div className="flex flex-col">
              <NavLink to="/admin" className="flex items-center hover:opacity-90 transition-opacity">
                <SmartQueueLogo size="sm" />
              </NavLink>
              <span className="text-[10px] text-[#6b6b8a] uppercase tracking-[1.5px] font-bold mt-1 ml-1 hidden sm:block">
                Fila Inteligente
              </span>
            </div>

            {/* CENTRO: Endereço da unidade */}
            <div className="hidden lg:flex flex-col items-center text-center">
              <p className="text-[14px] font-medium text-[#a0a0b8]">
                {unidade
                  ? `${unidade.endereco} — ${unidade.cidade}`
                  : 'Localização não definida'}
              </p>
            </div>

            {/* DIREITA: Nav + Perfil */}
            <div className="hidden md:flex items-center gap-4">
              <nav className="flex items-center gap-1 text-sm font-medium mr-4 border-r border-[#2d2d45] pr-4">
                {navItems.map((item, idx) => (
                  <div key={item.to} className="flex items-center">
                    {idx > 0 && <span className="text-[#2d2d45] mx-2">|</span>}
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "transition-colors hover:text-[#7c6aff] px-2",
                          isActive ? "text-[#7c6aff]" : "text-[#6b6b8a]"
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </div>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                <NotificationPanel />
                <div className="flex items-center gap-3 pl-4 border-l border-[#2d2d45]">
                  <div className="text-right flex flex-col items-end">
                    <p className="text-xs font-bold text-[#e8e8f0] leading-tight">
                      {perfil?.nome_completo || 'Administrador'}
                    </p>
                    <button
                      onClick={handleLogout}
                      className="text-[10px] text-[#6b6b8a] hover:text-[#ff6b6b] transition-colors flex items-center gap-1 mt-0.5"
                    >
                      Sair <LogOut size={10} />
                    </button>
                  </div>
                  <NavLink to="/perfil" className="ring-2 ring-[#7c6aff]/20 rounded-full p-0.5 hover:ring-[#7c6aff]/40 transition-all">
                    <UserAvatar src={perfil?.url_avatar} name={perfil?.nome_completo || ''} size={32} />
                  </NavLink>
                </div>
              </div>
            </div>

            {/* Mobile: hamburguer */}
            <div className="flex items-center gap-3 md:hidden">
              <NavLink to="/perfil">
                <UserAvatar src={perfil?.url_avatar} name={perfil?.nome_completo || ''} size={32} />
              </NavLink>
              <button
                className="text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors p-2"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X size={26} /> : <Menu size={26} />}
              </button>
            </div>
          </div>
        </div>

        {/* Barra inferior - badge da página */}
        <div className="w-full bg-[#0a0a0f]/80 backdrop-blur-sm border-b border-[#2d2d45] h-10">
          <div className="w-full h-full flex items-center px-6 md:px-10">
            <span className="text-[10px] font-black uppercase tracking-[2px] text-[#7c6aff]/80 flex items-center gap-2">
              <ChevronRight size={10} className="text-[#6b6b8a]" />
              {getPageBadge()}
            </span>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 right-0 w-full bg-[#111118]/95 backdrop-blur-xl border-b border-[#2d2d45] py-6 px-4 flex flex-col gap-3 z-40">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "bg-gradient-to-r from-[#7c6aff]/20 to-[#00d4aa]/10 text-[#7c6aff] border border-[#7c6aff]/20"
                      : "text-[#6b6b8a] hover:bg-[#1e1e2e]"
                  )
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
            <div className="mt-4 pt-6 border-t border-[#2d2d45]">
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start h-12 px-4 text-[#ff6b6b] hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b] rounded-xl"
              >
                <LogOut size={18} className="mr-3" />
                Sair da Conta
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Conteúdo — ocupa 100% da largura */}
      <main className="relative z-10 w-full pt-[120px] pb-12 px-6 md:px-10">
        {children}
      </main>
    </div>
  );
};
