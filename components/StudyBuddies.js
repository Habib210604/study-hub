'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/supabase';
import { Users, MessageCircle, Send, Search, ShieldOff, Flag, X, ArrowLeft, Loader2, UsersRound } from 'lucide-react';

const EDUCATION_LEVELS = ['Primaire', '7ème', '8ème', '9ème', '1ère', '2ème', '3ème', 'Bac', 'Université'];
const FILIERE_MAP = {
  '2ème': ['Mathématiques', 'Sciences', 'Lettres', 'Sport'],
  '3ème': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
  'Bac': ['Mathématiques', 'Sciences Expérimentales', 'Économie et Gestion', 'Informatique', 'Sport', 'Technique', 'Lettres'],
};

export default function StudyBuddies() {
  const [myId, setMyId] = useState(null);
  const [view, setView] = useState('group'); // 'group' | 'find' | 'conversations' | 'chat'
  const [levelFilter, setLevelFilter] = useState('');
  const [filiereFilter, setFiliereFilter] = useState('');
  const [classmates, setClassmates] = useState([]);
  const [loadingClassmates, setLoadingClassmates] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingByName, setSearchingByName] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // --- Class group chat state ---
  const [myGroup, setMyGroup] = useState(null); // { id, name }
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupInput, setGroupInput] = useState('');
  const [groupSending, setGroupSending] = useState(false);
  const [groupWarning, setGroupWarning] = useState('');
  const [groupReportTarget, setGroupReportTarget] = useState(null); // { senderId, content }
  const groupScrollRef = useRef(null);
  const groupChannelRef = useRef(null);
  const senderNamesRef = useRef({});

  const [activeChatUser, setActiveChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState('');

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const scrollRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setMyId(session.user.id);
        // Default class filter to their own
        supabase.from('profiles').select('education_level, filiere').eq('id', session.user.id).single().then(({ data }) => {
          if (data?.education_level) {
            setLevelFilter(data.education_level);
            setFiliereFilter(data.filiere || '');
          }
        });
      }
    });
    fetchConversations();
    initMyGroup();
  }, []);

  const initMyGroup = async () => {
    setLoadingGroup(true);
    const { data, error } = await supabase.rpc('get_or_create_my_group');
    if (!error && data?.success) {
      setMyGroup({ id: data.id, name: data.name });
      await loadGroupMessages(data.id);
    }
    setLoadingGroup(false);
  };

  const loadGroupMessages = async (groupId) => {
    const { data, error } = await supabase
      .from('chat_group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setGroupMessages(data);
      // Batch-fetch sender names for anyone we haven't looked up yet
      const unknownIds = [...new Set(data.map((m) => m.sender_id))].filter((id) => !senderNamesRef.current[id]);
      if (unknownIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email').in('id', unknownIds);
        profiles?.forEach((p) => {
          senderNamesRef.current[p.id] = p.first_name || p.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : p.email;
        });
      }
    }
  };

  // Realtime subscription for the group chat
  useEffect(() => {
    if (!myGroup?.id) return;
    if (groupChannelRef.current) supabase.removeChannel(groupChannelRef.current);

    const channel = supabase
      .channel(`group-chat-${myGroup.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_group_messages', filter: `group_id=eq.${myGroup.id}` }, async (payload) => {
        const m = payload.new;
        if (!senderNamesRef.current[m.sender_id]) {
          const { data: p } = await supabase.from('profiles').select('first_name, last_name, email').eq('id', m.sender_id).single();
          if (p) senderNamesRef.current[m.sender_id] = p.first_name || p.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : p.email;
        }
        setGroupMessages((prev) => [...prev, m]);
      })
      .subscribe();

    groupChannelRef.current = channel;
    return () => { if (groupChannelRef.current) supabase.removeChannel(groupChannelRef.current); };
  }, [myGroup?.id]);

  useEffect(() => {
    groupScrollRef.current?.scrollTo({ top: groupScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [groupMessages]);

  const sendGroupMessage = async (e) => {
    e.preventDefault();
    if (!groupInput.trim() || !myGroup?.id || groupSending) return;

    setGroupSending(true);
    setGroupWarning('');
    const content = groupInput;
    setGroupInput('');

    const { data, error } = await supabase.rpc('send_group_message', { p_group_id: myGroup.id, p_content: content });

    if (error || !data?.success) {
      const reason = data?.reason;
      if (reason === 'inappropriate_language') {
        setGroupWarning(`⚠️ That message wasn't sent — it contains language against our guidelines. Warning ${data.strikes}/3.`);
      } else if (reason === 'banned_now') {
        setGroupWarning('🚫 Your account has been suspended. Please refresh the page.');
      } else {
        setGroupWarning('Message could not be sent.');
      }
      setGroupInput(content);
    }
    setGroupSending(false);
  };

  const submitGroupReport = async () => {
    if (!groupReportTarget || !myId || !reportReason.trim()) return;
    await supabase.from('reports').insert([{
      reporter_id: myId,
      reported_id: groupReportTarget.senderId,
      message_snippet: groupReportTarget.content,
      reason: reportReason.trim(),
    }]);
    setGroupReportTarget(null);
    setReportReason('');
    alert('Report submitted. Our team will review it.');
  };


  useEffect(() => {
    if (levelFilter) fetchClassmates();
  }, [levelFilter, filiereFilter]);

  // Search by name/email, independent of class — debounced so it doesn't fire on every keystroke
  useEffect(() => {
    if (!nameSearch.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchingByName(true);
    const timeout = setTimeout(async () => {
      const q = nameSearch.trim();
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, education_level, filiere')
        .eq('role', 'student')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(20);
      if (myId) query = query.neq('id', myId);

      const { data, error } = await query;
      if (!error && data) setSearchResults(data);
      setSearchingByName(false);
    }, 350);

    return () => clearTimeout(timeout);
  }, [nameSearch, myId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for the open conversation
  useEffect(() => {
    if (!activeChatUser || !myId) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`chat-${myId}-${activeChatUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const m = payload.new;
        const isRelevant =
          (m.sender_id === myId && m.receiver_id === activeChatUser.id) ||
          (m.sender_id === activeChatUser.id && m.receiver_id === myId);
        if (isRelevant) {
          setMessages((prev) => [...prev, m]);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [activeChatUser, myId]);

  const fetchClassmates = async () => {
    setLoadingClassmates(true);
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, education_level, filiere')
      .eq('role', 'student')
      .eq('education_level', levelFilter)
      .neq('id', myId || '');
    if (filiereFilter) query = query.eq('filiere', filiereFilter);

    const { data, error } = await query;
    if (!error && data) setClassmates(data);
    setLoadingClassmates(false);
  };

  const fetchConversations = async () => {
    setLoadingConversations(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoadingConversations(false); return; }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('sender_id, receiver_id, content, created_at')
      .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const seen = new Map();
      data.forEach((m) => {
        const otherId = m.sender_id === session.user.id ? m.receiver_id : m.sender_id;
        if (!seen.has(otherId)) seen.set(otherId, { otherId, lastMessage: m.content, lastAt: m.created_at });
      });
      const otherIds = [...seen.keys()];
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email').in('id', otherIds);
        const merged = [...seen.values()].map((c) => ({
          ...c,
          userInfo: profiles?.find((p) => p.id === c.otherId),
        }));
        setConversations(merged);
      } else {
        setConversations([]);
      }
    }
    setLoadingConversations(false);
  };

  const openChat = async (user) => {
    setActiveChatUser(user);
    setView('chat');
    setWarning('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${user.id}),and(sender_id.eq.${user.id},receiver_id.eq.${session.user.id})`)
      .order('created_at', { ascending: true });

    if (!error && data) setMessages(data);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChatUser || sending) return;

    setSending(true);
    setWarning('');
    const content = input;
    setInput('');

    const { data, error } = await supabase.rpc('send_chat_message', {
      p_receiver_id: activeChatUser.id,
      p_content: content,
    });

    if (error || !data?.success) {
      const reason = data?.reason;
      if (reason === 'inappropriate_language') {
        setWarning(`⚠️ That message wasn't sent — it contains language against our guidelines. Warning ${data.strikes}/3. Further violations will result in a ban.`);
      } else if (reason === 'banned_now') {
        setWarning('🚫 Your account has been suspended for repeated violations. Please refresh the page.');
      } else if (reason === 'blocked') {
        setWarning("You can't message this user.");
      } else {
        setWarning('Message could not be sent.');
      }
      setInput(content); // give it back so they don't lose what they typed
    }
    setSending(false);
  };

  const blockUser = async () => {
    if (!activeChatUser || !myId) return;
    if (!confirm(`Block ${activeChatUser.first_name || activeChatUser.email}? They won't be able to message you anymore.`)) return;
    await supabase.from('blocked_users').insert([{ blocker_id: myId, blocked_id: activeChatUser.id }]);
    setView('conversations');
    setActiveChatUser(null);
    fetchConversations();
  };

  const submitReport = async () => {
    if (!activeChatUser || !myId || !reportReason.trim()) return;
    const lastMsg = messages[messages.length - 1];
    await supabase.from('reports').insert([{
      reporter_id: myId,
      reported_id: activeChatUser.id,
      message_snippet: lastMsg?.content || null,
      reason: reportReason.trim(),
    }]);
    setReportOpen(false);
    setReportReason('');
    alert('Report submitted. Our team will review it.');
  };

  const displayName = (u) => (u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email);

  const renderTabBar = () => (
    <div className="flex gap-1.5 sm:gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        onClick={() => setView('group')}
        className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${view === 'group' ? 'bg-indigo-600 text-white' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
      >
        <UsersRound size={13} /> Class Group
      </button>
      <button
        onClick={() => setView('find')}
        className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${view === 'find' ? 'bg-teal-600 text-white' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
      >
        <Search size={13} /> Find Classmates
      </button>
      <button
        onClick={() => setView('conversations')}
        className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${view === 'conversations' ? 'bg-teal-600 text-white' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
      >
        <MessageCircle size={13} /> Conversations
      </button>
    </div>
  );

  // ============ GROUP CHAT VIEW ============
  if (view === 'group') {
    return (
      <div>
        {renderTabBar()}
        <div className="flex flex-col h-[65vh]">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
            <div className="flex items-center gap-2">
              <UsersRound size={17} className="text-indigo-400" />
              <span className="font-semibold text-[var(--text)]">
                {loadingGroup ? 'Loading your class group...' : myGroup?.name || 'No class set'}
              </span>
            </div>
          </div>

          {!myGroup && !loadingGroup ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-8">
              Your class isn't set on your profile yet, so we can't find your group chat.
            </p>
          ) : (
            <>
              <div ref={groupScrollRef} className="flex-1 overflow-y-auto space-y-2 px-1">
                {groupMessages.map((m) => {
                  const isMine = m.sender_id === myId;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {!isMine && (
                          <span className="text-[10px] text-[var(--text-faint)] mb-0.5 px-1">
                            {senderNamesRef.current[m.sender_id] || '...'}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <div className={`px-3.5 py-2 rounded-2xl text-sm ${
                            isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-black/20 text-[var(--text)] rounded-bl-sm border border-[var(--border)]'
                          }`}>
                            {m.content}
                          </div>
                          {!isMine && (
                            <button
                              onClick={() => setGroupReportTarget({ senderId: m.sender_id, content: m.content })}
                              className="opacity-0 group-hover:opacity-100 text-[var(--text-faint)] hover:text-amber-400 transition cursor-pointer p-1"
                              title="Report this message"
                            >
                              <Flag size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {groupWarning && <p className="text-xs text-amber-400 mt-2">{groupWarning}</p>}

              <form onSubmit={sendGroupMessage} className="flex items-center gap-2 pt-3 mt-1">
                <input
                  type="text"
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  placeholder={`Message ${myGroup?.name || 'your class'}...`}
                  className="flex-1 bg-transparent border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-teal-500"
                />
                <button type="submit" disabled={groupSending} className="bg-teal-600 hover:bg-teal-500 text-white p-2.5 rounded-xl transition cursor-pointer disabled:opacity-50">
                  {groupSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Report modal (shared with private chat's report flow) */}
        {groupReportTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setGroupReportTarget(null)}>
            <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-[var(--text)]">Report this message</h4>
                <button onClick={() => setGroupReportTarget(null)} className="cursor-pointer"><X size={16} className="text-[var(--text-muted)]" /></button>
              </div>
              <p className="text-xs text-[var(--text-muted)] italic border-l-2 border-[var(--border)] pl-2 mb-3">"{groupReportTarget.content}"</p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="What's wrong with this message?"
                rows={4}
                className="w-full bg-black/20 border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text)] focus:outline-none resize-none"
              />
              <button
                onClick={submitGroupReport}
                disabled={!reportReason.trim()}
                className="w-full mt-3 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2 rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ CHAT VIEW ============
  if (view === 'chat' && activeChatUser) {
    return (
      <div className="flex flex-col h-[70vh]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { setView('conversations'); setActiveChatUser(null); }} className="p-1.5 hover:bg-black/10 rounded-lg cursor-pointer">
              <ArrowLeft size={16} />
            </button>
            <span className="font-semibold text-[var(--text)]">{displayName(activeChatUser)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setReportOpen(true)} title="Report" className="p-2 text-[var(--text-muted)] hover:text-amber-400 cursor-pointer">
              <Flag size={16} />
            </button>
            <button onClick={blockUser} title="Block" className="p-2 text-[var(--text-muted)] hover:text-red-400 cursor-pointer">
              <ShieldOff size={16} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 px-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-sm ${
                m.sender_id === myId ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-black/20 text-[var(--text)] rounded-bl-sm border border-[var(--border)]'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {warning && <p className="text-xs text-amber-400 mt-2">{warning}</p>}

        <form onSubmit={sendMessage} className="flex items-center gap-2 pt-3 mt-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-teal-500"
          />
          <button type="submit" disabled={sending} className="bg-teal-600 hover:bg-teal-500 text-white p-2.5 rounded-xl transition cursor-pointer disabled:opacity-50">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>

        {/* Report modal */}
        {reportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReportOpen(false)}>
            <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-[var(--text)]">Report {displayName(activeChatUser)}</h4>
                <button onClick={() => setReportOpen(false)} className="cursor-pointer"><X size={16} className="text-[var(--text-muted)]" /></button>
              </div>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="What happened?"
                rows={4}
                className="w-full bg-black/20 border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text)] focus:outline-none resize-none"
              />
              <button
                onClick={submitReport}
                disabled={!reportReason.trim()}
                className="w-full mt-3 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2 rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ FIND / CONVERSATIONS VIEW ============
  return (
    <div>
      {renderTabBar()}

      {view === 'find' && (
        <div>
          {/* Search by name/email — works independently of picking a class */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full bg-transparent border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-teal-500"
            />
          </div>

          {nameSearch.trim() ? (
            // --- Name search results ---
            searchingByName ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-8">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-8">No students found matching "{nameSearch}".</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.map((u) => (
                  <div key={u.id} className="border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-[var(--text)]">{displayName(u)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{u.education_level}{u.filiere ? ` · ${u.filiere}` : ''}</p>
                    </div>
                    <button
                      onClick={() => openChat(u)}
                      className="text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <MessageCircle size={13} /> Chat
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            // --- Browse by class (only shown when not actively searching by name) ---
            <>
              <div className="flex flex-wrap gap-3 mb-4">
                <select
                  value={levelFilter}
                  onChange={(e) => { setLevelFilter(e.target.value); setFiliereFilter(''); }}
                  className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                >
                  <option value="">Select your class...</option>
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
              </div>

              {!levelFilter ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-8">Select a class to find classmates, or search by name above.</p>
              ) : loadingClassmates ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-8">Loading...</p>
              ) : classmates.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-8">No other students found in this class yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {classmates.map((u) => (
                    <div key={u.id} className="border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-[var(--text)]">{displayName(u)}</p>
                        <p className="text-xs text-[var(--text-muted)]">{u.education_level}{u.filiere ? ` · ${u.filiere}` : ''}</p>
                      </div>
                      <button
                        onClick={() => openChat(u)}
                        className="text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <MessageCircle size={13} /> Chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === 'conversations' && (
        <div>
          {loadingConversations ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-8">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-8">No conversations yet — find a classmate to start chatting.</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((c) => (
                <div
                  key={c.otherId}
                  onClick={() => openChat({ id: c.otherId, ...c.userInfo })}
                  className="border border-[var(--border)] rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-teal-500/40 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[var(--text)]">{c.userInfo ? displayName(c.userInfo) : 'Unknown'}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{c.lastMessage}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-faint)] shrink-0 ml-2">{new Date(c.lastAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}