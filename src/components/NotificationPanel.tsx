import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Notificacao = Tables<'notificacoes'>;

export const NotificationPanel = () => {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notificacoes.filter((n) => n.status !== 'lida').length;

  const fetchNotificacoes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(20);
    if (data) setNotificacoes(data);
  };

  useEffect(() => {
    fetchNotificacoes();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${user.id}`,
        },
        () => fetchNotificacoes()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase
      .from('notificacoes')
      .update({ status: 'lida' as const, lida_em: new Date().toISOString() })
      .eq('id', id);
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'lida' as const, lida_em: new Date().toISOString() } : n))
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notificações">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-6rem)]">
          {notificacoes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma notificação</p>
          ) : (
            <div className="space-y-2 pr-2">
              {notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => n.status !== 'lida' && markAsRead(n.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    n.status !== 'lida'
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border bg-card opacity-70'
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.criado_em), { addSuffix: true, locale: ptBR })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
