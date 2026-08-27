'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/supabase';
import { Plus, Trash2, ArrowLeft, StickyNote, Check, Loader2 } from 'lucide-react';

function formatLastEdited(dateStr) {
  const d = new Date(dateStr);
  const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} at ${timeLabel}`;
}

export default function NotesApp() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const userIdRef = useRef(null);
  const saveTimeout = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) userIdRef.current = session.user.id;
      await fetchNotes();
    };
    init();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    if (!error && data) setNotes(data);
    setLoading(false);
  };

  const openNote = (note) => {
    setActiveNoteId(note.id);
    setTitle(note.title || '');
    setContent(note.content || '');
    setSaveStatus('idle');
  };

  const createNote = async () => {
    if (!userIdRef.current) return;
    const { data, error } = await supabase
      .from('notes')
      .insert([{ user_id: userIdRef.current, title: '', content: '' }])
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      openNote(data);
    }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this note? This can\'t be undone.')) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
    await supabase.from('notes').delete().eq('id', id);
  };

  const scheduleSave = (nextTitle, nextContent) => {
    setSaveStatus('saving');
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      if (!activeNoteId) return;
      const now = new Date().toISOString();
      await supabase
        .from('notes')
        .update({ title: nextTitle, content: nextContent, updated_at: now })
        .eq('id', activeNoteId);

      setNotes((prev) =>
        prev
          .map((n) => (n.id === activeNoteId ? { ...n, title: nextTitle, content: nextContent, updated_at: now } : n))
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      );
      setSaveStatus('saved');
    }, 700);
  };

  const handleTitleChange = (val) => {
    setTitle(val);
    scheduleSave(val, content);
  };

  const handleContentChange = (val) => {
    setContent(val);
    // If there's no title yet, derive one from the first line, like Apple Notes does
    const derivedTitle = title.trim() ? title : val.split('\n')[0].slice(0, 60);
    if (!title.trim()) setTitle(derivedTitle);
    scheduleSave(title.trim() ? title : derivedTitle, val);
  };

  const activeNote = notes.find((n) => n.id === activeNoteId);

  // ============ EDITOR VIEW ============
  if (activeNoteId) {
    return (
      <div className="flex flex-col h-[65vh]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
          <button onClick={() => setActiveNoteId(null)} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer">
            <ArrowLeft size={16} /> All Notes
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-faint)]">
              {saveStatus === 'saving' ? (
                <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Saving...</span>
              ) : saveStatus === 'saved' ? (
                <span className="flex items-center gap-1 text-teal-400"><Check size={11} /> Saved</span>
              ) : activeNote ? (
                `Last edited ${formatLastEdited(activeNote.updated_at)}`
              ) : ''}
            </span>
            <button onClick={(e) => deleteNote(e, activeNoteId)} className="text-[var(--text-muted)] hover:text-red-400 transition cursor-pointer">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Title"
          className="bg-transparent text-lg font-semibold text-[var(--text)] focus:outline-none mb-2 placeholder:text-[var(--text-faint)]"
        />
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start typing..."
          className="flex-1 bg-transparent text-sm text-[var(--text)] focus:outline-none resize-none placeholder:text-[var(--text-faint)]"
          autoFocus
        />
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-[var(--text)] flex items-center gap-2">
          <StickyNote size={18} className="text-yellow-400" /> Notes
        </h3>
        <button
          onClick={createNote}
          className="flex items-center gap-1.5 text-xs font-semibold bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <Plus size={14} /> New Note
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)] text-xs text-center py-8">Loading notes...</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-10">
          <StickyNote size={28} className="text-[var(--text-faint)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-muted)]">No notes yet.</p>
          <button onClick={createNote} className="text-xs text-yellow-400 hover:underline mt-1 cursor-pointer">Create your first note</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => openNote(note)}
              className="border border-[var(--border)] hover:border-yellow-500/30 rounded-xl p-3.5 cursor-pointer transition flex items-start justify-between gap-3 group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text)] truncate">{note.title || 'New Note'}</p>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  {note.content?.split('\n').slice(1).join(' ').trim() || note.content || 'No additional text'}
                </p>
                <p className="text-[10px] text-[var(--text-faint)] mt-1">{formatLastEdited(note.updated_at)}</p>
              </div>
              <button
                onClick={(e) => deleteNote(e, note.id)}
                className="opacity-0 group-hover:opacity-100 text-[var(--text-faint)] hover:text-red-400 transition p-1 cursor-pointer shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}