import { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Menu, X, MonitorPlay } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';

interface UnidadeInfo {
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
}

interface PerfilInfo {
  nome_completo: string;
  url_avatar: string | null;
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [unidade, setUnidade] = useState<UnidadeInfo | null>(null);
  const [perfil, setPerfil] = useState<PerfilInfo | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadHeaderData = async () => {
      if (!user) return;

      // 1. Load Perfil
      const { data: perfilData } = await supabase
        .from('perfis')
        .select('nome_completo, url_avatar')
        .eq('id', user.id)
        .single();

      if (perfilData) {
        setPerfil(perfilData as PerfilInfo);
      }

      // 2. Load Unidade via administradores_unidades
      const { data: adminVinculo } = await supabase
        .from('administradores_unidades')
        .select('unidade_id')
        .eq('usuario_id', user.id)
        .single();

      if (adminVinculo) {
        const { data: unidadeData } = await supabase
          .from('unidades')
          .select('nome, endereco, cidade, estado')
          .eq('id', adminVinculo.unidade_id)
          .single();

        if (unidadeData) {
          setUnidade(unidadeData as UnidadeInfo);
        }
      }
    };

    loadHeaderData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navLinks = [
    { label: 'Admin', path: '/admin' },
    { label: 'Unidades', path: '/unidades' },
    { label: 'Relatórios', path: '/relatorios' },
    { label: 'Perfil', path: '/perfil' }
  ];

  return (
    <div className="min-h-screen bg-transparent flex flex-col font-[Inter] text-[#e8e8f0]">
      <header className="fixed top-0 left-0 w-full z-50 flex flex-col">
        {/* BARRA SUPERIOR (identidade) */}
        <div
          className="w-full flex items-center justify-between px-8 bg-[#111118] border-b border-[#1e1e2e]"
          style={{ height: '64px' }}
        >
          {/* Esquerda */}
          <Link to="/admin" className="flex items-center gap-3 shrink-0 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#7c6aff] to-[#00d4aa] flex items-center justify-center text-white shadow-lg shadow-[#7c6aff]/20 group-hover:shadow-[#00d4aa]/30 transition-all">
              <MonitorPlay size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[28px] font-[800] leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] font-[Syne]">
                SmartQueue
              </span>
              <span className="text-[11px] font-bold text-[#6b6b8a] uppercase tracking-[3px] mt-0.5 whitespace-nowrap">
                FILA INTELIGENTE
              </span>
            </div>
          </Link>

          {/* Centro */}
          <div className="hidden md:flex flex-col justify-center items-center text-center flex-1 px-4 truncate">
            {unidade ? (
              <span className="text-[14px] font-[500] text-[#a0a0b8] truncate w-full">
                {unidade.endereco ? `${unidade.endereco}, ${unidade.cidade} - ${unidade.estado}` : `${unidade.cidade} - ${unidade.estado}`}
              </span>
            ) : (
              <span className="text-[12px] text-[#6b6b8a]">Carregando unidade...</span>
            )}
          </div>

          {/* Direita */}
          <div className="hidden md:flex items-center gap-4 shrink-0 h-full">
            <div className="flex items-center gap-2">
              <UserAvatar
                src={perfil?.url_avatar}
                name={perfil?.nome_completo || 'Admin'}
                size={32}
              />
              <span className="text-sm font-medium text-[#e8e8f0]">
                {perfil?.nome_completo?.split(' ')[0] || 'Admin'}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="w-8 h-8 flex items-center justify-center text-[#6b6b8a] hover:text-[#ff6b6b] hover:bg-[#ff6b6b]/10 rounded-md transition-colors"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* MENÚ HAMBÚRGUER (Apenas Mobile) */}
          <div className="md:hidden flex items-center shrink-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[#e8e8f0] p-2 hover:bg-[#1e1e2e] rounded-md transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* BARRA INFERIOR (navegação) */}
        <div
          className="hidden md:flex items-center w-full px-8 bg-[#0d0d14] border-b border-[#2d2d45]"
          style={{ height: '44px' }}
        >
          <nav className="flex items-center h-full -ml-[20px]">
            {navLinks.map(link => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center h-full transition-colors`}
                  style={{
                    padding: '0 20px',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: isActive ? '#7c6aff' : '#6b6b8a',
                    borderBottom: isActive ? '2px solid #7c6aff' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#7c6aff';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#6b6b8a';
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* DROPDOWN MOBILE */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-[64px] left-0 w-full bg-[#111118] border-b border-[#2d2d45] shadow-xl flex flex-col pt-2 pb-4 px-4 gap-2 z-50">
            {/* Info da Unidade no Mobile */}
            {unidade && (
              <div className="mb-4 pb-4 border-b border-[#2d2d45] flex flex-col gap-1">
                <span className="text-xs text-[#6b6b8a]">
                  {unidade.endereco ? `${unidade.endereco}, ${unidade.cidade} - ${unidade.estado}` : `${unidade.cidade} - ${unidade.estado}`}
                </span>
              </div>
            )}

            {navLinks.map(link => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-md text-[13px] font-medium transition-colors uppercase tracking-[1px]
                      ${isActive ? 'bg-[#7c6aff]/10 text-[#7c6aff]' : 'text-[#6b6b8a] hover:bg-[#1e1e2e]'}
                    `}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-2 pt-4 border-t border-[#2d2d45] flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={perfil?.url_avatar}
                  name={perfil?.nome_completo || 'Admin'}
                  size={32}
                />
                <span className="text-sm font-medium text-[#e8e8f0]">
                  {perfil?.nome_completo?.split(' ')[0] || 'Admin'}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm font-medium text-[#ff6b6b] px-3 py-2 rounded-md hover:bg-[#ff6b6b]/10 transition-colors"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      {/* BACKGROUND ELEMENTS GLOBALS */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(rgba(124,106,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,106,255,0.03) 1px, transparent 1px)',
        backgroundSize: '48px 48px', pointerEvents: 'none', zIndex: -1
      }} />
      <div style={{
        position: 'fixed', width: '600px', height: '600px', background: 'rgba(124,106,255,0.08)', borderRadius: '50%',
        filter: 'blur(120px)', top: '-200px', left: '-100px', pointerEvents: 'none', zIndex: -1
      }} />
      <div style={{
        position: 'fixed', width: '400px', height: '400px', background: 'rgba(0,212,170,0.06)', borderRadius: '50%',
        filter: 'blur(100px)', bottom: '-100px', right: '-100px', pointerEvents: 'none', zIndex: -1
      }} />

      <main className="flex-1 w-full flex flex-col relative z-0 pt-[120px] pb-6 px-6 md:px-10 min-h-[calc(100vh-120px)]">
        {children}
      </main>
    </div>
  );
}
