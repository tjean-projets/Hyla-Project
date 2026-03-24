import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Target, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface FormQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  options?: string[];
  required: boolean;
}

export default function ObjectifForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [memberName, setMemberName] = useState('');
  const [customQuestions, setCustomQuestions] = useState<FormQuestion[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    objectif_mois: '',
    objectif_3mois: '',
    objectif_1an: '',
    actions: '',
    ventes_objectif_mois: 0,
    ventes_objectif_3mois: 0,
    ventes_objectif_1an: 0,
    recrues_objectif_mois: 0,
    recrues_objectif_3mois: 0,
    recrues_objectif_1an: 0,
  });

  useEffect(() => {
    if (!token) return;
    loadObjective();
  }, [token]);

  async function loadObjective() {
    setLoading(true);
    // Load the objective record
    const { data, error: err } = await supabase
      .from('member_objectives')
      .select('*, team_members(first_name, last_name)')
      .eq('token', token)
      .maybeSingle();

    if (err || !data) {
      setError('Lien invalide ou expiré');
      setLoading(false);
      return;
    }

    const member = (data as any).team_members;
    if (member) setMemberName(`${member.first_name} ${member.last_name}`);

    setForm({
      objectif_mois: data.objectif_mois || '',
      objectif_3mois: data.objectif_3mois || '',
      objectif_1an: data.objectif_1an || '',
      actions: data.actions || '',
      ventes_objectif_mois: data.ventes_objectif_mois || 0,
      ventes_objectif_3mois: data.ventes_objectif_3mois || 0,
      ventes_objectif_1an: data.ventes_objectif_1an || 0,
      recrues_objectif_mois: data.recrues_objectif_mois || 0,
      recrues_objectif_3mois: data.recrues_objectif_3mois || 0,
      recrues_objectif_1an: data.recrues_objectif_1an || 0,
    });

    // Load existing custom answers
    if (data.custom_answers) {
      const answers = data.custom_answers as unknown as Record<string, string>;
      setCustomAnswers(answers);
    }

    // Load custom questions from form config
    const { data: config } = await supabase
      .from('objectif_form_config')
      .select('questions')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (config?.questions) {
      setCustomQuestions(config.questions as unknown as FormQuestion[]);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error: err } = await supabase
      .from('member_objectives')
      .update({
        ...form,
        custom_answers: customAnswers as unknown as Record<string, unknown>,
        filled_by_member: true,
        filled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (err) {
      setError('Erreur lors de la sauvegarde');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !form.objectif_mois && !saving) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Objectifs enregistrés !</h1>
          <p className="text-sm text-gray-500">Merci {memberName}, tes objectifs ont bien été transmis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold mb-3">
            <Target className="h-4 w-4" />
            HYLA ASSISTANT
          </div>
          <h1 className="text-xl font-bold text-gray-900">Mes objectifs</h1>
          {memberName && <p className="text-sm text-gray-500 mt-1">{memberName}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ce mois-ci */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-3">Ce mois-ci</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Mon objectif principal</label>
                <textarea value={form.objectif_mois} onChange={(e) => setForm({ ...form, objectif_mois: e.target.value })}
                  placeholder="Ex: Vendre 3 Hyla, faire 5 démos..." rows={2} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Ventes visées</label>
                  <input type="number" min="0" value={form.ventes_objectif_mois}
                    onChange={(e) => setForm({ ...form, ventes_objectif_mois: parseInt(e.target.value) || 0 })}
                    className={inputClass + ' text-center'} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Recrues visées</label>
                  <input type="number" min="0" value={form.recrues_objectif_mois}
                    onChange={(e) => setForm({ ...form, recrues_objectif_mois: parseInt(e.target.value) || 0 })}
                    className={inputClass + ' text-center'} />
                </div>
              </div>
            </div>
          </div>

          {/* Dans 3 mois */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-3">Dans 3 mois</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Où je veux en être</label>
                <textarea value={form.objectif_3mois} onChange={(e) => setForm({ ...form, objectif_3mois: e.target.value })}
                  placeholder="Ex: Passer Manager, avoir 4 partenaires actifs..." rows={2} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Ventes visées</label>
                  <input type="number" min="0" value={form.ventes_objectif_3mois}
                    onChange={(e) => setForm({ ...form, ventes_objectif_3mois: parseInt(e.target.value) || 0 })}
                    className={inputClass + ' text-center'} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Recrues visées</label>
                  <input type="number" min="0" value={form.recrues_objectif_3mois}
                    onChange={(e) => setForm({ ...form, recrues_objectif_3mois: parseInt(e.target.value) || 0 })}
                    className={inputClass + ' text-center'} />
                </div>
              </div>
            </div>
          </div>

          {/* Dans 1 an */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-3">Dans 1 an</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Ma vision</label>
                <textarea value={form.objectif_1an} onChange={(e) => setForm({ ...form, objectif_1an: e.target.value })}
                  placeholder="Ex: Revenu de 2000€/mois, équipe de 10 personnes..." rows={2} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Ventes visées</label>
                  <input type="number" min="0" value={form.ventes_objectif_1an}
                    onChange={(e) => setForm({ ...form, ventes_objectif_1an: parseInt(e.target.value) || 0 })}
                    className={inputClass + ' text-center'} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Recrues visées</label>
                  <input type="number" min="0" value={form.recrues_objectif_1an}
                    onChange={(e) => setForm({ ...form, recrues_objectif_1an: parseInt(e.target.value) || 0 })}
                    className={inputClass + ' text-center'} />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-violet-600 uppercase tracking-wider mb-3">Mes actions</h2>
            <textarea value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })}
              placeholder="Ex: Je poste 3x/semaine sur Instagram, je fais 2 démos/semaine, je contacte 5 prospects/jour..."
              rows={3} className={inputClass} />
          </div>

          {/* Custom questions */}
          {customQuestions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Questions complémentaires</h2>
              <div className="space-y-4">
                {customQuestions.map((q) => (
                  <div key={q.id}>
                    <label className="text-xs font-medium text-gray-500 block mb-1">
                      {q.label}{q.required && ' *'}
                    </label>
                    {q.type === 'text' && (
                      <input
                        value={customAnswers[q.id] || ''}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        required={q.required}
                        className={inputClass}
                      />
                    )}
                    {q.type === 'textarea' && (
                      <textarea
                        value={customAnswers[q.id] || ''}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        required={q.required}
                        rows={2}
                        className={inputClass}
                      />
                    )}
                    {q.type === 'number' && (
                      <input
                        type="number"
                        value={customAnswers[q.id] || ''}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        required={q.required}
                        className={inputClass + ' text-center'}
                      />
                    )}
                    {q.type === 'select' && (
                      <select
                        value={customAnswers[q.id] || ''}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        required={q.required}
                        className={inputClass}
                      >
                        <option value="">Sélectionner...</option>
                        {(q.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform text-sm"
          >
            {saving ? 'Enregistrement...' : 'Valider mes objectifs'}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-400 mt-6">Hyla Assistant — Formulaire objectifs partenaire</p>
      </div>
    </div>
  );
}
