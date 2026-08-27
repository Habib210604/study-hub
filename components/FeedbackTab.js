'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/supabase';
import { Star, MessageCircle, Send, CheckCircle2, Loader2 } from 'lucide-react';

const WHATSAPP_NUMBER = '21650581498';
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;

export default function FeedbackTab() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    supabase
      .from('reviews_stats')
      .select('*')
      .single()
      .then(({ data }) => setStats(data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating && !message.trim()) return;

    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('reviews').insert([{
      user_id: session.user.id,
      rating: rating || null,
      message: message.trim() || null,
    }]);

    if (!error) {
      setSubmitted(true);
      setRating(0);
      setMessage('');
      // refresh the public average
      const { data } = await supabase.from('reviews_stats').select('*').single();
      setStats(data);
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <h3 className="font-bold text-lg text-[var(--text)]">Reviews & Contact</h3>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Rate the service, share ideas to improve it, or reach out directly.
        </p>
        {stats && stats.total_reviews > 0 && (
          <div className="inline-flex items-center gap-1.5 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5">
            <Star size={14} className="text-amber-400 fill-amber-400" />
            <span className="text-sm font-semibold text-amber-300">{stats.average_rating}</span>
            <span className="text-xs text-[var(--text-muted)]">({stats.total_reviews} review{stats.total_reviews === 1 ? '' : 's'})</span>
          </div>
        )}
      </div>

      {/* WhatsApp direct contact */}
      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold py-3 rounded-xl transition"
      >
        <MessageCircle size={16} /> Message us on WhatsApp
      </a>

      {/* Rating + note form */}
      <div className="border border-[var(--border)] rounded-2xl p-6">
        {submitted ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 size={32} className="text-teal-400 mx-auto" />
            <p className="text-sm text-[var(--text)] font-medium">Thanks for your feedback!</p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs text-teal-400 hover:underline cursor-pointer"
            >
              Leave another note
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Rate our service</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="cursor-pointer"
                  >
                    <Star
                      size={26}
                      className={
                        n <= (hoverRating || rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-[var(--text-faint)]'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
                Leave a note, review, or an idea to improve the site
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think, or how we could promote the site better..."
                rows={4}
                className="w-full bg-transparent border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text)] focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || (!rating && !message.trim())}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Submit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}