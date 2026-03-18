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
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-56 flex-col justify-between border-r bg-card p-4">
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
                    'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                    isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted/30'
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
            className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* bottom nav for mobile */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-card md:hidden">
        <div className="flex items-center justify-around h-16">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
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