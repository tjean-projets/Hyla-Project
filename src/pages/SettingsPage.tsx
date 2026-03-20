import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Award, Star, Trophy, Crown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const TIER_CONFIG = [
  { key: 'bronze', label: 'Bronze', icon: Award, color: 'text-amber-600', bg: 'bg-amber-100', defaultMin: 0 },
  { key: 'argent', label: 'Argent', icon: Star, color: 'text-gray-500', bg: 'bg-gray-100', defaultMin: 3 },
  { key: 'or', label: 'Or', icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-100', defaultMin: 8 },
  { key: 'platine', label: 'Platine', icon: Crown, color: 'text-violet-500', bg: 'bg-violet-100', defaultMin: 15 },
];

type TierThresholds = {
  bronze: number;
  argent: number;
  or: number;
  platine: number;
};

const DEFAULT_THRESHOLDS: TierThresholds = { bronze: 0, argent: 3, or: 8, platine: 15 };

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [thresholds, setThresholds] = useState<TierThresholds>(DEFAULT_THRESHOLDS);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  // Load tier thresholds from user_settings
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('tier_thresholds')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (userSettings?.tier_thresholds) {
      const saved = userSettings.tier_thresholds as unknown as TierThresholds;
      setThresholds({
        bronze: saved.bronze ?? DEFAULT_THRESHOLDS.bronze,
        argent: saved.argent ?? DEFAULT_THRESHOLDS.argent,
        or: saved.or ?? DEFAULT_THRESHOLDS.or,
        platine: saved.platine ?? DEFAULT_THRESHOLDS.platine,
      });
    }
  }, [userSettings]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Profil mis à jour' }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const saveTiers = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, tier_thresholds: thresholds as unknown as Record<string, unknown> },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Niveaux mis à jour' }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  return (
    <AppLayout title="Paramètres">
      <div className="max-w-2xl space-y-8">
        {/* Profile */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Mon profil</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={user?.email || ''} disabled className="bg-gray-50 h-11" />
            </div>
            <div>
              <Label className="text-xs">Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
            </div>
            <button
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Sauvegarder
            </button>
          </div>
        </div>

        {/* Tier thresholds */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Niveaux du réseau</h3>
          <p className="text-xs text-gray-500 mb-4">Configurez les seuils de membres pour chaque niveau</p>
          <div className="space-y-3">
            {TIER_CONFIG.map((tier) => {
              const Icon = tier.icon;
              return (
                <div key={tier.key} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl ${tier.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${tier.color}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{tier.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={thresholds[tier.key as keyof TierThresholds]}
                      onChange={(e) =>
                        setThresholds((prev) => ({
                          ...prev,
                          [tier.key]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="h-11 w-24 text-center"
                    />
                    <span className="text-xs text-gray-500">membres</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => saveTiers.mutate()}
            disabled={saveTiers.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 mt-4 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveTiers.isPending ? 'Enregistrement...' : 'Sauvegarder les niveaux'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
