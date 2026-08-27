'use client';
import { useState, useEffect } from 'react';
import { Sparkles, Brain, ChevronLeft, ChevronRight, RotateCw, Calendar, X, Check, RotateCcw } from 'lucide-react';
import { supabase } from '@/app/supabase';

const INTERVAL_SEQUENCE = [1, 3, 7, 14, 30, 60]; // days

export default function FlashcardGenerator() {
  const [mode, setMode] = useState('generate'); // 'generate' | 'review'
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [flashcards, setFlashcards] = useState([]); // freshly generated batch (in-memory browse)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [userId, setUserId] = useState(null);

  const [dueCards, setDueCards] = useState([]);
  const [loadingDue, setLoadingDue] = useState(true);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
    fetchDueCards();
  }, []);

  const fetchDueCards = async () => {
    setLoadingDue(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoadingDue(false); return; }

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', session.user.id)
      .lte('next_review_date', today)
      .order('next_review_date', { ascending: true });

    if (!error && data) setDueCards(data);
    setLoadingDue(false);
  };

  const [generateError, setGenerateError] = useState('');

  const callGenerateApi = async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `Generate 5 concise study flashcards (Question and Answer) based on these notes. Return ONLY a valid JSON array of objects with keys "question" and "answer". No markdown formatting or extra text. Notes: ${notes}`
          }
        ]
      })
    });

    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      throw new Error(`Server returned invalid response: ${responseText || 'Empty response'}`);
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || `Error ${response.status}: Failed to generate flashcards`);
    }
    return data;
  };

  const isOverloadError = (message) =>
    typeof message === 'string' &&
    (message.toLowerCase().includes('high demand') || message.toLowerCase().includes('overloaded') || message.toLowerCase().includes('503'));

  const generateCards = async (e) => {
    e.preventDefault();
    if (!notes.trim()) return;

    setLoading(true);
    setGenerateError('');

    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const data = await callGenerateApi();
        const content = data.content || data.message || JSON.stringify(data);
        const cleanedJSON = typeof content === 'string'
          ? content.replace(/```json/g, '').replace(/```/g, '').trim()
          : JSON.stringify(content);

        const parsedCards = JSON.parse(cleanedJSON);

        if (Array.isArray(parsedCards) && parsedCards.length > 0) {
          setFlashcards(parsedCards);
          setCurrentIndex(0);
          setIsFlipped(false);

          if (userId) {
            const rows = parsedCards.map((c) => ({
              user_id: userId,
              question: c.question,
              answer: c.answer,
              interval_days: 1,
              repetition_count: 0,
              next_review_date: new Date().toISOString().slice(0, 10),
            }));
            await supabase.from('flashcards').insert(rows);
            fetchDueCards();
          }
          setLoading(false);
          return; // success — stop retrying
        } else {
          throw new Error("AI did not return a valid array of flashcards.");
        }
      } catch (err) {
        lastError = err;
        // console.warn (not console.error) so Next.js's dev overlay doesn't treat
        // this handled, retryable error as an app crash.
        console.warn(`Flashcard generation attempt ${attempt} failed:`, err.message);

        if (isOverloadError(err.message) && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
          continue; // retry
        }
        break; // non-retryable error, or out of attempts
      }
    }

    // All attempts failed
    setGenerateError(
      isOverloadError(lastError?.message)
        ? "The AI is experiencing high demand right now. We tried a few times — please wait a moment and try again."
        : (lastError?.message || "Could not generate flashcards. Make sure your notes are clear!")
    );
    setLoading(false);
  };

  // --- Spaced repetition grading ---
  const gradeCard = async (grade) => {
    const card = dueCards[reviewIndex];
    if (!card || grading) return;
    setGrading(true);

    let newRepCount, newInterval;
    if (grade === 'again') {
      newRepCount = 0;
      newInterval = 1;
    } else if (grade === 'good') {
      newRepCount = card.repetition_count + 1;
      newInterval = INTERVAL_SEQUENCE[Math.min(newRepCount, INTERVAL_SEQUENCE.length - 1)];
    } else {
      // 'easy' — skip ahead an extra step
      newRepCount = card.repetition_count + 2;
      newInterval = INTERVAL_SEQUENCE[Math.min(newRepCount, INTERVAL_SEQUENCE.length - 1)];
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);

    await supabase
      .from('flashcards')
      .update({
        repetition_count: newRepCount,
        interval_days: newInterval,
        next_review_date: nextDate.toISOString().slice(0, 10),
      })
      .eq('id', card.id);

    const remaining = dueCards.filter((_, i) => i !== reviewIndex);
    setDueCards(remaining);
    setReviewIndex(0);
    setReviewFlipped(false);
    setGrading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-slate-200 flex items-center gap-2">
          <Brain size={20} className="text-teal-400" /> AI Flashcards
        </h3>
        <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setMode('generate')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${mode === 'generate' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}
          >
            Generate
          </button>
          <button
            onClick={() => setMode('review')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer relative ${mode === 'review' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}
          >
            Review {!loadingDue && dueCards.length > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{dueCards.length}</span>
            )}
          </button>
        </div>
      </div>

      {mode === 'generate' && (
        <>
          <p className="text-slate-400 text-xs">
            Paste your lecture notes below and let AI generate cards — they're saved automatically and will resurface for review at increasing intervals so you actually retain them.
          </p>

          {flashcards.length === 0 ? (
            <form onSubmit={generateCards} className="space-y-3">
              {generateError && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl p-3">
                  {generateError}
                </div>
              )}
              <textarea
                rows={4}
                placeholder="Paste your course notes, definitions, or summary here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-teal-500 resize-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> {loading ? 'Generating Cards...' : 'Generate Flashcards'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="h-48 bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:border-teal-500/50 transition relative group select-none shadow-lg"
              >
                <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                  <span>Card {currentIndex + 1} of {flashcards.length}</span>
                  <span className="flex items-center gap-1 text-teal-400">
                    <RotateCw size={12} /> Click to flip
                  </span>
                </div>
                <div className="text-center my-auto">
                  <p className="text-sm font-medium text-slate-200">
                    {isFlipped ? flashcards[currentIndex]?.answer : flashcards[currentIndex]?.question}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-2 block font-bold">
                    {isFlipped ? '— Answer —' : '— Question —'}
                  </span>
                </div>
                <div />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setIsFlipped(false); }}
                  disabled={currentIndex === 0}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => { setFlashcards([]); setIsFlipped(false); }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition"
                >
                  Start Over / New Notes
                </button>
                <button
                  onClick={() => { setCurrentIndex(Math.min(flashcards.length - 1, currentIndex + 1)); setIsFlipped(false); }}
                  disabled={currentIndex === flashcards.length - 1}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition flex items-center gap-1"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'review' && (
        <div>
          {loadingDue ? (
            <p className="text-slate-500 text-xs text-center py-8">Loading due cards...</p>
          ) : dueCards.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Calendar size={28} className="text-teal-500/50 mx-auto" />
              <p className="text-sm text-slate-300 font-medium">All caught up!</p>
              <p className="text-xs text-slate-500">No cards due for review right now. Generate more, or check back later.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onClick={() => setReviewFlipped(!reviewFlipped)}
                className="h-48 bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:border-teal-500/50 transition select-none shadow-lg"
              >
                <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                  <span>{dueCards.length} card{dueCards.length === 1 ? '' : 's'} due</span>
                  <span className="flex items-center gap-1 text-teal-400">
                    <RotateCw size={12} /> Click to flip
                  </span>
                </div>
                <div className="text-center my-auto">
                  <p className="text-sm font-medium text-slate-200">
                    {reviewFlipped ? dueCards[reviewIndex]?.answer : dueCards[reviewIndex]?.question}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-2 block font-bold">
                    {reviewFlipped ? '— Answer —' : '— Question —'}
                  </span>
                </div>
                <div />
              </div>

              {reviewFlipped ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => gradeCard('again')}
                    disabled={grading}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Again <span className="text-[10px] font-normal text-red-400/70">1 day</span>
                  </button>
                  <button
                    onClick={() => gradeCard('good')}
                    disabled={grading}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} /> Good
                  </button>
                  <button
                    onClick={() => gradeCard('easy')}
                    disabled={grading}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={14} /> Easy
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs text-slate-500">Flip the card, then grade how well you remembered it.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}