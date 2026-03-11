import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { SmartQueueLogo } from '@/components/SmartQueueLogo';
import { UserAvatar } from '@/components/UserAvatar';
import { NotificationPanel } from '@/components/NotificationPanel';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardHeaderProps {
  nomeCompleto: string;
  avatarUrl?: string | null;
}

export const DashboardHeader = ({ nomeCompleto, avatarUrl }: DashboardHeaderProps) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <SmartQueueLogo size="sm" />
        <div className="flex items-center gap-2">
          <NotificationPanel />
          <span className="hidden sm:block text-sm font-medium text-foreground">{nomeCompleto}</span>
          <UserAvatar src={avatarUrl} name={nomeCompleto} size={36} />
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
};
