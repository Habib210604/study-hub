'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import {
  Megaphone, Users, Plus, Trash2, X, LogOut, Shield,
  CalendarDays, Target, Folder, Mail, Loader2, CheckSquare, Square
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('announcements'); // 'announcements' | 'users'

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [audienceMode, setAudienceMode] = useState('all'); // 'all' | 'specific'
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Users state (students only)
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Selected user detail state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userEvents, setUserEvents] = useState([]);
  const [userGoals, setUserGoals] = useState([]);
  const [userModules, setUserModules] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- Auth guard: only real admins get in ---
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.push('/');
        return;
      }

      setSession(session);
      setCheckingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    if (session) {
      fetchAnnouncements();
      fetchUsers();
    }
  }, [session]);

  // --- Announcements ---
  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data);
  };

  const toggleRecipient = (userId) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllRecipients = () => {
    if (selectedRecipientIds.length === users.length) {
      setSelectedRecipientIds([]);
    } else {
      setSelectedRecipientIds(users.map((u) => u.id));
    }
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;
    if (audienceMode === 'specific' && selectedRecipientIds.length === 0) {
      alert('Select at least one recipient, or switch to "All Users".');
      return;
    }

    setPostingAnnouncement(true);

    const { data, error } = await supabase
      .from('announcements')
      .insert([{
        title: newTitle.trim(),
        message: newMessage.trim(),
        is_global: audienceMode === 'all',
      }])
      .select();

    if (error || !data) {
      alert('Error posting announcement: ' + error?.message);
      setPostingAnnouncement(false);
      return;
    }

    const newAnnouncement = data[0];

    // If targeted, insert the recipient rows
    if (audienceMode === 'specific') {
      const targetRows = selectedRecipientIds.map((userId) => ({
        announcement_id: newAnnouncement.id,
        user_id: userId,
      }));
      const { error: targetError } = await supabase
        .from('announcement_targets')
        .insert(targetRows);

      if (targetError) {
        alert('Announcement posted, but failed to set recipients: ' + targetError.message);
      }
    }

    setAnnouncements([
      { ...newAnnouncement, _recipientCount: audienceMode === 'specific' ? selectedRecipientIds.length : null },
      ...announcements,
    ]);
    setNewTitle('');
    setNewMessage('');
    setAudienceMode('all');
    setSelectedRecipientIds([]);
    setPostingAnnouncement(false);
  };

  const deleteAnnouncement = async (id) => {
    setAnnouncements(announcements.filter((a) => a.id !== id));
    await supabase.from('announcements').delete().eq('id', id);
  };

  // --- Users (students only) ---
  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    if (!error && data) setUsers(data);
    setLoadingUsers(false);
  };

  const openUserDetail = async (user) => {
    setSelectedUser(user);
    setLoadingDetail(true);

    const [eventsRes, goalsRes, modulesRes] = await Promise.all([
      supabase.from('events').select('*').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('modules').select('*').eq('user_id', user.id),
    ]);

    setUserEvents(eventsRes.data || []);
    setUserGoals(goalsRes.data || []);
    setUserModules(modulesRes.data || []);
    setLoadingDetail(false);
  };

  const closeUserDetail = () => {
    setSelectedUser(null);
    setUserEvents([]);
    setUserGoals([]);
    setUserModules([]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Checking access...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-teal-500 rounded-xl text-white shadow">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-slate-400 text-xs transition cursor-pointer"
        >
          <LogOut size={16} /> Logout
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'announcements' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Megaphone size={16} /> Announcements
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={16} /> Users
          </button>
        </div>

        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <form onSubmit={postAnnouncement} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-slate-200">Post a New Announcement</h3>
              <input
                type="text"
                placeholder="Title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
              <textarea
                placeholder="Message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                required
              />

              {/* Audience selector */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Send to</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAudienceMode('all')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      audienceMode === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    All Users
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode('specific')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      audienceMode === 'specific' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Specific Users
                  </button>
                </div>

                {audienceMode === 'specific' && (
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <button
                      type="button"
                      onClick={selectAllRecipients}
                      className="text-xs text-blue-400 hover:underline cursor-pointer flex items-center gap-1.5"
                    >
                      {selectedRecipientIds.length === users.length ? <CheckSquare size={14} /> : <Square size={14} />}
                      {selectedRecipientIds.length === users.length ? 'Deselect All' : 'Select All'}
                    </button>

                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {users.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRecipientIds.includes(u.id)}
                            onChange={() => toggleRecipient(u.id)}
                            className="rounded border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-xs text-slate-300">{u.email}</span>
                        </label>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {selectedRecipientIds.length} of {users.length} selected
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={postingAnnouncement}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {postingAnnouncement ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Post Announcement
              </button>
            </form>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No announcements posted yet.</p>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-200 text-sm">{a.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          a.is_global
                            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        }`}>
                          {a.is_global ? 'All Users' : `${a._recipientCount ?? '?'} Selected`}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-1">{a.message}</p>
                      {a.created_at && (
                        <p className="text-slate-600 text-[11px] mt-2">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteAnnouncement(a.id)}
                      className="text-slate-600 hover:text-red-400 transition p-1 cursor-pointer shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {loadingUsers ? (
              <p className="text-slate-500 text-sm text-center py-8">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No student accounts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-500 text-xs uppercase">
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                      <td className="px-5 py-3 text-slate-200 flex items-center gap-2">
                        <Mail size={14} className="text-slate-500" /> {u.email}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openUserDetail(u)}
                          className="text-xs text-blue-400 hover:underline cursor-pointer"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950">
              <div>
                <h3 className="font-bold text-slate-100">{selectedUser.email}</h3>
                <p className="text-xs text-slate-400">Role: {selectedUser.role}</p>
              </div>
              <button
                onClick={closeUserDetail}
                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {loadingDetail ? (
                <p className="text-slate-500 text-sm text-center py-8">Loading...</p>
              ) : (
                <>
                  {/* Events */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-3">
                      <CalendarDays size={14} /> Calendar & Events ({userEvents.length})
                    </h4>
                    {userEvents.length === 0 ? (
                      <p className="text-slate-600 text-xs">No events.</p>
                    ) : (
                      <div className="space-y-2">
                        {userEvents.map((ev) => (
                          <div key={ev.id} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs flex justify-between">
                            <span className="text-slate-300">{ev.title}</span>
                            <span className="text-slate-500">{ev.event_date}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Goals */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-3">
                      <Target size={14} /> Daily Goals ({userGoals.length})
                    </h4>
                    {userGoals.length === 0 ? (
                      <p className="text-slate-600 text-xs">No goals.</p>
                    ) : (
                      <div className="space-y-2">
                        {userGoals.map((g) => (
                          <div key={g.id} className={`bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs ${g.is_completed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
                            {g.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Modules */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-3">
                      <Folder size={14} /> Subject Folders ({userModules.length})
                    </h4>
                    {userModules.length === 0 ? (
                      <p className="text-slate-600 text-xs">No folders.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {userModules.map((m) => (
                          <div key={m.id} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300">
                            {m.title}
                            <span className="block text-[10px] text-slate-500 mt-0.5">{m.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}