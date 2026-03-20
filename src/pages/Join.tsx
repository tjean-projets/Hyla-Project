import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle, Building2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase, type TierRule } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function Join() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tiers, setTiers] = useState<TierRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<'info' | 'code'>('info');
  const [inviteCode, setInviteCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('tier_rules').select('*').order('min_signed').then(({ data }) => {
      if (data) setTiers(data as unknown as TierRule[]);
      setIsLoading(false);
    });
  }, []);

  const handleValidateCode = async () => {
    if (!inviteCode.trim()) {
      toast({ title: 'Code requis', variant: 'destructive' });
      return;
    }

    setIsValidating(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('validate_partner_invite', { p_invite_code: inviteCode.trim() });

    if (rpcError || !data || data.length === 0) {
      setError('Code d\'invitation invalide.');
      setIsValidating(false);
      return;
    }

    const validation = data[0];

    if (validation.invite_used_at) {
      setError('Cette invitation a déjà été utilisée.');
      setIsValidating(false);
      return;
    }

    if (new Date(validation.invite_expires_at) < new Date()) {
      setError('Cette invitation a expiré.');
      setIsValidating(false);
      return;
    }

    // Redirect to existing invite page
    setIsValidating(false);
    navigate(`/invite/${inviteCode.trim()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-6 shadow-lg">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Devenez Partenaire Thomas Jean Courtage
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Rejoignez notre réseau d'apporteurs d'affaires et bénéficiez de commissions évolutives selon votre performance.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Tier info */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Grille de Commissions</h2>
            <p className="text-sm text-muted-foreground">
              Vos commissions augmentent automatiquement avec votre activité. Plus vous signez, plus votre taux est élevé.
            </p>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier, i) => (
                  <div key={tier.id} className="rounded-lg border bg-card p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{tier.tier_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tier.min_signed} {tier.max_signed ? `à ${tier.max_signed}` : '+'} dossiers signés
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{tier.rate_percent}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Commission</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-medium">Avantages</p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-6">
                <li>Suivi en temps réel de vos dossiers</li>
                <li>Commissions évolutives automatiques</li>
                <li>Tableau de bord personnalisé</li>
                <li>Notifications instantanées</li>
              </ul>
            </div>
          </div>

          {/* Right: Enter code */}
          <div>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Accéder à mon espace</CardTitle>
                <CardDescription>
                  Entrez votre code d'invitation pour créer votre compte partenaire
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-xs">Code d'invitation</Label>
                  <Input
                    id="code"
                    placeholder="Votre code d'invitation"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="h-11"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <Button className="w-full h-11" onClick={handleValidateCode} disabled={isValidating}>
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    'Créer mon compte'
                  )}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center">
                  Vous n'avez pas de code ? Contactez votre administrateur.
                </p>

                <div className="border-t pt-4">
                  <Button variant="outline" className="w-full h-10 text-sm" onClick={() => navigate('/login')}>
                    J'ai déjà un compte — Se connecter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
