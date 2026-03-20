import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface EmAtendimento {
  id: string;
  agendamento_id: string;
  numero_senha: string;
  nome_paciente: string;
  tipo_servico: string;
}

interface ProximoNaFila {
  id: string;
  posicao: number;
  numero_senha: string;
  prioritario: boolean;
}

interface Unidade {
  id: string;
  nome: string;
}

const mensagensRotativas = [
  'Fique atento ao seu número',
  'Tenha seus documentos em mãos',
  'Agradecemos sua paciência',
];

function tocarSom() {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext not available
  }
}

export default function Display() {
  const [searchParams] = useSearchParams();
  const unidadeIdParam = searchParams.get('unidade');

  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [emAtendimento, setEmAtendimento] = useState<EmAtendimento[]>([]);
  const [proximos, setProximos] = useState<ProximoNaFila[]>([]);
  const [totalAguardando, setTotalAguardando] = useState(0);
  const [horario, setHorario] = useState('');
  const [msgIdx, setMsgIdx] = useState(0);

  const prevAtendimentoIds = useRef<Set<string>>(new Set());
  const isFirst = useRef(true);

  // Relógio
  useEffect(() => {
    const tick = () => {
      const agora = new Date();
      const hh = String(agora.getHours()).padStart(2, '0');
      const mm = String(agora.getMinutes()).padStart(2, '0');
      const ss = String(agora.getSeconds()).padStart(2, '0');
      setHorario(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Mensagem rotativa
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % mensagensRotativas.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Buscar nome da unidade
  useEffect(() => {
    if (!unidadeIdParam) return;
    supabase
      .from('unidades')
      .select('id, nome')
      .eq('id', unidadeIdParam)
      .single()
      .then(({ data }) => {
        if (data) setUnidade(data as Unidade);
      });
  }, [unidadeIdParam]);

  // Buscar dados da fila
  const fetchFila = useCallback(async (comSom = false) => {
    if (!unidadeIdParam) return;

    // Em atendimento
    const { data: filaData } = await supabase
      .from('fila')
      .select('id, agendamento_id, agendamento:agendamentos!fila_agendamento_id_fkey(id, numero_senha, status, perfil:perfis!agendamentos_usuario_id_fkey(nome_completo), tipo_atendimento:tipos_atendimento!agendamentos_tipo_atendimento_id_fkey(nome))')
      .eq('unidade_id', unidadeIdParam)
      .is('atendimento_fim', null);

    if (filaData) {
      const raw = filaData as any[];

      const atendendo: EmAtendimento[] = raw
        .filter(f => f.agendamento && f.agendamento.status === 'em_atendimento')
        .map(f => ({
          id: f.id,
          agendamento_id: f.agendamento_id,
          numero_senha: f.agendamento.numero_senha || '—',
          nome_paciente: f.agendamento.perfil?.nome_completo || 'Paciente',
          tipo_servico: f.agendamento.tipo_atendimento?.nome || 'Atendimento',
        }));

      // Detectar novos chamados para tocar som
      if (comSom && !isFirst.current) {
        const novosIds = new Set(atendendo.map(a => a.id));
        const temNovo = atendendo.some(a => !prevAtendimentoIds.current.has(a.id));
        if (temNovo) tocarSom();
        prevAtendimentoIds.current = novosIds;
      } else {
        prevAtendimentoIds.current = new Set(atendendo.map(a => a.id));
        isFirst.current = false;
      }

      setEmAtendimento(atendendo);
    }

    // Próximos na fila (aguardando) — busca separada p/ posicao
    const { data: aguardandoData } = await supabase
      .from('fila')
      .select('id, posicao, agendamento:agendamentos!fila_agendamento_id_fkey(numero_senha, status)')
      .eq('unidade_id', unidadeIdParam)
      .is('atendimento_fim', null)
      .order('posicao', { ascending: true });

    if (aguardandoData) {
      const raw = aguardandoData as any[];
      const aguardando = raw.filter(f => f.agendamento && f.agendamento.status === 'aguardando');

      setTotalAguardando(aguardando.length);
      setProximos(
        aguardando.slice(0, 8).map(f => ({
          id: f.id,
          posicao: f.posicao,
          numero_senha: f.agendamento.numero_senha || '—',
          prioritario: (f.agendamento.numero_senha || '').startsWith('P'),
        }))
      );
    }
  }, [unidadeIdParam]);

  useEffect(() => {
    if (!unidadeIdParam) return;
    fetchFila(false);

    const canal = supabase
      .channel('display-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fila',
        filter: `unidade_id=eq.${unidadeIdParam}`,
      }, () => fetchFila(true))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agendamentos',
        filter: `unidade_id=eq.${unidadeIdParam}`,
      }, () => fetchFila(true))
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [unidadeIdParam, fetchFila]);

  if (!unidadeIdParam) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b6b8a',
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px'
      }}>
        Parâmetro <code style={{ color: '#7c6aff', margin: '0 8px' }}>?unidade=ID</code> não informado.
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(124,106,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,106,255,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Orb roxo */}
      <div style={{
        position: 'fixed', width: '700px', height: '700px',
        background: 'rgba(124,106,255,0.09)', borderRadius: '50%',
        filter: 'blur(140px)', top: '-250px', left: '-150px',
        pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Orb verde */}
      <div style={{
        position: 'fixed', width: '500px', height: '500px',
        background: 'rgba(0,212,170,0.07)', borderRadius: '50%',
        filter: 'blur(120px)', bottom: '-150px', right: '-100px',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* HEADER */}
      <header style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid rgba(124,106,255,0.15)',
        background: 'rgba(17,17,24,0.85)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #7c6aff, #00d4aa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 900, color: '#fff', fontFamily: 'Syne, Inter, sans-serif',
          }}>S</div>
          <span style={{ color: '#e8e8f0', fontWeight: 700, fontSize: '18px', fontFamily: 'Syne, Inter, sans-serif' }}>
            SmartQueue
          </span>
        </div>

        {/* Nome da unidade */}
        <div style={{ textAlign: 'center', flex: 1, padding: '0 24px' }}>
          <div style={{
            fontSize: 'clamp(16px, 2.5vw, 28px)',
            fontWeight: 800,
            color: '#e8e8f0',
            fontFamily: 'Syne, Inter, sans-serif',
            letterSpacing: '0.5px',
          }}>
            {unidade?.nome || '...'}
          </div>
        </div>

        {/* Relógio */}
        <div style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(22px, 2.8vw, 36px)',
          fontWeight: 700,
          color: '#00d4aa',
          letterSpacing: '3px',
          flexShrink: 0,
        }}>
          {horario}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '24px 32px 16px',
        gap: '24px', position: 'relative', zIndex: 10,
        overflow: 'hidden',
        minHeight: 0,
      }}>

        {/* EM ATENDIMENTO */}
        <section style={{ flex: '0 0 auto' }}>
          <div style={{
            fontSize: '11px', fontWeight: 800, letterSpacing: '3px',
            color: '#6b6b8a', textTransform: 'uppercase', marginBottom: '14px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#00d4aa',
              boxShadow: '0 0 8px #00d4aa',
              animation: 'pulse-dot 2s infinite',
            }} />
            Em Atendimento
          </div>

          {emAtendimento.length === 0 ? (
            <div style={{
              textAlign: 'center', color: '#6b6b8a',
              fontSize: '18px', padding: '40px 0',
              letterSpacing: '0.5px',
            }}>
              Aguardando chamada...
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(emAtendimento.length, 4)}, 1fr)`,
              gap: '16px',
            }}>
              {emAtendimento.slice(0, 4).map(item => (
                <AtendimentoCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* PRÓXIMOS NA FILA */}
        <section style={{ flex: '1 1 auto', minHeight: 0 }}>
          <div style={{
            fontSize: '11px', fontWeight: 800, letterSpacing: '3px',
            color: '#6b6b8a', textTransform: 'uppercase', marginBottom: '14px',
          }}>
            Próximos na Fila
          </div>

          {proximos.length === 0 ? (
            <div style={{
              color: '#6b6b8a', fontSize: '16px',
              padding: '20px 0', letterSpacing: '0.5px',
            }}>
              Nenhuma senha aguardando
            </div>
          ) : (
            <div style={{
              display: 'flex', flexWrap: 'wrap',
              gap: '12px', alignContent: 'flex-start',
            }}>
              {proximos.map(item => (
                <ProximoBadge key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* RODAPÉ */}
      <footer style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 32px',
        borderTop: '1px solid rgba(124,106,255,0.12)',
        background: 'rgba(17,17,24,0.7)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}>
        <span style={{ color: '#6b6b8a', fontSize: '14px' }}>
          <strong style={{ color: '#e8e8f0' }}>{totalAguardando}</strong>{' '}
          {totalAguardando === 1 ? 'pessoa aguardando' : 'pessoas aguardando'}
        </span>
        <span style={{
          color: '#6b6b8a', fontSize: '14px',
          fontStyle: 'italic',
          transition: 'opacity 0.5s',
        }}>
          {mensagensRotativas[msgIdx]}
        </span>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 20px rgba(124,106,255,0.3); }
          50% { box-shadow: 0 0 35px rgba(124,106,255,0.6); }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AtendimentoCard({ item }: { item: EmAtendimento }) {
  return (
    <div style={{
      background: '#13131f',
      border: '2px solid #7c6aff',
      borderRadius: '16px',
      padding: '24px 20px',
      textAlign: 'center',
      animation: 'pulse-border 3s ease-in-out infinite, fade-in 0.4s ease-out',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      minWidth: 0,
    }}>
      {/* Número da senha */}
      <div style={{
        fontSize: 'clamp(48px, 7vw, 80px)',
        fontWeight: 800,
        fontFamily: 'Syne, Inter, sans-serif',
        lineHeight: 1,
        background: 'linear-gradient(135deg, #7c6aff, #00d4aa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        {item.numero_senha}
      </div>
      {/* Nome do paciente */}
      <div style={{
        color: '#e8e8f0',
        fontSize: 'clamp(14px, 1.5vw, 18px)',
        fontWeight: 600,
        marginTop: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {item.nome_paciente}
      </div>
      {/* Tipo de serviço */}
      <div style={{
        color: '#6b6b8a',
        fontSize: 'clamp(12px, 1.2vw, 14px)',
      }}>
        {item.tipo_servico}
      </div>
    </div>
  );
}

function ProximoBadge({ item }: { item: ProximoNaFila }) {
  const prioritario = item.prioritario;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 20px',
      borderRadius: '12px',
      border: `1.5px solid ${prioritario ? '#ff6b6b' : '#7c6aff'}`,
      background: prioritario ? 'rgba(255,107,107,0.15)' : 'rgba(124,106,255,0.15)',
      color: prioritario ? '#ff6b6b' : '#7c6aff',
      fontSize: 'clamp(18px, 2vw, 24px)',
      fontWeight: 700,
      fontFamily: 'Syne, Inter, sans-serif',
      letterSpacing: '1px',
      animation: 'fade-in 0.3s ease-out',
    }}>
      {prioritario && <span style={{ fontSize: '18px' }}>⭐</span>}
      {item.numero_senha}
    </div>
  );
}
