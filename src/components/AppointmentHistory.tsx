import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Agendamento = Tables<'agendamentos'>;

interface AgendamentoComTipo extends Agendamento {
  tipos_atendimento: { nome: string } | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  agendado: { label: 'Agendado', className: 'bg-primary text-primary-foreground' },
  aguardando: { label: 'Aguardando', className: 'bg-warning text-warning-foreground' },
  em_atendimento: { label: 'Em atendimento', className: 'bg-warning text-warning-foreground' },
  concluido: { label: 'Concluído', className: 'bg-success text-success-foreground' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive text-destructive-foreground' },
  nao_compareceu: { label: 'Não compareceu', className: 'bg-muted text-muted-foreground' },
};

export const AppointmentHistory = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<AgendamentoComTipo[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('*, tipos_atendimento(nome)')
        .eq('usuario_id', user.id)
        .order('data_agendamento', { ascending: false })
        .limit(5);
      if (data) setItems(data as AgendamentoComTipo[]);
    };
    fetch();
  }, [user]);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList size={18} className="text-primary" />
          Últimos agendamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const status = statusConfig[item.status] || statusConfig.agendado;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary text-sm">
                    {item.numero_senha || '---'}
                  </span>
                  <span className="truncate text-sm text-foreground">
                    {item.tipos_atendimento?.nome || 'Atendimento'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(item.data_agendamento + 'T00:00:00'), 'dd/MM/yyyy')} às{' '}
                  {item.hora_agendamento.slice(0, 5)}
                </p>
              </div>
              <Badge className={status.className}>{status.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
