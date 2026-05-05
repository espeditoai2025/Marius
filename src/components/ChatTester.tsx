'use client';

/**
 * ChatTester — Interfaccia chat per testare l'agente AI con RAG.
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, FileText, Globe, Trash2 } from 'lucide-react';

interface Source {
  type: 'document' | 'url';
  name: string;
  snippet: string;
  relevance: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  model?: string;
  timestamp: string;
}

interface ChatTesterProps {
  workspaceId: string;
  onSourcesUpdate?: (sources: Source[]) => void;
}

export default function ChatTester({ workspaceId, onSourcesUpdate }: ChatTesterProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Carica cronologia
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/chat?workspaceId=${workspaceId}`);
        const data = await res.json();
        setMessages(data.history || []);
      } catch (err) {
        console.error('Errore caricamento chat:', err);
      }
    }
    load();
  }, [workspaceId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setError('');
    setLoading(true);

    // Aggiungi messaggio utente localmente
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, question }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Errore nella risposta');
      }

      const assistantMsg: ChatMessage = {
        id: data.messageId || Date.now().toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        model: data.model,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Aggiorna fonti nel pannello destro
      if (onSourcesUpdate && data.sources) {
        onSourcesUpdate(data.sources);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleClear() {
    if (!confirm('Eliminare tutta la cronologia chat?')) return;
    try {
      await fetch(`/api/chat?workspaceId=${workspaceId}`, { method: 'DELETE' });
      setMessages([]);
    } catch (err) {
      console.error('Errore pulizia chat:', err);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <Bot size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Chat di Test</h3>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px]">
            {messages.length} messaggi
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 text-xs hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <Trash2 size={12} />
            Pulisci
          </button>
        )}
      </div>

      {/* Messaggi */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot size={40} className="text-slate-600 mb-3" />
            <p className="text-sm text-slate-500">Nessun messaggio</p>
            <p className="text-xs text-slate-600 mt-1">Fai una domanda per testare l&apos;agente</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-violet-300" />
              </div>
            )}

            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-violet-600/80 to-blue-600/80 text-white rounded-br-md'
                    : 'bg-white/[0.05] text-slate-200 border border-white/[0.06] rounded-bl-md'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>

              {/* Fonti e modello */}
              {msg.role === 'assistant' && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 px-1">
                  {msg.model && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 text-[10px]">
                      {msg.model.split('/').pop()}
                    </span>
                  )}
                  {msg.sources?.map((s, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        s.type === 'document'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {s.type === 'document' ? <FileText size={8} className="inline mr-1" /> : <Globe size={8} className="inline mr-1" />}
                      {s.name.slice(0, 30)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-blue-300" />
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-violet-300" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.05] border border-white/[0.06]">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Sto elaborando...
              </div>
            </div>
          </div>
        )}

        {/* Errore */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi una domanda..."
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/10 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 flex items-center justify-center text-white hover:from-violet-500 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
