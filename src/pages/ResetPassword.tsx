import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { TjcLogo } from '@/components/TjcLogo';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Supabase sends the user back with a session via URL hash — wait for auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({ title: 'Mot de passe trop court', description: 'Minimum 8 caractères.', variant: 'destructive' });
      return;
    }

    if (password !== confirm) {
      toast({ title: 'Mots de passe différents', description: 'Les deux mots de passe ne correspondent pas.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: '✅ Mot de passe mis à jour !', description: 'Vous allez être redirigé.' });
    setTimeout(() => navigate('/login'), 2000);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <TjcLogo size="xl" />
          </div>
          <p className="text-xs text-muted-foreground">Vérification du lien en cours…</p>
          <p className="text-xs text-muted-foreground">
            Si rien ne se passe, le lien a peut-être expiré.{' '}
            <a href="/forgot-password" className="underline">Recommencer</a>
          </p>
        </div>
      </div>
    );
  }

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
          <p className="text-sm font-semibold text-center mb-1">Nouveau mot de passe</p>
          <p className="text-xs text-muted-foreground text-center mb-4">
            Choisissez un nouveau mot de passe sécurisé.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <Button type="submit" className="w-full h-10 text-sm" disabled={isLoading}>
              {isLoading
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Mise à jour...</>
                : 'Mettre à jour'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
