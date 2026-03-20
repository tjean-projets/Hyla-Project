import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Inbox } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { LeadCard } from '@/components/LeadCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase, type Lead } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function PartnerLeads() {
  const { partnerId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (partnerId) {
      fetchLeads();
    }
  }, [partnerId]);

  const fetchLeads = async () => {
    if (!partnerId) return;

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLeads(data as unknown as Lead[]);
    }
    setIsLoading(false);
  };

  const filteredLeads = leads.filter((lead) => {
    const searchLower = search.toLowerCase();
    return (
      lead.first_name.toLowerCase().includes(searchLower) ||
      lead.last_name.toLowerCase().includes(searchLower) ||
      lead.phone.includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Mes Leads" />

      <main className="container py-4 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {/* Leads list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Mes leads</h2>
            <span className="text-sm text-muted-foreground">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Aucun lead pour le moment</p>
              <Link to="/leads/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un lead
                </Button>
              </Link>
            </div>
          ) : (
            filteredLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <Link to="/leads/new" className="fab">
        <Plus className="h-6 w-6" />
      </Link>

      <MobileNav />
    </div>
  );
}
