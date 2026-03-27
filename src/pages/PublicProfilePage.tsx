import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Users, Info, Loader2, CheckCircle, Phone, Mail, MessageSquare, Sparkles } from 'lucide-react';

type Intent = 'acheter' | 'devenir_conseiller' | 'en_savoir_plus';

interface ProfileData {
  id: string;
  full_name: string;
  role: string;
}

export default function PublicProfilePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const [searchParams] = useSearchParams();
  const source = (searchParams.get('src') as 'bio' | 'story') || 'direct';

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    message: '',
  });

  useEffect(() => {
    if (!inviteCode) return;
    loadProfile();
  }, [inviteCode]);

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('invite_code', inviteCode!)
      .maybeSingle();

    if (data) setProfileData(data as ProfileData);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileData || !intent) return;
    setSubmitting(true);
    setError('');

    try {
      // Insert into public_leads table (requires anon INSERT RLS policy — see migration SQL)
      const { error: insertError } = await (supabase as any).from('public_leads').insert({
        profile_id: profileData.id,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        message: form.message.trim() || null,
        intent,
        source,
        status: 'nouveau',
      });

      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    }
    setSubmitting(false);
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
          <p className="text-gray-500">Page introuvable</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Merci {form.firstName} !</h1>
          <p className="text-sm text-gray-500">
            {profileData.full_name?.split(' ')[0]} vous recontactera très vite.
          </p>
        </div>
      </div>
    );
  }

  const roleLabel = profileData.role === 'manager' ? 'Manager Hyla' : 'Conseillère Hyla';
  const initials = profileData.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            HYLA
          </div>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold">
            {initials}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{profileData.full_name}</h1>
          <p className="text-sm text-blue-600 font-medium">{roleLabel}</p>
          <p className="text-xs text-gray-400 mt-1">Je vous accompagne dans votre découverte de Hyla</p>
        </div>

        {!intent ? (
          /* Action buttons */
          <div className="space-y-3">
            <button
              onClick={() => setIntent('acheter')}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform shadow-lg shadow-green-500/20"
            >
              <ShoppingBag className="h-6 w-6" />
              <div className="text-left">
                <p className="font-bold">Je veux acheter un Hyla</p>
                <p className="text-[11px] opacity-80">Découvrez nos solutions de filtration</p>
              </div>
            </button>

            <button
              onClick={() => setIntent('devenir_conseiller')}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform shadow-lg shadow-violet-500/20"
            >
              <Users className="h-6 w-6" />
              <div className="text-left">
                <p className="font-bold">Je veux devenir conseiller(ère)</p>
                <p className="text-[11px] opacity-80">Rejoignez l'aventure Hyla</p>
              </div>
            </button>

            <button
              onClick={() => setIntent('en_savoir_plus')}
              className="w-full flex items-center gap-3 p-4 bg-white border-2 border-blue-200 text-blue-700 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              <Info className="h-6 w-6" />
              <div className="text-left">
                <p className="font-bold">Je veux en savoir plus</p>
                <p className="text-[11px] text-gray-400">Recevez plus d'informations</p>
              </div>
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-gray-900">
                {intent === 'acheter'
                  ? 'Achat Hyla'
                  : intent === 'devenir_conseiller'
                  ? 'Devenir conseiller(ère)'
                  : 'En savoir plus'}
              </h2>
              <button
                type="button"
                onClick={() => setIntent(null)}
                className="text-xs text-blue-600 font-medium"
              >
                ← Retour
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Prénom *</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                  className={inputClass}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                  className={inputClass}
                  placeholder="Nom"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Téléphone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                  className={inputClass + ' pl-10'}
                  placeholder="06 XX XX XX XX"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass + ' pl-10'}
                  placeholder="optionnel"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className={inputClass + ' h-20 resize-none'}
                placeholder="Un message ? (optionnel)"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform text-sm"
            >
              {submitting ? 'Envoi...' : 'Envoyer'}
            </button>
          </form>
        )}

        <p className="text-center text-[10px] text-gray-400 mt-8">Hyla Assistant</p>
      </div>
    </div>
  );
}
