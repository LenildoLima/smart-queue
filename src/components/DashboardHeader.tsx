import { useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { NotificationPanel } from '@/components/NotificationPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardHeaderProps {
  isAdmin?: boolean;
}

export const DashboardHeader = ({ isAdmin }: DashboardHeaderProps) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
              <Shield size={12} className="mr-1" />
              Painel Admin
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NotificationPanel />
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
};
