'use client';

import { useState, useEffect } from 'react';

export default function NotificationToggle() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  // Load user preference on startup
  useEffect(() => {
    const preference = localStorage.getItem('email_notifications');
    if (preference !== null) {
      setEmailEnabled(preference === 'true');
    }
  }, []);

  const handleToggle = () => {
    const newValue = !emailEnabled;
    setEmailEnabled(newValue);
    localStorage.setItem('email_notifications', String(newValue));
    
    // Show a quick "Saved!" badge feedback
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">Email Reminders</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Receive automated email alerts for upcoming exams and events.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {saved && <span className="text-xs text-emerald-600 font-medium animate-pulse">Saved!</span>}
        
        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          type="button"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            emailEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              emailEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}