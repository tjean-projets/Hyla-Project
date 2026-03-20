import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Lead, type Partner, type LeadStatus, STATUS_LABELS, STATUS_ORDER, CONTRACT_TYPE_LABELS } from '@/lib/supabase';
import { AdminLayout } from '@/components/AdminLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SegmentedProgress } from '@/components/SegmentedProgress';
import { Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type TierRule, type PartnerTier } from '@/lib/supabase';
import { fireConfetti } from '@/lib/confetti';
import { toast as sonnerToast } from 'sonner';

export default function AdminPipeline() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tiers, setTiers] = useState<TierRule[]>([]);
  const [partnerTiers, setPartnerTiers] = useState<Record<string, PartnerTier>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [leadsRes, partnersRes, tiersRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('*').order('display_name'),
      supabase.from('tier_rules').select('*').order('min_signed'),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as unknown as Lead[]);
    if (partnersRes.data) {
      const partnerList = partnersRes.data as unknown as Partner[];
      setPartners(partnerList);
      const tierMap: Record<string, PartnerTier> = {};
      await Promise.all(
        partnerList.filter(p => p.invite_used_at).map(async (p) => {
          const { data } = await supabase.rpc('get_partner_tier', { p_partner_id: p.id });
          if (data && (data as unknown[]).length > 0) {
            tierMap[p.id] = (data as unknown as PartnerTier[])[0];
          }
        })
      );
      setPartnerTiers(tierMap);
    }
    if (tiersRes.data) setTiers(tiersRes.data as unknown as TierRule[]);
    setIsLoading(false);
  };

  const getPartnerName = (pid: string) => partners.find(p => p.id === pid)?.display_name || '—';

  const columns = STATUS_ORDER.map(status => ({
    status,
    label: STATUS_LABELS[status],
    leads: leads.filter(l => l.status === status),
  }));

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStatus = result.destination.droppableId as LeadStatus;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Reorder within the same column (free ordering) — just update local state
    if (lead.status === newStatus) {
      const columnLeads = leads.filter(l => l.status === newStatus);
      const otherLeads = leads.filter(l => l.status !== newStatus);
      const [moved] = columnLeads.splice(result.source.index, 1);
      columnLeads.splice(result.destination.index, 0, moved);
      setLeads([...otherLeads, ...columnLeads]);
      return;
    }

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: lead.status } : l));
      return;
    }

    // 🎉 Confetti when moved to SIGNE
    if (newStatus === 'SIGNE') {
      fireConfetti();
      const commission = lead.commission_final || lead.commission_estimated || 0;
      sonnerToast.success('🎉 Dossier signé !', {
        description: `${lead.first_name} ${lead.last_name} — Commission brute : ${commission.toLocaleString('fr-FR')}€`,
        duration: 5000,
      });
    }
  };

  const partnerPerformance = partners
    .filter(p => p.invite_used_at)
    .map(p => {
      const pLeads = leads.filter(l => l.partner_id === p.id);
      const signed = pLeads.filter(l => l.status === 'SIGNE').length;
      const totalCA = pLeads.filter(l => l.status === 'SIGNE').reduce((sum, l) => sum + (l.annual_premium_final || l.annual_premium_estimated || 0), 0);
      const totalComm = pLeads.filter(l => l.status === 'SIGNE').reduce((sum, l) => sum + (l.commission_final || l.commission_estimated || 0), 0);
      const tier = partnerTiers[p.id];
      return { ...p, leadCount: pLeads.length, signedCount: signed, totalCA, totalComm, tier };
    })
    .sort((a, b) => b.signedCount - a.signedCount);

  return (
    <AdminLayout title="Pipeline des Dossiers">
      <div className="space-y-8">
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="min-w-[220px]">
                <Skeleton className="h-8 w-full rounded-md mb-2" />
                <Skeleton className="h-28 w-full rounded-md mb-2" />
                <Skeleton className="h-28 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {columns.map(col => (
                <Droppable key={col.status} droppableId={col.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-w-[220px] flex-1 rounded-lg p-3 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-muted/70' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 px-1">
                        <StatusBadge status={col.status} />
                        <span className="text-xs text-muted-foreground font-medium">{col.leads.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[80px]">
                        {col.leads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`rounded-lg border bg-card p-3 text-sm transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-sm'
                                }`}
                              >
                                <Link to={`/admin/leads/${lead.id}`} className="block">
                                  <p className="font-semibold text-foreground">
                                    {lead.last_name}, {lead.first_name.charAt(0)}.
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {getPartnerName(lead.partner_id)}
                                  </p>
                                  {lead.contract_type && (
                                    <span className={`inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                      lead.contract_type === 'sante' ? 'bg-emerald-50 text-emerald-700' :
                                      lead.contract_type === 'decennale' ? 'bg-red-50 text-red-700' :
                                      lead.contract_type === 'emprunteur' ? 'bg-sky-50 text-sky-700' :
                                      lead.contract_type === 'prevoyance' ? 'bg-violet-50 text-violet-700' :
                                      'bg-amber-50 text-amber-700'
                                    }`}>
                                      {CONTRACT_TYPE_LABELS[lead.contract_type]}
                                    </span>
                                  )}
                                  {lead.commission_estimated && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {lead.commission_estimated.toLocaleString('fr-FR')} €
                                    </p>
                                  )}
                                </Link>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}

        {/* Partner Management Table */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Gestion des Partenaires</h2>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Partenaire</TableHead>
                  <TableHead className="text-xs">Leads</TableHead>
                  <TableHead className="text-xs">Signés</TableHead>
                  <TableHead className="text-xs">CA Généré</TableHead>
                  <TableHead className="text-xs">Comm.</TableHead>
                  <TableHead className="text-xs">Progression</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      Aucun partenaire actif
                    </TableCell>
                  </TableRow>
                ) : (
                  partnerPerformance.map((p) => {
                    const maxSigned = tiers.length > 0 ? (tiers[tiers.length - 1].max_signed || tiers[tiers.length - 1].min_signed + 2) : 8;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm font-medium">{p.display_name}</TableCell>
                        <TableCell className="text-sm">{p.leadCount}</TableCell>
                        <TableCell className="text-sm font-semibold">{p.signedCount}</TableCell>
                        <TableCell className="text-sm">{p.totalCA.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell className="text-sm">{p.totalComm.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell>
                          <SegmentedProgress current={p.signedCount} segments={maxSigned} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link to="/admin/partners">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Link to="/admin/partners">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
