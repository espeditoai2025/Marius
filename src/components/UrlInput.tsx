'use client';

/**
 * UrlInput — Componente per l'inserimento e l'indicizzazione di URL web.
 */

import { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Loader2, Link as LinkIcon, X } from 'lucide-react';

interface UrlMeta {
  id: string;
  url: string;
  title: string;
  chunksCount: number;
  ingestedAt: string;
}

interface UrlInputProps {
  workspaceId: string;
}

export default function UrlInput({ workspaceId }: UrlInputProps) {
  const [urls, setUrls] = useState<UrlMeta[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUrls();
  }, [workspaceId]);

  async function fetchUrls() {
    try {
      const res = await fetch(`/api/ingest-url?workspaceId=${workspaceId}`);
      const data = await res.json();
      setUrls(data.urls || []);
    } catch (err) {
      console.error('Errore caricamento URL:', err);
    }
  }

  async function handleIngest() {
    if (!inputUrl.trim() || loading) return;

    // Semplice validazione URL
    try {
      new URL(inputUrl);
    } catch {
      setError('Inserisci un URL valido (es: https://google.com)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ingest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, url: inputUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Errore durante l\'ingestion');
      }

      setUrls(prev => [...prev, data.url]);
      setInputUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(urlId: string) {
    if (!confirm('Eliminare questo sito e i relativi dati RAG?')) return;

    try {
      const res = await fetch(`/api/ingest-url?workspaceId=${workspaceId}&urlId=${urlId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setUrls(prev => prev.filter(u => u.id !== urlId));
      }
    } catch (err) {
      console.error('Errore eliminazione URL:', err);
    }
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2.5">
        <Globe size={16} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Siti Web</h3>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px]">
          {urls.length}
        </span>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Input URL */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="https://esempio.it"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleIngest()}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/30 transition-all"
              />
            </div>
            <button
              onClick={handleIngest}
              disabled={loading || !inputUrl.trim()}
              className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')}><X size={12} /></button>
            </div>
          )}
        </div>

        {/* Lista URL */}
        <div className="space-y-2">
          {urls.map(u => (
            <div
              key={u.id}
              className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.06] transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Globe size={16} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-slate-200 font-medium truncate" title={u.title || u.url}>
                  {u.title || u.url}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="truncate">{u.url}</span>
                  <span>•</span>
                  <span className="flex-shrink-0">{u.chunksCount} chunks</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(u.id)}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all"
              >
                <Trash2 size={14} className="text-slate-500 hover:text-red-400" />
              </button>
            </div>
          ))}

          {urls.length === 0 && !loading && (
            <div className="text-center py-8">
              <Globe size={24} className="text-slate-700 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-slate-500">Nessun URL indicizzato</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
