'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import {
  Megaphone, Users, Plus, Trash2, X, LogOut, Shield,
  CalendarDays, Target, Folder, Mail, Loader2, CheckSquare, Square, CreditCard, Check,
  BookOpenCheck, Upload, Clock, Star, Flag, ShieldOff, ShieldCheck
} from 'lucide-react';

const GRANT_PLAN_OPTIONS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
];

const EDUCATION_LEVELS_FOR_TARGETING = [
  'Primaire', '7ème', '8ème', '9ème', '1ère', '2ème', '3ème', 'Bac', 'Université',
];

// Grades that have filières — used to render filière sub-chips under the grade chip
const FILIERE_TARGETING_MAP: Record<string, string[]> = {
  '2ème': ['Mathématiques', 'Sciences', 'Lettres', 'Sport'],
  '3ème': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
  'Bac': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
};

export default function AdminDashboard() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('announcements'); // 'announcements' | 'users'

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [audienceMode, setAudienceMode] = useState('all'); // 'all' | 'specific' | 'class'
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState(''); // search by name or email in 'specific' mode
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]); // education_level values for 'class' mode
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Users state (students only)
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Grant Access state: which user's plan-picker is open, and loading flag
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [grantLoadingId, setGrantLoadingId] = useState<string | null>(null);

  // Selected user detail state
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userEvents, setUserEvents] = useState<any[]>([]);

  // Resources state
  const [resources, setResources] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [resourceForm, setResourceForm] = useState({
    title: '', description: '', resource_type: 'exercise_set',
    education_level: '', filiere: '', is_free: false, price: '',
  });
  const [exerciseFile, setExerciseFile] = useState<File | null>(null);
  const [correctionFile, setCorrectionFile] = useState<File | null>(null);
  const [summaryFile, setSummaryFile] = useState<File | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Reports state
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [userGoals, setUserGoals] = useState<any[]>([]);
  const [userModules, setUserModules] = useState<any[]>([]);
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
      fetchResources();
      fetchPendingPurchases();
      fetchReviews();
      fetchReports();
    }
  }, [session]);

  // Realtime: reflect student profile edits (name, phone, class) instantly, no manual refresh needed
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('admin-profiles-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload: any) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === payload.new.id ? { ...u, ...payload.new } : u))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // --- Announcements ---
  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data);
  };

  const toggleRecipient = (userId: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllRecipients = () => {
    const visibleIds = filteredRecipientOptions.map((u) => u.id);
    const allVisibleSelected = visibleIds.every((id) => selectedRecipientIds.includes(id));
    if (allVisibleSelected) {
      setSelectedRecipientIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedRecipientIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleClass = (level: string) => {
    setSelectedClasses((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  // Toggles a specific grade+filière combo, e.g. "Bac::Mathématiques"
  const toggleClassFiliere = (level: string, filiere: string) => {
    const key = `${level}::${filiere}`;
    setSelectedClasses((prev) =>
      prev.includes(key) ? prev.filter((l) => l !== key) : [...prev, key]
    );
  };

  // A user matches if their whole grade was selected, OR their exact grade+filière combo was selected
  const matchesSelectedClasses = (user: any) => {
    if (selectedClasses.includes(user.education_level)) return true;
    if (user.filiere && selectedClasses.includes(`${user.education_level}::${user.filiere}`)) return true;
    return false;
  };

  const postAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;

    // Resolve the final list of recipient user IDs based on the chosen audience mode
    let recipientIds: string[] = [];
    if (audienceMode === 'specific') {
      if (selectedRecipientIds.length === 0) {
        alert('Select at least one recipient, or switch to "All Users".');
        return;
      }
      recipientIds = selectedRecipientIds;
    } else if (audienceMode === 'class') {
      if (selectedClasses.length === 0) {
        alert('Select at least one class/grade or filière, or switch to "All Users".');
        return;
      }
      recipientIds = users.filter(matchesSelectedClasses).map((u) => u.id);
      if (recipientIds.length === 0) {
        alert('No students found in the selected class(es).');
        return;
      }
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

    // If targeted (specific users or a class), insert the recipient rows
    if (audienceMode !== 'all') {
      const targetRows = recipientIds.map((userId) => ({
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
      { ...newAnnouncement, _recipientCount: audienceMode !== 'all' ? recipientIds.length : null },
      ...announcements,
    ]);
    setNewTitle('');
    setNewMessage('');
    setAudienceMode('all');
    setSelectedRecipientIds([]);
    setSelectedClasses([]);
    setRecipientSearch('');
    setPostingAnnouncement(false);
  };

  const deleteAnnouncement = async (id: string) => {
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

  // --- Resources ---
  const fetchResources = async () => {
    setLoadingResources(true);
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setResources(data);
    setLoadingResources(false);
  };

  const fetchPendingPurchases = async () => {
    const { data: purchases, error } = await supabase
      .from('resource_purchases')
      .select('id, resource_id, user_id, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !purchases || purchases.length === 0) {
      setPendingPurchases([]);
      return;
    }

    const resourceIds = [...new Set(purchases.map((p) => p.resource_id))];
    const userIds = [...new Set(purchases.map((p) => p.user_id))];

    const [{ data: resourcesData }, { data: profilesData }] = await Promise.all([
      supabase.from('resources').select('id, title').in('id', resourceIds),
      supabase.from('profiles').select('id, email, first_name, last_name').in('id', userIds),
    ]);

    const merged = purchases.map((p) => ({
      ...p,
      resourceTitle: resourcesData?.find((r) => r.id === p.resource_id)?.title || 'Unknown resource',
      userInfo: profilesData?.find((u) => u.id === p.user_id) || null,
    }));

    setPendingPurchases(merged);
  };

  const uploadResourceFile = async (file: File, folder: string) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('resource_type', 'raw');
    formData.append('folder', `resource-files/${folder}`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Upload failed');
    return data.secure_url;
  };

  const handleUploadResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceForm.title.trim() || !resourceForm.education_level) {
      alert('Please fill in at least the title and class.');
      return;
    }
    if (!resourceForm.is_free && (!resourceForm.price || Number(resourceForm.price) <= 0)) {
      alert('Please set a price, or mark this resource as free.');
      return;
    }
    if (resourceForm.resource_type === 'exercise_set' && (!exerciseFile || !correctionFile)) {
      alert('Please upload both the exercise PDF and the correction PDF.');
      return;
    }
    if (resourceForm.resource_type === 'summary' && !summaryFile) {
      alert('Please upload the summary PDF.');
      return;
    }

    setUploadingResource(true);
    try {
      let exercise_file_url = null, correction_file_url = null, summary_file_url = null;

      if (resourceForm.resource_type === 'exercise_set') {
        exercise_file_url = await uploadResourceFile(exerciseFile as File, 'exercises');
        correction_file_url = await uploadResourceFile(correctionFile as File, 'corrections');
      } else {
        summary_file_url = await uploadResourceFile(summaryFile as File, 'summaries');
      }

      const { error } = await supabase.from('resources').insert([{
        title: resourceForm.title.trim(),
        description: resourceForm.description.trim() || null,
        resource_type: resourceForm.resource_type,
        education_level: resourceForm.education_level,
        filiere: resourceForm.filiere || null,
        is_free: resourceForm.is_free,
        price: resourceForm.is_free ? 0 : Number(resourceForm.price),
        exercise_file_url,
        correction_file_url,
        summary_file_url,
      }]);

      if (error) throw error;

      setResourceForm({ title: '', description: '', resource_type: 'exercise_set', education_level: '', filiere: '', is_free: false, price: '' });
      setExerciseFile(null);
      setCorrectionFile(null);
      setSummaryFile(null);
      fetchResources();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    }
    setUploadingResource(false);
  };

  const deleteResource = async (id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
    await supabase.from('resources').delete().eq('id', id);
  };

  const approvePurchase = async (purchaseId: string) => {
    setApprovingId(purchaseId);
    const { error } = await supabase
      .from('resource_purchases')
      .update({ status: 'active' })
      .eq('id', purchaseId);
    if (!error) {
      setPendingPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
    } else {
      alert('Failed to approve: ' + error.message);
    }
    setApprovingId(null);
  };

  // --- Reviews ---
  const fetchReviews = async () => {
    setLoadingReviews(true);
    const { data: reviewRows, error } = await supabase
      .from('reviews')
      .select('id, user_id, rating, message, created_at')
      .order('created_at', { ascending: false });

    if (error || !reviewRows) {
      setReviews([]);
      setLoadingReviews(false);
      return;
    }

    const userIds = [...new Set(reviewRows.map((r) => r.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    const merged = reviewRows.map((r) => ({
      ...r,
      userInfo: profilesData?.find((u) => u.id === r.user_id) || null,
    }));

    setReviews(merged);
    setLoadingReviews(false);
  };

  const deleteReview = async (id: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await supabase.from('reviews').delete().eq('id', id);
  };

  // --- Reports & Moderation ---
  const fetchReports = async () => {
    setLoadingReports(true);
    const { data: reportRows, error } = await supabase
      .from('reports')
      .select('id, reporter_id, reported_id, message_snippet, reason, status, created_at')
      .order('created_at', { ascending: false });

    if (error || !reportRows) {
      setReports([]);
      setLoadingReports(false);
      return;
    }

    const userIds = [...new Set([...reportRows.map((r) => r.reporter_id), ...reportRows.map((r) => r.reported_id)])];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, banned, strike_count')
      .in('id', userIds);

    const merged = reportRows.map((r) => ({
      ...r,
      reporterInfo: profilesData?.find((u) => u.id === r.reporter_id) || null,
      reportedInfo: profilesData?.find((u) => u.id === r.reported_id) || null,
    }));

    setReports(merged);
    setLoadingReports(false);
  };

  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  const dismissReport = async (reportId: string) => {
    await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId);
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: 'reviewed' } : r)));
  };

  const banUser = async (userId: string, reportId: string | null) => {
    setBanningId(userId);
    const reason = prompt('Reason for ban (shown to the user):', 'Violation of community guidelines');
    if (reason === null) { setBanningId(null); return; }

    const { data, error } = await supabase.rpc('admin_set_ban', { p_user_id: userId, p_banned: true, p_reason: reason });
    if (!error && data?.success) {
      if (reportId) await dismissReport(reportId);
      setReports((prev) => prev.map((r) => (r.reported_id === userId ? { ...r, reportedInfo: { ...r.reportedInfo, banned: true } } : r)));
    } else {
      alert('Failed to ban user.');
    }
    setBanningId(null);
  };

  const unbanUser = async (userId: string) => {
    setBanningId(userId);
    const { data, error } = await supabase.rpc('admin_set_ban', { p_user_id: userId, p_banned: false });
    if (!error && data?.success) {
      setReports((prev) => prev.map((r) => (r.reported_id === userId ? { ...r, reportedInfo: { ...r.reportedInfo, banned: false } } : r)));
    } else {
      alert('Failed to unban user.');
    }
    setBanningId(null);
  };

  // --- Grant Access: sets subscription_status, subscription_ends_at, and plan on profiles ---
  const grantAccess = async (userId: string, months: number, planLabel: string) => {
    setGrantLoadingId(userId);

    // Extend from the later of (now) or (their current end date), so early renewals stack correctly
    const currentUser = users.find((u) => u.id === userId);
    const baseDate =
      currentUser?.subscription_ends_at && new Date(currentUser.subscription_ends_at) > new Date()
        ? new Date(currentUser.subscription_ends_at)
        : new Date();

    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_ends_at: newEndDate.toISOString(),
        plan: planLabel,
        renewal_reminder_sent: false,
      })
      .eq('id', userId);

    if (error) {
      alert('Failed to grant access: ' + error.message);
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, subscription_status: 'active', subscription_ends_at: newEndDate.toISOString(), plan: planLabel, renewal_reminder_sent: false }
            : u
        )
      );
      setGrantingUserId(null);
    }
    setGrantLoadingId(null);
  };

  const openUserDetail = async (user: any) => {
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

  // Recipients matching the search box, for the "Specific Users" picker
  const filteredRecipientOptions = users.filter((u) => {
    if (!recipientSearch.trim()) return true;
    const q = recipientSearch.toLowerCase();
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    return fullName.includes(q) || (u.email || '').toLowerCase().includes(q);
  });

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
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'resources' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpenCheck size={16} /> Resources
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'reviews' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star size={16} /> Reviews
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition cursor-pointer relative ${
              activeTab === 'reports' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flag size={16} /> Reports
            {pendingReportsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingReportsCount}
              </span>
            )}
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
                <div className="flex gap-2 flex-wrap">
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
                    By Name / Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode('class')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      audienceMode === 'class' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    By Class / Grade
                  </button>
                </div>

                {audienceMode === 'specific' && (
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />

                    <button
                      type="button"
                      onClick={selectAllRecipients}
                      className="text-xs text-blue-400 hover:underline cursor-pointer flex items-center gap-1.5"
                    >
                      {filteredRecipientOptions.length > 0 && filteredRecipientOptions.every((u) => selectedRecipientIds.includes(u.id))
                        ? <CheckSquare size={14} /> : <Square size={14} />}
                      {filteredRecipientOptions.length > 0 && filteredRecipientOptions.every((u) => selectedRecipientIds.includes(u.id))
                        ? 'Deselect All Shown' : 'Select All Shown'}
                    </button>

                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {filteredRecipientOptions.length === 0 ? (
                        <p className="text-xs text-slate-600 text-center py-3">No matching users.</p>
                      ) : (
                        filteredRecipientOptions.map((u) => (
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
                            <span className="text-xs text-slate-300">
                              {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                              {(u.first_name || u.last_name) && <span className="text-slate-600"> · {u.email}</span>}
                            </span>
                          </label>
                        ))
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {selectedRecipientIds.length} selected in total
                    </p>
                  </div>
                )}

                {audienceMode === 'class' && (
                  <div className="border-t border-slate-800 pt-3 space-y-3">
                    <p className="text-[11px] text-slate-500">
                      Select a whole grade, or pick specific filières within grades that have them (2ème, 3ème, Bac).
                    </p>
                    {EDUCATION_LEVELS_FOR_TARGETING.map((level) => {
                      const count = users.filter((u) => u.education_level === level).length;
                      const isWholeSelected = selectedClasses.includes(level);
                      const filieres = FILIERE_TARGETING_MAP[level];

                      return (
                        <div key={level} className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => toggleClass(level)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer ${
                              isWholeSelected
                                ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {level} <span className="text-slate-600">({count} total)</span>
                          </button>

                          {filieres && (
                            <div className="flex flex-wrap gap-1.5 pl-3">
                              {filieres.map((f) => {
                                const filiereCount = users.filter((u) => u.education_level === level && u.filiere === f).length;
                                const isFiliereSelected = selectedClasses.includes(`${level}::${f}`);
                                return (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() => toggleClassFiliere(level, f)}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition cursor-pointer ${
                                      isFiliereSelected
                                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                                    }`}
                                  >
                                    {f} ({filiereCount})
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                      {users.filter(matchesSelectedClasses).length} student(s) will receive this
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-visible">
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
                    <th className="px-5 py-3">Subscription</th>
                    <th className="px-5 py-3"></th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isExpired = u.subscription_ends_at && new Date(u.subscription_ends_at) < new Date();
                    const statusLabel = isExpired ? 'expired' : (u.subscription_status || 'trial');
                    const statusColor =
                      statusLabel === 'active' ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' :
                      statusLabel === 'expired' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/30';

                    return (
                      <tr key={u.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition relative">
                        <td className="px-5 py-3 text-slate-200">
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-slate-500 shrink-0" />
                            <div>
                              <p className="font-medium">
                                {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                              </p>
                              {(u.first_name || u.last_name) && <p className="text-[11px] text-slate-500">{u.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${statusColor}`}>
                            {statusLabel}
                          </span>
                          {u.subscription_ends_at && (
                            <span className="block text-[10px] text-slate-500 mt-1">
                              {u.plan ? `${u.plan} · ` : ''}until {new Date(u.subscription_ends_at).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right relative">
                          <button
                            onClick={() => setGrantingUserId(grantingUserId === u.id ? null : u.id)}
                            className="text-xs text-teal-400 hover:underline cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <CreditCard size={12} /> Grant Access
                          </button>

                          {grantingUserId === u.id && (
                            <div className="absolute right-5 top-full mt-1 z-20 bg-slate-950 border border-slate-800 rounded-xl shadow-xl p-2 w-44">
                              {GRANT_PLAN_OPTIONS.map((opt) => (
                                <button
                                  key={opt.months}
                                  onClick={() => grantAccess(u.id, opt.months, opt.label)}
                                  disabled={grantLoadingId === u.id}
                                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition cursor-pointer flex items-center justify-between disabled:opacity-50"
                                >
                                  {opt.label}
                                  {grantLoadingId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="text-teal-400 opacity-0" />}
                                </button>
                              ))}
                            </div>
                          )}
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <div className="space-y-6">

            {/* Pending purchase approvals */}
            {pendingPurchases.length > 0 && (
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6">
                <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" /> Pending Resource Purchases ({pendingPurchases.length})
                </h3>
                <div className="space-y-2">
                  {pendingPurchases.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
                      <div className="text-sm">
                        <span className="text-slate-200 font-medium">{p.resourceTitle}</span>
                        <span className="text-slate-500 text-xs ml-2">
                          — {p.userInfo ? `${p.userInfo.first_name || ''} ${p.userInfo.last_name || ''}`.trim() || p.userInfo.email : 'Unknown user'}
                        </span>
                      </div>
                      <button
                        onClick={() => approvePurchase(p.id)}
                        disabled={approvingId === p.id}
                        className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {approvingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload new resource */}
            <form onSubmit={handleUploadResource} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-slate-200">Add a Resource</h3>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResourceForm({ ...resourceForm, resource_type: 'exercise_set' })}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    resourceForm.resource_type === 'exercise_set' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Exercise Set (2 PDFs)
                </button>
                <button
                  type="button"
                  onClick={() => setResourceForm({ ...resourceForm, resource_type: 'summary' })}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    resourceForm.resource_type === 'summary' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Course Summary (1 PDF)
                </button>
              </div>

              <input
                type="text"
                placeholder="Title..."
                value={resourceForm.title}
                onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <textarea
                placeholder="Description (optional)..."
                value={resourceForm.description}
                onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
              />

              <div className="flex gap-3">
                <select
                  value={resourceForm.education_level}
                  onChange={(e) => setResourceForm({ ...resourceForm, education_level: e.target.value, filiere: '' })}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select class...</option>
                  {EDUCATION_LEVELS_FOR_TARGETING.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>

                {FILIERE_TARGETING_MAP[resourceForm.education_level] && (
                  <select
                    value={resourceForm.filiere}
                    onChange={(e) => setResourceForm({ ...resourceForm, filiere: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select filière...</option>
                    {FILIERE_TARGETING_MAP[resourceForm.education_level].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resourceForm.is_free}
                    onChange={(e) => setResourceForm({ ...resourceForm, is_free: e.target.checked })}
                    className="rounded border-slate-700 text-teal-500 focus:ring-0 cursor-pointer"
                  />
                  Free
                </label>
                {!resourceForm.is_free && (
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Price in DT"
                    value={resourceForm.price}
                    onChange={(e) => setResourceForm({ ...resourceForm, price: e.target.value })}
                    className="w-32 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              {resourceForm.resource_type === 'exercise_set' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-slate-700 rounded-xl p-4 cursor-pointer hover:border-blue-500 transition">
                    <Upload size={16} className="text-slate-500" />
                    <span className="text-xs text-slate-400 text-center">{exerciseFile ? exerciseFile.name : 'Exercise PDF'}</span>
                    <input type="file" accept=".pdf" onChange={(e) => setExerciseFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-slate-700 rounded-xl p-4 cursor-pointer hover:border-blue-500 transition">
                    <Upload size={16} className="text-slate-500" />
                    <span className="text-xs text-slate-400 text-center">{correctionFile ? correctionFile.name : 'Correction PDF'}</span>
                    <input type="file" accept=".pdf" onChange={(e) => setCorrectionFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-slate-700 rounded-xl p-4 cursor-pointer hover:border-blue-500 transition">
                  <Upload size={16} className="text-slate-500" />
                  <span className="text-xs text-slate-400 text-center">{summaryFile ? summaryFile.name : 'Summary PDF'}</span>
                  <input type="file" accept=".pdf" onChange={(e) => setSummaryFile(e.target.files?.[0] || null)} className="hidden" />
                </label>
              )}

              <button
                type="submit"
                disabled={uploadingResource}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {uploadingResource ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {uploadingResource ? 'Uploading...' : 'Add Resource'}
              </button>
            </form>

            {/* Resource list */}
            <div className="space-y-2">
              {loadingResources ? (
                <p className="text-slate-500 text-sm text-center py-8">Loading resources...</p>
              ) : resources.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No resources added yet.</p>
              ) : (
                resources.map((r) => (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-200 text-sm">{r.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.is_free ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {r.is_free ? 'Free' : `${r.price} DT`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {r.resource_type === 'summary' ? 'Résumé' : 'Exercise Set'} · {r.education_level}{r.filiere ? ` · ${r.filiere}` : ''}
                      </p>
                    </div>
                    <button onClick={() => deleteResource(r.id)} className="text-slate-600 hover:text-red-400 transition p-1 cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {!loadingReviews && reviews.length > 0 && (() => {
              const rated = reviews.filter((r) => r.rating);
              const avg = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : null;
              return (
                <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 flex items-center gap-3">
                  <Star size={20} className="text-amber-400 fill-amber-400" />
                  <div>
                    <p className="text-lg font-bold text-slate-100">{avg || '—'} <span className="text-sm font-normal text-slate-500">average rating</span></p>
                    <p className="text-xs text-slate-500">{reviews.length} total submission{reviews.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
              );
            })()}

            {loadingReviews ? (
              <p className="text-slate-500 text-sm text-center py-8">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No reviews or notes submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {r.rating && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} size={12} className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
                            ))}
                          </div>
                        )}
                        <span className="text-xs text-slate-500">
                          {r.userInfo ? `${r.userInfo.first_name || ''} ${r.userInfo.last_name || ''}`.trim() || r.userInfo.email : 'Unknown user'}
                        </span>
                        <span className="text-[10px] text-slate-600">· {new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.message && <p className="text-sm text-slate-300">{r.message}</p>}
                    </div>
                    <button onClick={() => deleteReview(r.id)} className="text-slate-600 hover:text-red-400 transition p-1 cursor-pointer shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            {loadingReports ? (
              <p className="text-slate-500 text-sm text-center py-8">Loading reports...</p>
            ) : reports.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No reports have been filed.</p>
            ) : (
              reports.map((r) => {
                const nameOf = (u: any) => (u ? (u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email) : 'Unknown');
                const isBanned = r.reportedInfo?.banned;
                return (
                  <div key={r.id} className={`bg-slate-900 border rounded-xl p-4 ${r.status === 'pending' ? 'border-amber-500/30' : 'border-slate-800'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                            {r.status}
                          </span>
                          {isBanned && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-400 flex items-center gap-1">
                              <ShieldOff size={10} /> banned
                            </span>
                          )}
                          <span className="text-[10px] text-slate-600">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-slate-200">
                          <span className="font-medium">{nameOf(r.reporterInfo)}</span> reported <span className="font-medium">{nameOf(r.reportedInfo)}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{r.reason}</p>
                        {r.message_snippet && (
                          <p className="text-xs text-slate-500 mt-1 italic border-l-2 border-slate-800 pl-2">"{r.message_snippet}"</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        {isBanned ? (
                          <button
                            onClick={() => unbanUser(r.reported_id)}
                            disabled={banningId === r.reported_id}
                            className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {banningId === r.reported_id ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => banUser(r.reported_id, r.id)}
                            disabled={banningId === r.reported_id}
                            className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {banningId === r.reported_id ? <Loader2 size={12} className="animate-spin" /> : <ShieldOff size={12} />}
                            Ban User
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button
                            onClick={() => dismissReport(r.id)}
                            className="text-xs text-slate-500 hover:text-slate-300 transition cursor-pointer"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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
                <h3 className="font-bold text-slate-100">
                  {selectedUser.first_name || selectedUser.last_name
                    ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim()
                    : selectedUser.email}
                </h3>
                <p className="text-xs text-slate-400">{selectedUser.email}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-500">
                  {selectedUser.phone && <span>📱 {selectedUser.phone}</span>}
                  {selectedUser.education_level && (
                    <span>
                      🎓 {selectedUser.education_level}
                      {selectedUser.filiere ? ` · ${selectedUser.filiere}` : ''}
                    </span>
                  )}
                </div>
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