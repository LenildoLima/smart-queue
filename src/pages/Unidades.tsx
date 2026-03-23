import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Plus,
  Edit2,
  Settings,
  Clock,
  XCircle,
  CheckCircle,
  Search,
  MapPin,
  Phone,
  Mail,
  Trash2,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

// ─── Types ──────────────────────────────────────────────
type Unidade = Tables<'unidades'>;
type TipoAtendimento = Tables<'tipos_atendimento'>;
type HorarioFuncionamento = Tables<'horarios_funcionamento'>;

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

// ─── Phone Mask ─────────────────────────────────────────
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

// ─── Styles ─────────────────────────────────────────────
const inputClass = 'bg-[#0a0a0f] border-[#2d2d45] text-[#e8e8f0] focus-visible:ring-[#7c6aff] focus-visible:border-[#7c6aff] placeholder:text-[#6b6b8a]';
const labelClass = 'text-[11px] uppercase tracking-[1px] font-bold text-[#6b6b8a] mb-1.5 block';
const modalOverlay = 'bg-black/80';

// ─── Component ──────────────────────────────────────────
const Unidades = () => {
  const { toast } = useToast();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal states
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unidade | null>(null);
  const [unitForm, setUnitForm] = useState({
    nome: '', descricao: '', endereco: '', cidade: '', estado: '', telefone: '', email: '', plano: 'gratuito' as 'gratuito' | 'premium'
  });

  // Serviços modal
  const [isServicosOpen, setIsServicosOpen] = useState(false);
  const [servicosUnit, setServicosUnit] = useState<Unidade | null>(null);
  const [servicos, setServicos] = useState<TipoAtendimento[]>([]);
  const [isServicoFormOpen, setIsServicoFormOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<TipoAtendimento | null>(null);
  const [servicoForm, setServicoForm] = useState({
    nome: '', descricao: '', duracao_media_minutos: 30, vagas_maximas_dia: 20, ativo: true
  });

  // Horários modal
  const [isHorariosOpen, setIsHorariosOpen] = useState(false);
  const [horariosUnit, setHorariosUnit] = useState<Unidade | null>(null);
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);
  const [horariosForm, setHorariosForm] = useState<Record<number, { aberto: boolean; abre_as: string; fecha_as: string }>>({});
  const [savingHorarios, setSavingHorarios] = useState(false);

  // ─── Fetch ──────────────────────────────────────────
  const fetchUnidades = useCallback(async () => {
    const { data, error } = await supabase.from('unidades').select('*').order('nome');
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setUnidades(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchUnidades(); }, [fetchUnidades]);

  const filteredUnidades = unidades.filter(u => {
    if (!busca) return true;
    const t = busca.toLowerCase();
    return u.nome.toLowerCase().includes(t) || u.cidade?.toLowerCase().includes(t) || u.estado?.toLowerCase().includes(t);
  });

  // ─── Unit Modal ─────────────────────────────────────
  const openNewUnit = () => {
    setEditingUnit(null);
    setUnitForm({ nome: '', descricao: '', endereco: '', cidade: '', estado: '', telefone: '', email: '', plano: 'gratuito' });
    setIsUnitModalOpen(true);
  };

  const openEditUnit = (u: Unidade) => {
    setEditingUnit(u);
    setUnitForm({
      nome: u.nome || '',
      descricao: u.descricao || '',
      endereco: u.endereco || '',
      cidade: u.cidade || '',
      estado: u.estado || '',
      telefone: u.telefone || '',
      email: u.email || '',
      plano: u.plano || 'gratuito',
    });
    setIsUnitModalOpen(true);
  };

  const saveUnit = async () => {
    if (!unitForm.nome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    if (!unitForm.cidade.trim()) {
      toast({ title: 'Cidade obrigatória', variant: 'destructive' });
      return;
    }
    if (!unitForm.estado) {
      toast({ title: 'Estado obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      nome: unitForm.nome.trim(),
      descricao: unitForm.descricao.trim() || null,
      endereco: unitForm.endereco.trim() || null,
      cidade: unitForm.cidade.trim(),
      estado: unitForm.estado,
      telefone: unitForm.telefone.trim() || null,
      email: unitForm.email.trim() || null,
      plano: unitForm.plano as any,
      atualizado_em: new Date().toISOString(),
    };

    if (editingUnit) {
      const { error } = await supabase.from('unidades').update(payload).eq('id', editingUnit.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      toast({ title: 'Unidade atualizada com sucesso!' });
    } else {
      const { error } = await supabase.from('unidades').insert(payload as any);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      toast({ title: 'Unidade criada com sucesso!' });
    }
    setSaving(false);
    setIsUnitModalOpen(false);
    fetchUnidades();
  };

  // ─── Toggle Active ──────────────────────────────────
  const toggleAtiva = async (u: Unidade) => {
    const newStatus = !u.ativa;
    const { error } = await supabase.from('unidades').update({ ativa: newStatus, atualizado_em: new Date().toISOString() } as any).eq('id', u.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: newStatus ? 'Unidade reativada' : 'Unidade desativada' });
    fetchUnidades();
  };

  // ─── Serviços ───────────────────────────────────────
  const openServicos = async (u: Unidade) => {
    setServicosUnit(u);
    setIsServicosOpen(true);
    const { data } = await supabase.from('tipos_atendimento').select('*').eq('unidade_id', u.id).order('nome');
    setServicos(data || []);
  };

  const openNewServico = () => {
    setEditingServico(null);
    setServicoForm({ nome: '', descricao: '', duracao_media_minutos: 30, vagas_maximas_dia: 20, ativo: true });
    setIsServicoFormOpen(true);
  };

  const openEditServico = (s: TipoAtendimento) => {
    setEditingServico(s);
    setServicoForm({
      nome: s.nome,
      descricao: s.descricao || '',
      duracao_media_minutos: s.duracao_media_minutos,
      vagas_maximas_dia: s.vagas_maximas_dia,
      ativo: s.ativo,
    });
    setIsServicoFormOpen(true);
  };

  const saveServico = async () => {
    if (!servicoForm.nome.trim()) {
      toast({ title: 'Nome do serviço obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      nome: servicoForm.nome.trim(),
      descricao: servicoForm.descricao.trim() || null,
      duracao_media_minutos: servicoForm.duracao_media_minutos,
      vagas_maximas_dia: servicoForm.vagas_maximas_dia,
      ativo: servicoForm.ativo,
      atualizado_em: new Date().toISOString(),
    };

    if (editingServico) {
      const { error } = await supabase.from('tipos_atendimento').update(payload).eq('id', editingServico.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      toast({ title: 'Serviço atualizado!' });
    } else {
      const { error } = await supabase.from('tipos_atendimento').insert({ ...payload, unidade_id: servicosUnit!.id } as any);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      toast({ title: 'Serviço criado!' });
    }
    setSaving(false);
    setIsServicoFormOpen(false);
    // Refresh
    const { data } = await supabase.from('tipos_atendimento').select('*').eq('unidade_id', servicosUnit!.id).order('nome');
    setServicos(data || []);
  };

  const toggleServicoAtivo = async (s: TipoAtendimento) => {
    const { error } = await supabase.from('tipos_atendimento').update({ ativo: !s.ativo, atualizado_em: new Date().toISOString() }).eq('id', s.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    const { data } = await supabase.from('tipos_atendimento').select('*').eq('unidade_id', servicosUnit!.id).order('nome');
    setServicos(data || []);
  };

  // ─── Horários ───────────────────────────────────────
  const openHorarios = async (u: Unidade) => {
    setHorariosUnit(u);
    setIsHorariosOpen(true);
    const { data } = await supabase.from('horarios_funcionamento').select('*').eq('unidade_id', u.id).order('dia_semana');
    const existingDays = new Set((data || []).map(h => h.dia_semana));
    
    // Build form — fill existing or defaults
    const form: Record<number, { aberto: boolean; abre_as: string; fecha_as: string }> = {};
    for (let i = 0; i < 7; i++) {
      const existing = (data || []).find(h => h.dia_semana === i);
      form[i] = existing
        ? { aberto: existing.aberto, abre_as: existing.abre_as.slice(0, 5), fecha_as: existing.fecha_as.slice(0, 5) }
        : { aberto: i >= 1 && i <= 5, abre_as: '08:00', fecha_as: '18:00' };
    }
    setHorariosForm(form);
    setHorarios(data || []);
  };

  const saveHorarios = async () => {
    if (!horariosUnit) return;
    setSavingHorarios(true);
    
    for (let dia = 0; dia < 7; dia++) {
      const h = horariosForm[dia];
      const existing = horarios.find(hr => hr.dia_semana === dia);
      const payload = {
        aberto: h.aberto,
        abre_as: h.abre_as + ':00',
        fecha_as: h.fecha_as + ':00',
      };

      if (existing) {
        await supabase.from('horarios_funcionamento').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('horarios_funcionamento').insert({
          ...payload,
          dia_semana: dia,
          unidade_id: horariosUnit.id,
        } as any);
      }
    }
    setSavingHorarios(false);
    toast({ title: 'Horários salvos com sucesso!' });
    setIsHorariosOpen(false);
  };

  // ─── Render ─────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="w-full py-6 space-y-6 animate-fade-in relative z-10">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#e8e8f0] font-[Syne] flex items-center gap-2">
              <Building2 size={24} className="text-[#7c6aff]" />
              Gestão de Unidades
            </h1>
            <p className="text-sm text-[#6b6b8a] mt-1">
              {unidades.length} unidade{unidades.length !== 1 ? 's' : ''} cadastrada{unidades.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0 shadow-lg h-10"
            onClick={openNewUnit}
          >
            <Plus size={18} className="mr-2" />
            Nova Unidade
          </Button>
        </div>

        {/* SEARCH */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-3 text-[#6b6b8a]" />
          <Input
            placeholder="Buscar unidade..."
            className={`pl-10 ${inputClass}`}
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* CARDS */}
        {loading ? (
          <div className="text-center text-[#6b6b8a] py-12">Carregando unidades...</div>
        ) : filteredUnidades.length === 0 ? (
          <div className="text-center text-[#6b6b8a] py-12">
            {busca ? 'Nenhuma unidade encontrada com esse filtro.' : 'Nenhuma unidade cadastrada.'}
          </div>
        ) : (
          <div className={`grid gap-4 ${filteredUnidades.length === 1 ? 'grid-cols-1' : filteredUnidades.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
            {filteredUnidades.map(u => (
              <Card key={u.id} className={`bg-[#13131f] border-[#2d2d45] transition-all hover:border-[#7c6aff]/40 ${!u.ativa ? 'opacity-60' : ''}`}>
                <CardContent className="p-5 space-y-4">
                  {/* Name + Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#e8e8f0] font-[Syne] leading-tight">{u.nome}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={u.plano === 'premium'
                          ? 'border-[#7c6aff] text-[#7c6aff] bg-transparent'
                          : 'border-[#6b6b8a] text-[#6b6b8a] bg-transparent'
                        }
                      >
                        {u.plano === 'premium' ? 'PREMIUM ⭐' : 'GRATUITO'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={u.ativa
                          ? 'border-[#00d4aa] text-[#00d4aa] bg-transparent'
                          : 'border-[#ff6b6b] text-[#ff6b6b] bg-transparent'
                        }
                      >
                        {u.ativa ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                  </div>

                  {/* Address */}
                  {(u.endereco || u.cidade) && (
                    <div className="flex items-start gap-2 text-sm text-[#6b6b8a]">
                      <MapPin size={14} className="mt-0.5 flex-shrink-0 text-[#7c6aff]/60" />
                      <span>
                        {[u.endereco, u.cidade, u.estado].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Phone + Email */}
                  <div className="flex flex-wrap gap-4 text-sm text-[#6b6b8a]">
                    {u.telefone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-[#7c6aff]/60" />
                        <span>{u.telefone}</span>
                      </div>
                    )}
                    {u.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} className="text-[#7c6aff]/60" />
                        <span>{u.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1e1e2e]">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff] bg-transparent h-8 text-xs"
                      onClick={() => openEditUnit(u)}
                    >
                      <Edit2 size={13} className="mr-1.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff] bg-transparent h-8 text-xs"
                      onClick={() => openServicos(u)}
                    >
                      <Settings size={13} className="mr-1.5" /> Serviços
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] hover:text-[#7c6aff] bg-transparent h-8 text-xs"
                      onClick={() => openHorarios(u)}
                    >
                      <Clock size={13} className="mr-1.5" /> Horários
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={u.ativa
                        ? 'border-[#ff6b6b] text-[#ff6b6b] hover:bg-[#ff6b6b]/10 bg-transparent h-8 text-xs'
                        : 'border-[#00d4aa] text-[#00d4aa] hover:bg-[#00d4aa]/10 bg-transparent h-8 text-xs'
                      }
                      onClick={() => toggleAtiva(u)}
                    >
                      {u.ativa ? <><XCircle size={13} className="mr-1.5" /> Desativar</> : <><CheckCircle size={13} className="mr-1.5" /> Reativar</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          MODAL: NOVA / EDITAR UNIDADE
         ═══════════════════════════════════════════════════ */}
      <Dialog open={isUnitModalOpen} onOpenChange={setIsUnitModalOpen}>
        <DialogContent className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] max-w-lg max-h-[90vh] overflow-y-auto" style={{ zIndex: 60 }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-[Syne] font-bold">
              {editingUnit ? 'Editar Unidade' : 'Nova Unidade'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass}>Nome *</label>
              <Input className={inputClass} value={unitForm.nome} onChange={e => setUnitForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome da unidade" />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea
                className={`w-full rounded-md px-3 py-2 text-sm min-h-[70px] resize-none ${inputClass} border`}
                value={unitForm.descricao}
                onChange={e => setUnitForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Descrição da unidade"
              />
            </div>
            <div>
              <label className={labelClass}>Endereço</label>
              <Input className={inputClass} value={unitForm.endereco} onChange={e => setUnitForm(p => ({ ...p, endereco: e.target.value }))} placeholder="Ex: Rua das Flores, 100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cidade *</label>
                <Input className={inputClass} value={unitForm.cidade} onChange={e => setUnitForm(p => ({ ...p, cidade: e.target.value }))} placeholder="Cidade" />
              </div>
              <div>
                <label className={labelClass}>Estado *</label>
                <Select value={unitForm.estado} onValueChange={v => setUnitForm(p => ({ ...p, estado: v }))}>
                  <SelectTrigger className={`${inputClass}`}>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] z-[9999]" position="popper" side="bottom" sideOffset={4}>
                    {UFS.map(uf => (
                      <SelectItem key={uf} value={uf} className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Telefone</label>
                <Input
                  className={inputClass}
                  value={unitForm.telefone}
                  onChange={e => setUnitForm(p => ({ ...p, telefone: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <Input className={inputClass} value={unitForm.email} onChange={e => setUnitForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" type="email" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Plano</label>
              <Select value={unitForm.plano} onValueChange={v => setUnitForm(p => ({ ...p, plano: v as 'gratuito' | 'premium' }))}>
                <SelectTrigger className={`${inputClass}`}>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] z-[9999]" position="popper" side="bottom" sideOffset={4}>
                  <SelectItem value="gratuito" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Gratuito</SelectItem>
                  <SelectItem value="premium" className="focus:bg-[#1e1e2e] focus:text-[#e8e8f0]">Premium ⭐</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-[#2d2d45] text-[#6b6b8a] hover:border-[#7c6aff] bg-transparent" onClick={() => setIsUnitModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0"
              onClick={saveUnit}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════
          MODAL: SERVIÇOS
         ═══════════════════════════════════════════════════ */}
      <Dialog open={isServicosOpen} onOpenChange={setIsServicosOpen}>
        <DialogContent className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] max-w-2xl max-h-[90vh] overflow-y-auto" style={{ zIndex: 60 }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-[Syne] font-bold flex items-center gap-2">
              <Settings size={20} className="text-[#7c6aff]" />
              Serviços de {servicosUnit?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0 h-8"
              onClick={openNewServico}
            >
              <Plus size={15} className="mr-1.5" /> Novo Serviço
            </Button>
          </div>

          {servicos.length === 0 ? (
            <div className="text-center text-[#6b6b8a] py-8">Nenhum serviço cadastrado para esta unidade.</div>
          ) : (
            <div className="space-y-3">
              {servicos.map(s => (
                <div key={s.id} className={`flex items-center justify-between gap-3 p-4 rounded-lg bg-[#0a0a0f] border border-[#2d2d45] ${!s.ativo ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#e8e8f0] text-sm">{s.nome}</span>
                      <Badge variant="outline" className={s.ativo ? 'border-[#00d4aa] text-[#00d4aa] bg-transparent text-[10px]' : 'border-[#ff6b6b] text-[#ff6b6b] bg-transparent text-[10px]'}>
                        {s.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    {s.descricao && <p className="text-xs text-[#6b6b8a] mt-1 truncate">{s.descricao}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-[#6b6b8a]">
                      <span>⏱ {s.duracao_media_minutos} min</span>
                      <span>📋 {s.vagas_maximas_dia} vagas/dia</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="outline" className="border-[#2d2d45] text-[#e8e8f0] hover:border-[#7c6aff] bg-transparent h-7 w-7 p-0" onClick={() => openEditServico(s)}>
                      <Edit2 size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={s.ativo
                        ? 'border-[#ff6b6b] text-[#ff6b6b] hover:bg-[#ff6b6b]/10 bg-transparent h-7 w-7 p-0'
                        : 'border-[#00d4aa] text-[#00d4aa] hover:bg-[#00d4aa]/10 bg-transparent h-7 w-7 p-0'
                      }
                      onClick={() => toggleServicoAtivo(s)}
                    >
                      {s.ativo ? <XCircle size={13} /> : <CheckCircle size={13} />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Sub-modal: Form Serviço ── */}
      <Dialog open={isServicoFormOpen} onOpenChange={setIsServicoFormOpen}>
        <DialogContent className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] max-w-md" style={{ zIndex: 70 }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-[Syne] font-bold">
              {editingServico ? 'Editar Serviço' : 'Novo Serviço'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass}>Nome *</label>
              <Input className={inputClass} value={servicoForm.nome} onChange={e => setServicoForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Consulta Geral" />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea
                className={`w-full rounded-md px-3 py-2 text-sm min-h-[60px] resize-none ${inputClass} border`}
                value={servicoForm.descricao}
                onChange={e => setServicoForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Descrição do serviço"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Duração Média (min) *</label>
                <Input className={inputClass} type="number" min={1} value={servicoForm.duracao_media_minutos} onChange={e => setServicoForm(p => ({ ...p, duracao_media_minutos: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label className={labelClass}>Vagas / Dia *</label>
                <Input className={inputClass} type="number" min={1} value={servicoForm.vagas_maximas_dia} onChange={e => setServicoForm(p => ({ ...p, vagas_maximas_dia: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className={labelClass + ' mb-0'}>Ativo</label>
              <button
                type="button"
                onClick={() => setServicoForm(p => ({ ...p, ativo: !p.ativo }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${servicoForm.ativo ? 'bg-[#00d4aa]' : 'bg-[#2d2d45]'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${servicoForm.ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#2d2d45] text-[#6b6b8a] hover:border-[#7c6aff] bg-transparent" onClick={() => setIsServicoFormOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0" onClick={saveServico} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════
          MODAL: HORÁRIOS
         ═══════════════════════════════════════════════════ */}
      <Dialog open={isHorariosOpen} onOpenChange={setIsHorariosOpen}>
        <DialogContent className="bg-[#111118] border-[#2d2d45] text-[#e8e8f0] max-w-lg max-h-[90vh] overflow-y-auto" style={{ zIndex: 60 }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-[Syne] font-bold flex items-center gap-2">
              <Clock size={20} className="text-[#7c6aff]" />
              Horários de {horariosUnit?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {DIAS_SEMANA.map((dia, i) => {
              const h = horariosForm[i] || { aberto: false, abre_as: '08:00', fecha_as: '18:00' };
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${h.aberto ? 'bg-[#0a0a0f] border-[#2d2d45]' : 'bg-[#0a0a0f]/50 border-[#1e1e2e]'}`}>
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => setHorariosForm(p => ({ ...p, [i]: { ...p[i], aberto: !p[i].aberto } }))}
                    className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${h.aberto ? 'bg-[#00d4aa]' : 'bg-[#2d2d45]'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${h.aberto ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>

                  {/* Day name */}
                  <span className={`w-20 text-sm font-medium flex-shrink-0 ${h.aberto ? 'text-[#e8e8f0]' : 'text-[#6b6b8a]'}`}>
                    {dia}
                  </span>

                  {/* Time inputs */}
                  {h.aberto ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        className={`rounded-md px-2 py-1 text-sm w-24 ${inputClass} border border-[#2d2d45]`}
                        value={h.abre_as}
                        onChange={e => setHorariosForm(p => ({ ...p, [i]: { ...p[i], abre_as: e.target.value } }))}
                      />
                      <span className="text-[#6b6b8a] text-xs">às</span>
                      <input
                        type="time"
                        className={`rounded-md px-2 py-1 text-sm w-24 ${inputClass} border border-[#2d2d45]`}
                        value={h.fecha_as}
                        onChange={e => setHorariosForm(p => ({ ...p, [i]: { ...p[i], fecha_as: e.target.value } }))}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-[#6b6b8a] italic">Fechado</span>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-[#2d2d45] text-[#6b6b8a] hover:border-[#7c6aff] bg-transparent" onClick={() => setIsHorariosOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] text-white hover:opacity-90 border-0"
              onClick={saveHorarios}
              disabled={savingHorarios}
            >
              {savingHorarios ? 'Salvando...' : 'Salvar Horários'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Unidades;
