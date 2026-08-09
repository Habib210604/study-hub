'use client';
import { useState } from 'react';
import { Sparkles, Brain, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';

export default function FlashcardGenerator() {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<{ question: string; answer: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const generateCards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    setLoading(true);
    try {
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

      const content = data.content || data.message || JSON.stringify(data);
      
      // Clean and parse JSON response from AI
      const cleanedJSON = typeof content === 'string' 
        ? content.replace(/```json/g, '').replace(/```/g, '').trim()
        : JSON.stringify(content);
        
      const parsedCards = JSON.parse(cleanedJSON);

      if (Array.isArray(parsedCards) && parsedCards.length > 0) {
        setFlashcards(parsedCards);
        setCurrentIndex(0);
        setIsFlipped(false);
      } else {
        throw new Error("AI did not return a valid array of flashcards.");
      }
    } catch (err: any) {
      console.error("Failed to generate flashcards:", err);
      alert(err.message || "Could not generate flashcards. Make sure your notes are clear!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-slate-200 flex items-center gap-2">
          <Brain size={20} className="text-teal-400" /> AI Flashcard Generator
        </h3>
      </div>
      <p className="text-slate-400 text-xs">
        Paste your lecture notes below and let AI automatically generate interactive study cards for your exams.
      </p>

      {flashcards.length === 0 ? (
        <form onSubmit={generateCards} className="space-y-3">
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
          {/* Card Viewer */}
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

          {/* Navigation Controls */}
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
    </div>
  );
}