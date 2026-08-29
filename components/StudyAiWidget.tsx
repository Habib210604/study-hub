'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Paperclip, Sparkles, Camera, Plus, History, Trash2, ArrowLeft, CheckSquare, Square } from 'lucide-react';
import { useAiChat } from '@/hooks/useAiChat';
import MarkdownLite from '@/components/MarkdownLite';

export default function StudyAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const goToNewChat = () => {
    startNewChat();
    setShowHistory(false);
  };

  const openFromHistory = async (id: string) => {
    await openConversation(id);
    setShowHistory(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-teal-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition flex items-center gap-2 cursor-pointer"
        >
          <Bot size={24} />
          <span className="text-sm font-semibold">Study AI</span>
        </button>
      ) : (
        <div className="bg-slate-900 border border-slate-800 w-96 h-[560px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {showHistory ? (
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <Bot size={20} className="text-teal-400" />
              )}
              <h3 className="font-semibold text-sm text-slate-200">{showHistory ? 'Chat History' : 'Study AI Assistant'}</h3>
            </div>
            <div className="flex items-center gap-1">
              {!showHistory && (
                <>
                  <button onClick={goToNewChat} title="New Chat" className="text-slate-400 hover:text-teal-400 p-1.5 cursor-pointer">
                    <Plus size={16} />
                  </button>
                  <button onClick={() => setShowHistory(true)} title="History" className="text-slate-400 hover:text-teal-400 p-1.5 cursor-pointer">
                    <History size={16} />
                  </button>
                </>
              )}
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-1.5 cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>

          {showHistory ? (
            // ============ HISTORY PANEL ============
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedIds([]); }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {selectMode ? 'Cancel' : 'Select'}
                </button>
                {selectMode && selectedIds.length > 0 && (
                  <button onClick={confirmDelete} className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1">
                    <Trash2 size={12} /> Delete ({selectedIds.length})
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingConversations ? (
                  <p className="text-center text-slate-500 text-xs mt-10">Loading...</p>
                ) : conversations.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs mt-10">No past conversations yet.</p>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => (selectMode ? toggleSelect(c.id) : openFromHistory(c.id))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition ${
                        activeConversationId === c.id ? 'bg-teal-500/10 border border-teal-500/30' : 'hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      {selectMode && (
                        selectedIds.includes(c.id) ? <CheckSquare size={14} className="text-teal-400 shrink-0" /> : <Square size={14} className="text-slate-600 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-200 truncate">{c.title || 'New Chat'}</p>
                        <p className="text-[10px] text-slate-500">{new Date(c.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // ============ CHAT VIEW ============
            <>
              <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3">
                {loadingMessages ? (
                  <div className="text-center text-slate-500 text-xs mt-20">Loading conversation...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-slate-500 text-xs mt-20">
                    <Sparkles size={24} className="mx-auto mb-2 text-teal-500/50" />
                    Ask any question, upload a text file for context, or attach/photograph an exercise for help!
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-xl text-xs ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none whitespace-pre-wrap'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                      }`}>
                        {m.image && <img src={m.image.previewUrl} alt="Attached" className="rounded-lg mb-2 max-h-40 w-full object-cover" />}
                        {m.role === 'assistant' ? <MarkdownLite text={m.content} /> : m.content}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-slate-400 p-3 rounded-xl rounded-bl-none border border-slate-700 text-xs animate-pulse">Thinking...</div>
                  </div>
                )}
              </div>

              {pendingImage && (
                <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                  <img src={pendingImage.previewUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-slate-700" />
                  <span className="text-[10px] text-teal-400 flex-1 truncate">{fileName} — ready to send</span>
                  <button onClick={clearAttachment} className="text-[10px] text-slate-500 hover:text-red-400 cursor-pointer">Remove</button>
                </div>
              )}
              {fileName && !pendingImage && (
                <div className="px-4 py-1.5 bg-slate-950 text-[10px] text-teal-400 border-t border-slate-800 flex items-center justify-between">
                  <span className="truncate">Attached: {fileName}</span>
                  <button onClick={clearAttachment} className="hover:text-red-400 cursor-pointer">Remove</button>
                </div>
              )}
              {uploadError && <div className="px-4 py-1.5 bg-red-500/10 text-[10px] text-red-400 border-t border-red-500/20">{uploadError}</div>}

              <form onSubmit={sendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-slate-200 p-2 cursor-pointer" title="Attach a file">
                  <Paperclip size={16} />
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.md,image/*" onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = ''; }} className="hidden" />

                <button type="button" onClick={() => cameraInputRef.current?.click()} className="text-slate-400 hover:text-slate-200 p-2 cursor-pointer" title="Take a picture">
                  <Camera size={16} />
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = ''; }} className="hidden" />

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
                <button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-500 text-white p-2 rounded-xl transition cursor-pointer disabled:opacity-50">
                  <Send size={14} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}