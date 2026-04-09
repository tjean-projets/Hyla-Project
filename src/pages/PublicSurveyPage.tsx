import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Loader2, Share2 } from 'lucide-react';

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'choice' | 'text';
  choices?: string[];
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  is_active: boolean;
}

export default function PublicSurveyPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!surveyId) return;
    supabase
      .from('social_surveys')
      .select('*')
      .eq('id', surveyId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        setSurvey(data ? { ...data, questions: data.questions as SurveyQuestion[] } : null);
        setLoading(false);
      });
  }, [surveyId]);

  const allAnswered = survey?.questions
    .filter(q => q.type === 'choice')
    .every(q => answers[q.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!survey) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await supabase.from('social_survey_responses').insert({
      survey_id: survey.id,
      answers,
      respondent_name: name.trim() || null,
      respondent_phone: phone.trim() || null,
    });
    if (err) {
      setError('Une erreur est survenue, réessaie.');
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  const inputClass = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white';

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
    </div>
  );

  if (!survey) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
        <p className="text-gray-500">Sondage introuvable ou inactif.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
        <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Merci !</h1>
        <p className="text-sm text-gray-500">Tes réponses ont bien été enregistrées.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold mb-4">
            <Share2 className="h-3.5 w-3.5" />
            HYLA
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
          {survey.description && (
            <p className="text-sm text-gray-500 mt-1">{survey.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Questions */}
          {survey.questions.map((q, qi) => (
            <div key={q.id} className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                <span className="text-blue-500 mr-2">{qi + 1}.</span>{q.text}
              </p>
              {q.type === 'choice' ? (
                <div className="space-y-2">
                  {(q.choices || []).map(choice => (
                    <label
                      key={choice}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        answers[q.id] === choice
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 hover:border-blue-200'
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 transition-all ${
                        answers[q.id] === choice ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {answers[q.id] === choice && (
                          <div className="h-full w-full rounded-full bg-white scale-[0.4]" />
                        )}
                      </div>
                      <span className="text-sm text-gray-800">{choice}</span>
                      <input
                        type="radio"
                        name={q.id}
                        value={choice}
                        checked={answers[q.id] === choice}
                        onChange={() => setAnswers({ ...answers, [q.id]: choice })}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className={inputClass + ' h-24 resize-none'}
                  placeholder="Ta réponse..."
                />
              )}
            </div>
          ))}

          {/* Coordonnées (optionnel) */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Tes coordonnées <span className="text-gray-400 font-normal">(optionnel)</span></p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ton prénom"
              className={inputClass}
            />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ton téléphone"
              className={inputClass}
            />
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !allAnswered}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all text-sm shadow-lg shadow-blue-500/20"
          >
            {submitting ? 'Envoi...' : 'Envoyer mes réponses'}
          </button>

          <p className="text-center text-[10px] text-gray-400">Hyla Assistant</p>
        </form>
      </div>
    </div>
  );
}
