import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarPlus, ListOrdered, User, LogOut, Shield, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { UserAvatar } from './UserAvatar';
import { SmartQueueLogo } from './SmartQueueLogo';

const baseItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agendar', label: 'Agendar', icon: CalendarPlus },
  { to: '/fila', label: 'Fila', icon: ListOrdered },
  { to: '/perfil', label: 'Perfil', icon: User },
];

export const Navigation = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<{ nome_completo: string; url_avatar?: string | null; perfil?: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('perfis')
        .select('nome_completo, url_avatar, perfil')
        .eq('id', user.id)
        .single();
      if (!error && data) setPerfil(data);
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // build the navigation items based on profile
  const items = perfil?.perfil === 'administrador' || perfil?.perfil === 'super_administrador'
    ? [
        { to: '/admin', label: 'Admin', icon: Shield },
        { to: '/relatorios', label: 'Relatórios', icon: BarChart2 },
        { to: '/perfil', label: 'Perfil', icon: User }
      ]
    : baseItems;

  return (
    <>
      {/* sidebar for desktop */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-56 flex-col justify-between border-r border-[#1e1e2e] bg-[#111118] p-4 text-[#e8e8f0]">
        <div>
          <NavLink to="/dashboard" className="flex items-center mb-8">
            <SmartQueueLogo size="sm" />
          </NavLink>
          <nav className="space-y-2">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-[Inter]',
                    isActive ? 'text-[#e8e8f0] bg-[#7c6aff]/15 border-l-2 border-[#7c6aff]' : 'text-[#6b6b8a] hover:bg-[#1e1e2e] hover:text-[#7c6aff]'
                  )
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center gap-3">
            <UserAvatar src={perfil?.url_avatar} name={perfil?.nome_completo || ''} size={32} />
            <span className="text-sm font-medium">{perfil?.nome_completo || 'Usuário'}</span>
          </div>
          <button
            className="mt-3 flex items-center gap-2 text-sm text-[#6b6b8a] hover:text-[#ff6b6b] font-[Inter]"
            onClick={handleLogout}
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* bottom nav for mobile */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-[#1e1e2e] bg-[#111118] md:hidden">
        <div className="flex items-center justify-around h-16">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 text-xs font-medium transition-colors font-[Inter]',
                  isActive ? 'text-[#7c6aff]' : 'text-[#6b6b8a] hover:text-[#e8e8f0]'
                )
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};