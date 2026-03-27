import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
              Connectez-vous à votre espace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-xs text-white/30 hover:text-white/60 transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
