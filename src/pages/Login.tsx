import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (mode === 'register') {
      if (!fullName.trim()) {
        toast({ title: 'Erreur', description: 'Veuillez entrer votre nom complet.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        toast({ title: 'Erreur', description: 'Le mot de passe doit contenir au moins 6 caractères.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: 'Erreur', description: 'Les mots de passe ne correspondent pas.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const { error } = await signUp(email, password, fullName.trim());
      if (error) {
        toast({ title: 'Erreur d\'inscription', description: error.message.includes('already registered') ? 'Cet email est déjà utilisé.' : error.message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      toast({ title: 'Compte créé !', description: 'Vérifiez votre email pour confirmer votre inscription.' });
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Erreur de connexion', description: 'Email ou mot de passe incorrect.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    toast({ title: 'Connexion réussie' });
    navigate('/dashboard');
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setPassword('');
    setConfirmPassword('');
  };

  const inputClass = "w-full h-12 px-4 bg-white/[0.06] border border-white/[0.15] rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/hyla-bg.png)' }} />
      <div className="absolute inset-0 bg-black/30" />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.15] rounded-2xl p-8 shadow-2xl shadow-black/20">
          {/* Brand */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-white">HYLA</span>
              <span className="text-white/50 font-light ml-1.5">Assistant</span>
            </h1>
            <p className="text-white/30 text-xs mt-1">
              {mode === 'login' ? 'Connectez-vous à votre espace' : 'Créez votre compte'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <input
                type="text"
                placeholder="Nom complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
                autoComplete="name"
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              autoComplete="email"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass + ' pr-12'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {mode === 'register' && (
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputClass}
                autoComplete="new-password"
              />
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === 'login' ? 'Connexion...' : 'Inscription...'}
                </span>
              ) : (
                mode === 'login' ? 'Se connecter' : 'Créer mon compte'
              )}
            </button>

            {/* Switch mode */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={switchMode}
                className="text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                {mode === 'login' ? (
                  <>Pas encore de compte ? <span className="text-[#3b82f6] font-semibold">S'inscrire</span></>
                ) : (
                  <>Déjà un compte ? <span className="text-[#3b82f6] font-semibold">Se connecter</span></>
                )}
              </button>
            </div>

            {mode === 'login' && (
              <div className="text-center">
                <Link to="/forgot-password" className="text-xs text-white/30 hover:text-white/60 transition-colors">
                  Mot de passe oublié ?
                </Link>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
