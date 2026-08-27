'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/supabase';

export function useAiChat() {
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(null); // null = fresh, unsaved chat

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileContext, setFileContext] = useState('');
  const [fileName, setFileName] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const userIdRef = useRef(null);

  // On open, load the list of past conversations — but start on a FRESH,
  // unsaved chat rather than auto-resuming the last one. Matches ChatGPT/Claude:
  // logging back in always gives you a new chat, with history one click away.
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoadingConversations(false);
        return;
      }
      userIdRef.current = session.user.id;
      await fetchConversations();
      setLoadingConversations(false);
    };
    init();
  }, []);

  const fetchConversations = async () => {
    if (!userIdRef.current) return;
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title, updated_at')
      .eq('user_id', userIdRef.current)
      .order('updated_at', { ascending: false });
    if (!error && data) setConversations(data);
  };

  const loadConversationMessages = async (conversationId) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setMessages(data.map((m) => ({ id: String(m.id), role: m.role, content: m.content })));
    }
    setLoadingMessages(false);
  };

  const openConversation = async (conversationId) => {
    setActiveConversationId(conversationId);
    await loadConversationMessages(conversationId);
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput('');
    clearAttachment();
  };

  const deleteConversations = async (ids) => {
    await supabase.from('ai_conversations').delete().in('id', ids);
    setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
    if (ids.includes(activeConversationId)) {
      startNewChat();
    }
  };

  // Creates the conversation row the moment the first message is sent,
  // titled from that first message (truncated) — never before that.
  const ensureConversation = async (firstMessageContent) => {
    if (activeConversationId) return activeConversationId;
    const title = firstMessageContent.trim().slice(0, 60) || 'New Chat';
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert([{ user_id: userIdRef.current, title }])
      .select()
      .single();
    if (error || !data) return null;
    setActiveConversationId(data.id);
    setConversations((prev) => [{ id: data.id, title: data.title, updated_at: data.updated_at }, ...prev]);
    return data.id;
  };

  const touchConversation = async (conversationId) => {
    const now = new Date().toISOString();
    await supabase.from('ai_conversations').update({ updated_at: now }).eq('id', conversationId);
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, updated_at: now } : c)).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    );
  };

  const persistMessage = async (conversationId, role, content) => {
    if (!userIdRef.current || !conversationId) return;
    await supabase.from('ai_messages').insert([{ user_id: userIdRef.current, conversation_id: conversationId, role, content }]);
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSelected = async (file) => {
    if (!file) return;
    setUploadError('');
    const isImage = file.type.startsWith('image/');
    const isText = file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt');

    if (isImage) {
      try {
        const base64 = await fileToBase64(file);
        const previewUrl = URL.createObjectURL(file);
        setPendingImage({ base64, mimeType: file.type, previewUrl });
        setFileName(file.name);
        setFileContext('');
      } catch {
        setUploadError('Could not read that image. Please try another file.');
      }
    } else if (isText) {
      try {
        const text = await file.text();
        setFileContext(text.slice(0, 15000));
        setFileName(file.name);
        setPendingImage(null);
      } catch {
        setUploadError('Could not read that file as text.');
      }
    } else {
      setUploadError('Only images (JPG/PNG) or text files (.txt, .md) are supported right now.');
    }
  };

  const clearAttachment = () => {
    setFileName('');
    setFileContext('');
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setUploadError('');
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !pendingImage) || isLoading) return;

    const userMessageContent = input || (pendingImage ? 'What do you see in this image?' : '');
    setInput('');

    const newUserMessage = { id: Date.now().toString(), role: 'user', content: userMessageContent, image: pendingImage || undefined };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    const imageForRequest = pendingImage;
    setPendingImage(null);
    if (!fileContext) setFileName('');

    const conversationId = await ensureConversation(userMessageContent);
    if (conversationId) {
      persistMessage(conversationId, 'user', userMessageContent);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
            image: m.image ? { base64: m.image.base64, mimeType: m.image.mimeType } : undefined,
          })),
          context: fileContext,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const assistantMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.content };
      setMessages([...updatedMessages, assistantMessage]);
      if (conversationId) {
        persistMessage(conversationId, 'assistant', data.content);
        touchConversation(conversationId);
      }
    } catch (err) {
      console.warn('Chat error:', err.message);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error connecting to the AI assistant. Please try again.',
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    conversations, loadingConversations, activeConversationId,
    openConversation, startNewChat, deleteConversations,
    messages, loadingMessages, input, setInput, isLoading, sendMessage,
    fileName, pendingImage, uploadError, handleFileSelected, clearAttachment,
  };
}