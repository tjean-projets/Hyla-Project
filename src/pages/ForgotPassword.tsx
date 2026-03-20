import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { TjcLogo } from '@/components/TjcLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer l\'email. Vérifiez l\'adresse saisie.',
        variant: 'destructive',
      });
      return;
    }

    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TjcLogo size="xl" />
          </div>
          <p className="text-xs text-muted-foreground">Espace partenaires</p>
        </div>

        <div className="rounded-lg border bg-card p-5">
          {sent ? (
            <div className="text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="text-sm font-semibold">Email envoyé !</p>
              <p className="text-xs text-muted-foreground">
                Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.<br />
                Vérifiez votre boîte mail (et vos spams).
              </p>
              <Link to="/login" className="text-xs text-primary underline block pt-1">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-center mb-1">Mot de passe oublié</p>
              <p className="text-xs text-muted-foreground text-center mb-4">
                Saisissez votre email pour recevoir un lien de réinitialisation.
              </p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
                <Button type="submit" className="w-full h-10 text-sm" disabled={isLoading}>
                  {isLoading
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Envoi...</>
                    : 'Envoyer le lien'}
                </Button>
              </form>
              <div className="mt-3 text-center">
                <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
