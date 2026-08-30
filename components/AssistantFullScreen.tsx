'use client';

import { useRef, useEffect, useState } from 'react';
import { Bot, Send, Paperclip, Sparkles, Camera, Plus, Trash2, CheckSquare, Square, Menu, X } from 'lucide-react';
import { useAiChat } from '@/hooks/useAiChat';
import MarkdownLite from '@/components/MarkdownLite';

export default function AssistantFullScreen() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMobileHistory, setShowMobileHistory] = useState(false);

  const {
    conversations, loadingConversations, activeConversationId,
    openConversation, startNewChat, deleteConversations,
    messages, loadingMessages, input, setInput, isLoading, sendMessage,
    fileName, pendingImage, uploadError, handleFileSelected, clearAttachment,
  } = useAiChat();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} conversation${selectedIds.length === 1 ? '' : 's'}? This can't be undone.`)) return;
    await deleteConversations(selectedIds);
    setSelectedIds([]);
    setSelectMode(false);
  };

  const historyPanel = (
    <div className="flex flex-col h-full">
      <button
        onClick={() => { startNewChat(); setShowMobileHistory(false); }}
        className="flex items-center gap-2 text-sm font-medium bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 px-3 py-2.5 rounded-lg transition cursor-pointer mb-3"
      >
        <Plus size={15} /> New Chat
      </button>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] font-semibold">History</span>
        <button
          onClick={() => { setSelectMode(!selectMode); setSelectedIds([]); }}
          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {selectMode && selectedIds.length > 0 && (
        <button onClick={confirmDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 mb-2 cursor-pointer">
          <Trash2 size={12} /> Delete ({selectedIds.length})
        </button>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {loadingConversations ? (
          <p className="text-xs text-[var(--text-faint)] mt-4">Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-[var(--text-faint)] mt-4">No past conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                if (selectMode) { toggleSelect(c.id); return; }
                openConversation(c.id);
                setShowMobileHistory(false);
              }}
              className={`flex items-center gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer transition text-xs ${
                activeConversationId === c.id ? 'bg-teal-500/10 border border-teal-500/30 text-[var(--text)]' : 'hover:bg-black/10 border border-transparent text-[var(--text-muted)]'
              }`}
            >
              {selectMode && (
                selectedIds.includes(c.id) ? <CheckSquare size={13} className="text-teal-400 shrink-0" /> : <Square size={13} className="text-[var(--text-faint)] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">{c.title || 'New Chat'}</p>
                <p className="text-[10px] text-[var(--text-faint)]">{new Date(c.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-9rem)] md:h-[75vh] gap-3 md:gap-4">

      {/* --- Desktop history sidebar (hidden on mobile) --- */}
      <div className="hidden md:flex w-56 shrink-0 border-r border-[var(--border)] pr-4">
        {historyPanel}
      </div>

      {/* --- Mobile history drawer (overlay, toggled by button) --- */}
      {showMobileHistory && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setShowMobileHistory(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-[80%] max-w-xs h-full bg-[var(--panel)] p-4 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMobileHistory(false)}
              className="absolute top-3 right-3 p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <X size={18} />
            </button>
            {historyPanel}
          </div>
        </div>
      )}

      {/* --- Chat panel --- */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 pb-3 md:pb-4 border-b border-[var(--border)] mb-3 md:mb-4">
          <button
            onClick={() => setShowMobileHistory(true)}
            className="md:hidden p-1.5 -ml-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <Bot size={20} className="text-teal-400 shrink-0" />
          <h3 className="font-semibold text-[var(--text)] text-sm md:text-base truncate">Study AI Assistant</h3>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain space-y-3 md:space-y-4 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loadingMessages ? (
            <div className="text-center text-[var(--text-muted)] text-sm mt-20">Loading conversation...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-[var(--text-muted)] text-sm mt-16 md:mt-20 px-4">
              <Sparkles size={28} className="mx-auto mb-3 text-teal-500/50" />
              <p className="max-w-xs mx-auto">Ask any question, upload a text file for context, or attach/photograph an exercise for help!</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-2xl text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap'
                    : 'bg-black/20 text-[var(--text)] rounded-bl-sm border border-[var(--border)]'
                }`}>
                  {m.image && <img src={m.image.previewUrl} alt="Attached" className="rounded-xl mb-2 max-h-64 w-full object-cover" />}
                  {m.role === 'assistant' ? <MarkdownLite text={m.content} /> : m.content}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-black/20 text-[var(--text-muted)] p-4 rounded-2xl rounded-bl-sm border border-[var(--border)] text-sm animate-pulse">Thinking...</div>
            </div>
          )}
        </div>

        {pendingImage && (
          <div className="py-2 flex items-center gap-2 border-t border-[var(--border)] mt-3 pt-3">
            <img src={pendingImage.previewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-[var(--border)] shrink-0" />
            <span className="text-xs text-teal-400 flex-1 truncate">{fileName} — ready to send</span>
            <button onClick={clearAttachment} className="text-xs text-[var(--text-muted)] hover:text-red-400 cursor-pointer shrink-0">Remove</button>
          </div>
        )}
        {fileName && !pendingImage && (
          <div className="py-1.5 text-xs text-teal-400 border-t border-[var(--border)] mt-3 pt-3 flex items-center justify-between">
            <span className="truncate">Attached: {fileName}</span>
            <button onClick={clearAttachment} className="hover:text-red-400 cursor-pointer shrink-0">Remove</button>
          </div>
        )}
        {uploadError && <div className="py-1.5 text-xs text-red-400">{uploadError}</div>}

        <form onSubmit={sendMessage} className="flex items-center gap-1 md:gap-2 pt-3 mt-1">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[var(--text-muted)] hover:text-[var(--text)] p-2 cursor-pointer shrink-0" title="Attach a file">
            <Paperclip size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,image/*" onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = ''; }} className="hidden" />

          <button type="button" onClick={() => cameraInputRef.current?.click()} className="text-[var(--text-muted)] hover:text-[var(--text)] p-2 cursor-pointer shrink-0" title="Take a picture">
            <Camera size={18} />
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = ''; }} className="hidden" />

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 min-w-0 bg-transparent border border-[var(--border)] rounded-xl px-3 md:px-4 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-teal-500"
          />
          <button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-500 text-white p-2.5 rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}