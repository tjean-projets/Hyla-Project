import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Sparkles, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function InscriptionPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [managerName, setManagerName] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!slug) return;
    loadMember();
  }, [slug]);

  async function loadMember() {
    setLoading(true);

    // Find the team member by slug
    const { data: member, error: err } = await supabase
      .from('team_members')
      .select('id, first_name, last_name, linked_user_id, user_id, email')
      .eq('slug', slug)
      .maybeSingle();

    if (err || !member) {
      setError('Lien d\'inscription invalide');
      setLoading(false);
      return;
    }

    if (member.linked_user_id) {
      setError('Ce compte a déjà été créé. Connectez-vous directement.');
      setLoading(false);
      return;
    }

    setMemberName(`${member.first_name} ${member.last_name}`);
    setMemberId(member.id);

    // Pre-fill email if available
    if (member.email) {
      setForm(f => ({ ...f, email: member.email! }));
    }

    // Get manager name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', member.user_id)
      .single();

    if (profile) setManagerName(profile.full_name || '');

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setSubmitting(true);

    // Create account
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: memberName },
      },
    });

    if (signUpError) {
      setError(signUpError.message === 'User already registered'
        ? 'Un compte existe déjà avec cet email. Connectez-vous directement.'
        : signUpError.message);
      setSubmitting(false);
      return;
    }

    // Link the new user to the team member
    if (authData.user) {
      await supabase
        .from('team_members')
        .update({ linked_user_id: authData.user.id })
        .eq('id', memberId);
    }

    setSubmitting(false);
    setSuccess(true);
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !form.email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Compte créé !</h1>
          <p className="text-sm text-gray-500 mb-4">
            Bienvenue {memberName} ! Ton espace Hyla Assistant est prêt.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-sm active:scale-[0.98]"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-bold mb-4">
            <Sparkles className="h-4 w-4" />
            HYLA ASSISTANT
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenue {memberName.split(' ')[0]} !
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {managerName ? `${managerName} t'invite à` : 'Tu es invité(e) à'} rejoindre Hyla Assistant.
            <br />Crée ton compte pour accéder à ton espace personnel.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ton@email.com"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 6 caractères"
                required
                minLength={8}
                className={inputClass + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Retapez le mot de passe"
              required
              className={inputClass}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform text-sm"
          >
            {submitting ? 'Création du compte...' : 'Créer mon espace Hyla Assistant'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Déjà un compte ?{' '}
            <button type="button" onClick={() => navigate('/login')} className="text-blue-600 font-medium">
              Se connecter
            </button>
          </p>
        </form>

        <p className="text-center text-[10px] text-gray-400 mt-6">
          Hyla Assistant — Espace partenaire
        </p>
      </div>
    </div>
  );
}
