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
  agendado: { label: 'Agendado', className: 'border border-[#7c6aff] text-[#7c6aff] bg-transparent' },
  aguardando: { label: 'Aguardando', className: 'border border-[#f59e0b] text-[#f59e0b] bg-transparent' },
  em_atendimento: { label: 'Em atendimento', className: 'border border-[#00d4aa] text-[#00d4aa] bg-transparent animate-pulse shadow-[0_0_10px_rgba(0,212,170,0.5)]' },
  concluido: { label: 'Concluído', className: 'border border-[#00d4aa] text-[#00d4aa] bg-transparent' },
  cancelado: { label: 'Cancelado', className: 'border border-[#ff6b6b] text-[#ff6b6b] bg-transparent' },
  nao_compareceu: { label: 'Não compareceu', className: 'border border-[#6b6b8a] text-[#6b6b8a] bg-transparent' },
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
    <Card className="bg-[#13131f] border-[#2d2d45] font-[Inter]">
      <CardHeader className="pb-3 border-b border-[#1e1e2e]">
        <CardTitle className="flex items-center gap-2 text-lg text-[#e8e8f0] font-[Syne]">
          <ClipboardList size={18} className="text-[#7c6aff]" />
          Últimos agendamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const status = statusConfig[item.status] || statusConfig.agendado;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[#1e1e2e] p-3 hover:bg-[#1e1e2e] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#7c6aff] text-sm">
                    {item.numero_senha || '---'}
                  </span>
                  <span className="truncate text-sm text-[#e8e8f0]">
                    {item.tipos_atendimento?.nome || 'Atendimento'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#6b6b8a]">
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
