'use client';

import { useState } from 'react';
import { Bot, X, Send, Paperclip, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function StudyAiwidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [fileContext, setFileContext] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const text = await file.text();
    setFileContext(text.slice(0, 15000));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageContent = input;
    setInput('');

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          context: fileContext,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
      };

      setMessages([...updatedMessages, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages([
        ...updatedMessages,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error connecting to the AI assistant. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
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
        <div className="bg-slate-900 border border-slate-800 w-96 h-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-teal-400" />
              <h3 className="font-semibold text-sm text-slate-200">Study AI Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 text-xs mt-20">
                <Sparkles size={24} className="mx-auto mb-2 text-teal-500/50" />
                Ask any question about your courses or upload a text file for context!
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-xl text-xs whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 p-3 rounded-xl rounded-bl-none border border-slate-700 text-xs animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* File attached indicator */}
          {fileName && (
            <div className="px-4 py-1.5 bg-slate-950 text-[10px] text-teal-400 border-t border-slate-800 flex items-center justify-between">
              <span className="truncate">Attached: {fileName}</span>
              <button onClick={() => { setFileName(''); setFileContext(''); }} className="hover:text-red-400 cursor-pointer">Remove</button>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={onSubmit} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <label className="cursor-pointer text-slate-400 hover:text-slate-200 p-2">
              <Paperclip size={16} />
              <input type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
            </label>
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
        </div>
      )}
    </div>
  );
}