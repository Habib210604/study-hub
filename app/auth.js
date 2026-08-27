'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';
import { Lock, Mail, UserPlus, LogIn, User, Shield, ArrowRight, Phone, GraduationCap } from 'lucide-react';

const EDUCATION_LEVELS = [
  'Primaire',
  '7ème',
  '8ème',
  '9ème',
  '1ère',
  '2ème',
  '3ème',
  'Bac',
  'Université',
];

const BAC_FILIERES = [
  'Mathématiques',
  'Sciences Expérimentales',
  'Économie et Gestion',
  'Informatique',
  'Sport',
  'Technique',
  'Lettres',
];

const DEUXIEME_FILIERES = ['Mathématiques', 'Sciences', 'Lettres', 'Sport', 'Economies'];

// Which grades require a filière, and which list of filières they use.
// 1ère has no filière — students only pick their filière starting in 2ème.
const FILIERE_MAP = {
  '2ème': DEUXIEME_FILIERES,
  '3ème': BAC_FILIERES,
  'Bac': BAC_FILIERES,
};

export default function Auth({ onLogin }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // 'student' | 'admin'
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // --- New signup-only fields ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [filiere, setFiliere] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    if (isSignUp) {
      // Basic validation for the required signup fields
      if (!firstName.trim() || !lastName.trim() || !phone.trim() || !educationLevel) {
        setErrorMsg('Please fill in your name, phone number, and education level.');
        setLoading(false);
        return;
      }
      if (FILIERE_MAP[educationLevel] && !filiere) {
        setErrorMsg(`Please select your ${educationLevel} filière.`);
        setLoading(false);
        return;
      }
      // Loose Tunisian phone check: 8 digits, optional +216 prefix
      const cleanedPhone = phone.replace(/\s/g, '');
      if (!/^(\+216)?\d{8}$/.test(cleanedPhone)) {
        setErrorMsg('Please enter a valid Tunisian phone number (8 digits).');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: cleanedPhone,
            education_level: educationLevel,
            filiere: FILIERE_MAP[educationLevel] ? filiere : null,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setInfoMsg('Check your email for the confirmation link!');
      }
      setLoading(false);
      return;
    }

    // --- Login flow ---
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // Look up the REAL role from the database — never trust the tab the user clicked.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setErrorMsg('Could not verify your account. Please contact support.');
      setLoading(false);
      return;
    }

    if (role === 'admin' && profile.role !== 'admin') {
      await supabase.auth.signOut();
      setErrorMsg('Access denied: You are not authorized as an Admin.');
      setLoading(false);
      return;
    }

    setLoading(false);

    if (profile.role === 'admin') {
      router.push('/admin-dashboard');
    } else {
      onLogin();
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setInfoMsg('Password reset link sent! Check your email inbox.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl my-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Study Hub Account' : 'Welcome Back'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {isForgotPassword
              ? 'Enter your email to receive a password reset link'
              : isSignUp
              ? 'Sign up to sync your study goals'
              : 'Log in to your study dashboard'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl mb-4">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs p-3 rounded-xl mb-4">
            {infoMsg}
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-500" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? 'Sending Link...' : (<><ArrowRight size={18} /> Send Reset Link</>)}
            </button>

            <button
              type="button"
              onClick={() => { setIsForgotPassword(false); setErrorMsg(''); setInfoMsg(''); }}
              className="w-full text-center text-xs text-slate-400 hover:text-teal-400 transition mt-2"
            >
              Back to Sign In
            </button>
          </form>
        ) : (
          <>
            {!isSignUp && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    role === 'student' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User size={14} /> Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    role === 'admin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield size={14} /> Admin
                </button>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">

              {isSignUp && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Habib"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Souani"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 text-slate-500" size={18} />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+216 XX XXX XXX"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Class / Grade</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-2.5 text-slate-500" size={18} />
                      <select
                        required
                        value={educationLevel}
                        onChange={(e) => {
                          setEducationLevel(e.target.value);
                          if (!FILIERE_MAP[e.target.value]) setFiliere('');
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-teal-500 appearance-none"
                      >
                        <option value="" disabled>Select your class/grade...</option>
                        {EDUCATION_LEVELS.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {FILIERE_MAP[educationLevel] && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{educationLevel} Filière</label>
                      <select
                        required
                        value={filiere}
                        onChange={(e) => setFiliere(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-teal-500 appearance-none"
                      >
                        <option value="" disabled>Select your filière...</option>
                        {FILIERE_MAP[educationLevel].map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {!isSignUp && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setErrorMsg(''); setInfoMsg(''); }}
                    className="text-xs text-teal-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="text-sm">Processing...</span>
                ) : isSignUp ? (
                  <>
                    <UserPlus size={18} /> Sign Up
                  </>
                ) : (
                  <>
                    <LogIn size={18} /> {`Sign in as ${role === 'admin' ? 'Admin' : 'Student'}`}
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-6">
              <button
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setInfoMsg(''); }}
                className="text-xs text-slate-400 hover:text-teal-400 transition"
              >
                {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}