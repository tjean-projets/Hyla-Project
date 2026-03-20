import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// Type pour les données d'invitation validées (sans données sensibles)
interface InviteValidation {
  id: string;
  invite_expires_at: string;
  invite_used_at: string | null;
  is_active: boolean;
}

export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [inviteData, setInviteData] = useState<InviteValidation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // L'email est maintenant saisi par l'utilisateur (pas exposé pour raison de sécurité)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (code) validateInvite();
  }, [code]);

  const validateInvite = async () => {
    // Utiliser la fonction sécurisée qui ne retourne que les champs nécessaires
    // (pas d'email, display_name, user_id exposés)
    const { data, error: rpcError } = await supabase
      .rpc('validate_partner_invite', { p_invite_code: code });

    setIsLoading(false);

    if (rpcError || !data || data.length === 0) {
      setError('Ce lien d\'invitation est invalide.');
      return;
    }

    const validationData = data[0] as InviteValidation;

    if (validationData.invite_used_at) {
      setError('Cette invitation a déjà été utilisée.');
      return;
    }

    if (new Date(validationData.invite_expires_at) < new Date()) {
      setError('Cette invitation a expiré. Contactez votre administrateur.');
      return;
    }

    if (!validationData.is_active) {
      setError('Ce compte partenaire a été désactivé.');
      return;
    }

    setInviteData(validationData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteData) return;

    // Validation de l'email
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      toast({
        title: 'Email invalide',
        description: 'Veuillez entrer une adresse email valide.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Mot de passe trop court',
        description: 'Le mot de passe doit contenir au moins 8 caractères.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    // Déconnecter toute session existante (ex: admin) avant de créer le compte
    await supabase.auth.signOut();

    // Create Supabase user avec l'email saisi
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError || !authData.user) {
      toast({
        title: 'Erreur',
        description: authError?.message || 'Impossible de créer le compte.',
        variant: 'destructive',
      });
      setIsCreating(false);
      return;
    }

    // Utiliser le token de la session du nouvel utilisateur directement
    const accessToken = authData.session?.access_token;

    if (!accessToken) {
      toast({
        title: 'Erreur',
        description: 'Session invalide. Réessayez.',
        variant: 'destructive',
      });
      setIsCreating(false);
      return;
    }

    // Compléter l'inscription via RPC (remplace l'edge function non déployée)
    // Supporte tous les domaines email : gmail, hotmail, outlook, etc.
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('complete_partner_signup', { p_partner_id: inviteData.id });

    if (rpcError || (rpcData && rpcData.error)) {
      const msg = rpcData?.error || rpcError?.message || 'Erreur inconnue';
      let description = 'Une erreur est survenue lors de la création du compte.';
      if (msg.includes('Email does not match')) {
        description = "L'email saisi ne correspond pas à celui de l'invitation.";
      } else if (msg.includes('already used')) {
        description = 'Cette invitation a déjà été utilisée.';
      } else if (msg.includes('expired')) {
        description = 'Cette invitation a expiré.';
      }
      toast({ title: 'Erreur', description, variant: 'destructive' });
      console.error('Partner signup RPC error:', msg);
      await supabase.auth.signOut();
      setIsCreating(false);
      return;
    }

    toast({
      title: 'Compte créé !',
      description: 'Bienvenue chez Hyla.',
    });

    // Redirect to partner dashboard
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => navigate('/login')}
            >
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Hyla</h1>
          <p className="text-muted-foreground mt-1">Créez votre compte partenaire</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle>Bienvenue !</CardTitle>
            <CardDescription>
              Entrez l'email qui vous a été communiqué et définissez votre mot de passe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  Utilisez l'adresse email indiquée dans votre invitation
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12"
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
