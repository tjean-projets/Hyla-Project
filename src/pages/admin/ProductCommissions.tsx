import { useState, useEffect } from 'react';
import { Save, Package, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase, CONTRACT_TYPE_LABELS, type ContractType } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ProductConfig {
  id: string;
  contract_type: ContractType;
  commission_mode: 'tiered' | 'fixed';
  fixed_rate_percent: number;
}

interface ProductTier {
  id: string | null;
  contract_type: ContractType;
  tier_name: string;
  min_signed: string;
  max_signed: string;
  rate_percent: number;
  isNew?: boolean;
}

const ALL_POSSIBLE_PRODUCTS: ContractType[] = ['emprunteur', 'prevoyance', 'rc_pro', 'sante', 'decennale'];

export default function ProductCommissions() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ProductConfig[]>([]);
  const [tiers, setTiers] = useState<Record<string, ProductTier[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  const activeProducts = configs.map(c => c.contract_type);
  const availableToAdd = ALL_POSSIBLE_PRODUCTS.filter(p => !activeProducts.includes(p));

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [configRes, tierRes] = await Promise.all([
      supabase.from('product_commission_configs').select('*'),
      supabase.from('product_tier_rules').select('*').order('min_signed'),
    ]);

    if (configRes.data) {
      setConfigs(configRes.data as unknown as ProductConfig[]);
    }

    if (tierRes.data) {
      const grouped: Record<string, ProductTier[]> = {};
      for (const t of tierRes.data as unknown as (ProductTier & { id: string })[]) {
        const ct = t.contract_type;
        if (!grouped[ct]) grouped[ct] = [];
        grouped[ct].push({
          id: t.id,
          contract_type: ct,
          tier_name: t.tier_name,
          min_signed: String(t.min_signed),
          max_signed: t.max_signed ? String(t.max_signed) : '',
          rate_percent: t.rate_percent,
        });
      }
      setTiers(grouped);
    }
    setIsLoading(false);
  };

  const handleAddProduct = async (ct: ContractType) => {
    await supabase.from('product_commission_configs').insert({
      contract_type: ct,
      commission_mode: 'tiered',
      fixed_rate_percent: 0,
    });
    await fetchAll();
    setActiveTab(ct);
    toast({ title: 'Produit ajouté', description: `« ${CONTRACT_TYPE_LABELS[ct]} » ajouté à la configuration.` });
  };

  const handleRemoveProduct = async (ct: ContractType) => {
    await supabase.from('product_tier_rules').delete().eq('contract_type', ct);
    await supabase.from('product_commission_configs').delete().eq('contract_type', ct);
    await fetchAll();
    setActiveTab(prev => prev === ct ? (configs.find(c => c.contract_type !== ct)?.contract_type || '') : prev);
    toast({ title: 'Produit retiré', description: `« ${CONTRACT_TYPE_LABELS[ct]} » retiré de la configuration.` });
  };

  const getConfig = (ct: ContractType): ProductConfig | undefined =>
    configs.find(c => c.contract_type === ct);

  const toggleMode = (ct: ContractType) => {
    setConfigs(prev => prev.map(c =>
      c.contract_type === ct
        ? { ...c, commission_mode: c.commission_mode === 'tiered' ? 'fixed' as const : 'tiered' as const }
        : c
    ));
  };

  const updateFixedRate = (ct: ContractType, val: number) => {
    setConfigs(prev => prev.map(c =>
      c.contract_type === ct ? { ...c, fixed_rate_percent: val } : c
    ));
  };

  const addTier = (ct: ContractType) => {
    const existing = tiers[ct] || [];
    const lastTier = existing[existing.length - 1];
    const nextMin = lastTier ? parseInt(lastTier.max_signed || lastTier.min_signed) + 1 : 0;
    setTiers(prev => ({
      ...prev,
      [ct]: [...existing, {
        id: null,
        contract_type: ct,
        tier_name: `Palier ${existing.length + 1}`,
        min_signed: String(nextMin),
        max_signed: '',
        rate_percent: 50,
        isNew: true,
      }],
    }));
  };

  const deleteTier = (ct: ContractType, index: number) => {
    setTiers(prev => ({
      ...prev,
      [ct]: (prev[ct] || []).filter((_, i) => i !== index),
    }));
  };

  const updateTier = (ct: ContractType, index: number, field: keyof ProductTier, value: string | number) => {
    setTiers(prev => ({
      ...prev,
      [ct]: (prev[ct] || []).map((t, i) => i === index ? { ...t, [field]: value } : t),
    }));
  };

  const handleSave = async (ct: ContractType) => {
    setSavingProduct(ct);
    const config = getConfig(ct);
    if (!config) { setSavingProduct(null); return; }

    // Update config
    await supabase.from('product_commission_configs').update({
      commission_mode: config.commission_mode,
      fixed_rate_percent: config.fixed_rate_percent,
      updated_at: new Date().toISOString(),
    }).eq('contract_type', ct);

    // Handle tiers: delete all for this product, then re-insert
    await supabase.from('product_tier_rules').delete().eq('contract_type', ct);

    const productTiers = tiers[ct] || [];
    if (config.commission_mode === 'tiered' && productTiers.length > 0) {
      const inserts = productTiers
        .filter(t => !isNaN(parseInt(t.min_signed)))
        .map(t => ({
          contract_type: ct,
          tier_name: t.tier_name,
          min_signed: parseInt(t.min_signed),
          max_signed: t.max_signed ? parseInt(t.max_signed) : null,
          rate_percent: t.rate_percent,
        }));
      if (inserts.length > 0) {
        await supabase.from('product_tier_rules').insert(inserts);
      }
    }

    await fetchAll();
    setSavingProduct(null);
    toast({
      title: 'Configuration enregistrée',
      description: `Commissions pour « ${CONTRACT_TYPE_LABELS[ct]} » mises à jour.`,
    });
  };

  if (isLoading) {
    return (
      <AdminLayout title="Commissions par Produit">
        <div className="space-y-4 max-w-3xl">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Commissions par Produit">
      <div className="max-w-3xl space-y-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Configuration des commissions par type de produit</p>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Choisissez pour chaque produit si la commission est un taux fixe ou calculée par paliers d'activité.
          </p>

          {activeProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">Aucun produit configuré</p>
              {availableToAdd.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Ajouter un produit
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {availableToAdd.map(ct => (
                      <DropdownMenuItem key={ct} onClick={() => handleAddProduct(ct)}>
                        {CONTRACT_TYPE_LABELS[ct]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ) : (
          <Tabs value={activeTab || activeProducts[0]} onValueChange={setActiveTab}>
            <div className="flex items-center gap-2 mb-1">
              <TabsList className="h-9 flex-1">
                {activeProducts.map(ct => (
                  <TabsTrigger key={ct} value={ct} className="text-xs px-3">
                    {CONTRACT_TYPE_LABELS[ct]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {availableToAdd.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {availableToAdd.map(ct => (
                      <DropdownMenuItem key={ct} onClick={() => handleAddProduct(ct)}>
                        {CONTRACT_TYPE_LABELS[ct]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {activeProducts.map(ct => {
              const config = getConfig(ct);
              const isTiered = config?.commission_mode === 'tiered';
              const productTiers = tiers[ct] || [];

              return (
                <TabsContent key={ct} value={ct} className="mt-4 space-y-4">
                  {/* Remove product button */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveProduct(ct)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Retirer ce produit
                    </Button>
                  </div>

                  {/* Mode toggle */}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="text-sm font-medium">Mode de calcul</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isTiered
                          ? 'Le taux varie selon le nombre de dossiers signés du partenaire'
                          : 'Un taux fixe est appliqué quelle que soit l\'activité du partenaire'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleMode(ct)}
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      {isTiered ? (
                        <>
                          <Badge variant="default" className="text-xs">Paliers</Badge>
                          <ToggleRight className="h-5 w-5 text-primary" />
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-xs">Fixe</Badge>
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Fixed rate config */}
                  {!isTiered && (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Taux de commission fixe</Label>
                        <span className="text-lg font-bold tabular-nums">{config?.fixed_rate_percent ?? 0}%</span>
                      </div>
                      <Slider
                        value={[config?.fixed_rate_percent ?? 0]}
                        onValueChange={v => updateFixedRate(ct, v[0])}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Ce pourcentage sera appliqué sur le montant de la prime annuelle pour calculer la commission du partenaire.
                      </p>
                    </div>
                  )}

                  {/* Tiered config */}
                  {isTiered && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Paliers pour {CONTRACT_TYPE_LABELS[ct]}</p>
                        <Button variant="outline" size="sm" onClick={() => addTier(ct)} className="h-7 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Ajouter
                        </Button>
                      </div>

                      {productTiers.length === 0 && (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <p className="text-xs text-muted-foreground">Aucun palier configuré. Les paliers globaux seront utilisés.</p>
                          <Button variant="outline" size="sm" onClick={() => addTier(ct)} className="mt-3 h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" />
                            Créer le premier palier
                          </Button>
                        </div>
                      )}

                      {productTiers.map((tier, i) => (
                        <div key={tier.id || `new-${i}`} className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Input
                                value={tier.tier_name}
                                onChange={e => updateTier(ct, i, 'tier_name', e.target.value)}
                                className="h-7 text-xs font-semibold w-auto max-w-[160px] border-dashed"
                              />
                              <Badge variant="secondary" className="text-xs font-bold">
                                {tier.rate_percent}%
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTier(ct, i)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] text-muted-foreground">Taux de commission</Label>
                              <span className="text-sm font-bold tabular-nums">{tier.rate_percent}%</span>
                            </div>
                            <Slider
                              value={[tier.rate_percent]}
                              onValueChange={v => updateTier(ct, i, 'rate_percent', v[0])}
                              min={0}
                              max={100}
                              step={5}
                              className="w-full"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Min dossiers signés</Label>
                              <Input
                                type="number"
                                value={tier.min_signed}
                                onChange={e => updateTier(ct, i, 'min_signed', e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Max dossiers (vide = ∞)</Label>
                              <Input
                                type="number"
                                value={tier.max_signed}
                                placeholder="∞"
                                onChange={e => updateTier(ct, i, 'max_signed', e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Save */}
                  <Button
                    onClick={() => handleSave(ct)}
                    disabled={savingProduct === ct}
                    className="w-full h-9 text-sm"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {savingProduct === ct ? 'Enregistrement...' : `Enregistrer ${CONTRACT_TYPE_LABELS[ct]}`}
                  </Button>
                </TabsContent>
              );
            })}
          </Tabs>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fonctionnement</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p><strong>Mode Paliers :</strong> Le taux de commission varie selon le nombre de dossiers signés par le partenaire pour ce type de produit.</p>
            <p><strong>Mode Fixe :</strong> Un taux unique est appliqué quelle que soit l'activité du partenaire.</p>
            <div className="rounded-md bg-muted p-2.5 mt-2">
              <p className="font-medium text-foreground mb-1">Commission partenaire</p>
              <p>= Prime annuelle × Taux applicable (fixe ou palier)</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
