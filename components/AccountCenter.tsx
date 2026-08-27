'use client';

import { useState, useEffect } from 'react';
import { User, GraduationCap, Lock, Check, Phone } from 'lucide-react';
import { supabase } from '@/app/supabase';

// Keep these in sync with app/admin-dashboard/page.tsx (EDUCATION_LEVELS_FOR_TARGETING / FILIERE_TARGETING_MAP)
const EDUCATION_LEVELS = [
  'Primaire', '7ème', '8ème', '9ème', '1ère', '2ème', '3ème', 'Bac', 'Université',
];

const FILIERE_MAP: Record<string, string[]> = {
  '2ème': ['Mathématiques', 'Sciences', 'Lettres', 'Sport'],
  '3ème': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
  'Bac': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
};

type Section = 'profile' | 'class' | 'security';

export default function AccountCenter({ session }: { session: any }) {
    console.log('AccountCenter mounted, session:', session);
  const [section, setSection] = useState<Section>('profile');
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [educationLevel, setEducationLevel] = useState('');
  const [filiere, setFiliere] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetchProfile();
  }, [session]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, education_level, filiere')
      .eq('id', session.user.id)
      .single();

    if (error) {
      setMessage({ type: 'error', text: 'Could not load your profile: ' + error.message });
    } else if (data) {
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPhone(data.phone || '');
      setEducationLevel(data.education_level || '');
      setFiliere(data.filiere || '');
    }
    setLoading(false);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      })
      .eq('id', session.user.id);

    setSaving(false);
    setMessage(
      error
        ? { type: 'error', text: error.message }
        : { type: 'success', text: 'Profile updated.' }
    );
  };

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        education_level: educationLevel,
        // Clear filiere if the newly picked grade doesn't use filières
        filiere: FILIERE_MAP[educationLevel] ? filiere : null,
      })
      .eq('id', session.user.id);

    setSaving(false);
    setMessage(
      error
        ? { type: 'error', text: error.message }
        : { type: 'success', text: 'Class updated.' }
    );
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords don't match." });
      return;
    }

    setSaving(true);

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });

    if (verifyError) {
      setSaving(false);
      setMessage({ type: 'error', text: 'Current password is incorrect.' });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const SECTIONS: { key: Section; label: string; icon: any }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'class', label: 'Class', icon: GraduationCap },
    { key: 'security', label: 'Security', icon: Lock },
  ];

 console.log('AccountCenter render — session:', session, 'loading:', loading);

if (loading) {
  return <div className="text-red-500 text-lg py-8 text-center font-bold">DEBUG: STILL LOADING — session user id: {session?.user?.id || 'NO SESSION'}</div>;
}

  return (
    <div className="max-w-xl">
      <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2 mb-5">
        <User size={15} className="text-[var(--accent-indigo)]" /> Account Center
      </h3>

      <div className="flex space-x-1 mb-6 border border-[var(--border)] p-1 rounded-lg w-fit">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => { setSection(s.key); setMessage(null); }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                section === s.key ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={13} /> {s.label}
            </button>
          );
        })}
      </div>

      {section === 'profile' && (
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Email</label>
            <input
              value={session?.user?.email ?? ''}
              disabled
              className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-muted)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">First name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Last name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1">
              <Phone size={11} /> Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
            />
          </div>
          {message && (
            <p className={`text-xs flex items-center gap-1.5 ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {message.type === 'success' && <Check size={13} />} {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      )}

      {section === 'class' && (
        <form onSubmit={saveClass} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Current class / grade</label>
            <select
              value={educationLevel}
              onChange={(e) => { setEducationLevel(e.target.value); setFiliere(''); }}
              className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
            >
              <option value="" disabled className="bg-[var(--panel)]">Select a class</option>
              {EDUCATION_LEVELS.map((l) => (
                <option key={l} value={l} className="bg-[var(--panel)]">{l}</option>
              ))}
            </select>
          </div>

          {FILIERE_MAP[educationLevel] && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Filière</label>
              <select
                value={filiere}
                onChange={(e) => setFiliere(e.target.value)}
                className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
              >
                <option value="" disabled className="bg-[var(--panel)]">Select a filière</option>
                {FILIERE_MAP[educationLevel].map((f) => (
                  <option key={f} value={f} className="bg-[var(--panel)]">{f}</option>
                ))}
              </select>
            </div>
          )}

          {message && (
            <p className={`text-xs flex items-center gap-1.5 ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {message.type === 'success' && <Check size={13} />} {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Updating...' : 'Update class'}
          </button>
        </form>
      )}

      {section === 'security' && (
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-indigo-400/50"
            />
          </div>
          {message && (
            <p className={`text-xs flex items-center gap-1.5 ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {message.type === 'success' && <Check size={13} />} {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Updating...' : 'Change password'}
          </button>
        </form>
      )}
    </div>
  );
}