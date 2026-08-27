'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/supabase';
import { FileText, Lock, Download, Loader2, ClipboardList, BookOpenCheck, Clock } from 'lucide-react';

const EDUCATION_LEVELS = ['Primaire', '7ème', '8ème', '9ème', '1ère', '2ème', '3ème', 'Bac', 'Université'];
const FILIERE_MAP = {
  '2ème': ['Mathématiques', 'Sciences', 'Lettres', 'Sport'],
  '3ème': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
  'Bac': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
};

export default function ResourceDrive() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [filiereFilter, setFiliereFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'exercise_set' | 'summary'
  const [unlocking, setUnlocking] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Default the filters to the student's own class/filière, but they can browse others
        const { data: profile } = await supabase
          .from('profiles')
          .select('education_level, filiere')
          .eq('id', session.user.id)
          .single();
        if (profile?.education_level) {
          setLevelFilter(profile.education_level);
          setFiliereFilter(profile.filiere || '');
        }
      }
      await fetchResources();
      setLoading(false);
    };
    init();
  }, []);

  const fetchResources = async () => {
    const { data, error } = await supabase
      .from('resources_view')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setResources(data);
  };

  const filtered = resources.filter((r) => {
    if (levelFilter && r.education_level !== levelFilter) return false;
    if (filiereFilter && r.filiere !== filiereFilter) return false;
    if (typeFilter !== 'all' && r.resource_type !== typeFilter) return false;
    return true;
  });

  const goUnlock = (resource) => {
    router.push(`/pay?resource=${resource.id}`);
  };

  return (
    <div>
      <div className="mb-5">
        <h3 className="font-bold text-lg text-[var(--text)] flex items-center gap-2">
          <BookOpenCheck size={20} className="text-amber-400" /> Drive — Exercises & Course Summaries
        </h3>
        <p className="text-[var(--text-muted)] text-xs mt-0.5">
          Browse free and paid exercise sets and course summaries, filtered by class and filière.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setFiliereFilter(''); }}
          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
        >
          <option value="">All classes</option>
          {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        {FILIERE_MAP[levelFilter] && (
          <select
            value={filiereFilter}
            onChange={(e) => setFiliereFilter(e.target.value)}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
          >
            <option value="">All filières</option>
            {FILIERE_MAP[levelFilter].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}

        <div className="flex gap-1 border border-[var(--border)] rounded-lg p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'exercise_set', label: 'Exercises' },
            { key: 'summary', label: 'Summaries' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                typeFilter === t.key ? 'bg-amber-500/20 text-amber-300' : 'text-[var(--text-muted)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resource grid */}
      {loading ? (
        <p className="text-[var(--text-muted)] text-xs text-center py-8">Loading resources...</p>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--text-muted)] text-xs text-center py-8">No resources match these filters yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const canAccess = r.is_free || r.unlocked;
            return (
              <div key={r.id} className="border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                      {r.resource_type === 'summary' ? 'Résumé' : 'Exercise Set'}
                    </span>
                    {r.is_free ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">Free</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">{r.price} DT</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-[var(--text)]">{r.title}</h4>
                  {r.description && <p className="text-xs text-[var(--text-muted)] mt-1">{r.description}</p>}
                  <p className="text-[10px] text-[var(--text-faint)] mt-2">
                    {r.education_level}{r.filiere ? ` · ${r.filiere}` : ''}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border)] mt-3 space-y-1.5">
                  {canAccess ? (
                    r.resource_type === 'summary' ? (
                      <a
                        href={r.summary_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 py-2 rounded-lg transition cursor-pointer"
                      >
                        <Download size={13} /> Download Summary
                      </a>
                    ) : (
                      <>
                        <a
                          href={r.exercise_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 py-2 rounded-lg transition cursor-pointer"
                        >
                          <ClipboardList size={13} /> Exercise
                        </a>
                        <a
                          href={r.correction_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 py-2 rounded-lg transition cursor-pointer"
                        >
                          <FileText size={13} /> Correction
                        </a>
                      </>
                    )
                  ) : r.purchase_pending ? (
                    <div className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-slate-800/50 text-slate-400 py-2 rounded-lg">
                      <Clock size={13} /> Pending verification
                    </div>
                  ) : (
                    <button
                      onClick={() => goUnlock(r)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-500 hover:brightness-110 text-slate-900 py-2 rounded-lg transition cursor-pointer"
                    >
                      <Lock size={13} /> Unlock for {r.price} DT
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}