import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { TjcLogo } from '@/components/TjcLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({ title: 'Erreur de connexion', description: 'Email ou mot de passe incorrect.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    toast({ title: 'Connexion réussie' });
    navigate('/dashboard');
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
          <p className="text-sm font-semibold text-center mb-4">Connexion</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Mot de passe</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" />
            </div>
            <Button type="submit" className="w-full h-10 text-sm" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Connexion...</> : 'Se connecter'}
            </Button>
            <div className="text-center pt-1">
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline">
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
