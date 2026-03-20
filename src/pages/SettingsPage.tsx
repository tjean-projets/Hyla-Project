import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerNames, setOwnerNames] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setOwnerNames(settings.owner_matching_names || []);
    }
  }, [settings]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Profil mis à jour' }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('user_settings').update({
        owner_matching_names: ownerNames,
      }).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({ title: 'Paramètres sauvegardés' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const addOwnerName = () => {
    if (newName.trim() && !ownerNames.includes(newName.trim().toLowerCase())) {
      setOwnerNames([...ownerNames, newName.trim().toLowerCase()]);
      setNewName('');
    }
  };

  return (
    <AppLayout title="Paramètres">
      <div className="max-w-2xl space-y-8">
        {/* Profile */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Mon profil</h3>
          <div className="space-y-4">
            <div>
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="bg-gray-50" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="bg-[#3b82f6] hover:bg-[#3b82f6]/90">
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder
            </Button>
          </div>
        </div>

        {/* Matching names (for imports) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Noms de matching (imports)</h3>
          <p className="text-sm text-gray-500 mb-4">
            Ajoutez les variantes de votre nom telles qu'elles apparaissent dans les fichiers de commissions.
            L'import utilisera ces noms pour identifier vos lignes personnelles.
          </p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Marie Dupont, M. DUPONT..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOwnerName())}
              />
              <Button variant="outline" onClick={addOwnerName}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ownerNames.map((name, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-[#3b82f6]/10 text-[#3b82f6] px-3 py-1 rounded-full text-sm font-medium">
                  {name}
                  <button onClick={() => setOwnerNames(ownerNames.filter((_, j) => j !== i))} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {ownerNames.length === 0 && <p className="text-sm text-gray-400">Aucun nom configuré</p>}
            </div>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder les noms
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
