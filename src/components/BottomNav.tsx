import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarPlus, ListOrdered, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agendar', label: 'Agendar', icon: CalendarPlus },
  { to: '/fila', label: 'Fila', icon: ListOrdered },
  { to: '/perfil', label: 'Perfil', icon: User },
];

export const BottomNav = () => (
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
);
