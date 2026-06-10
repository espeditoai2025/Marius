'use client';

/**
 * UrlInput — Inserimento e indicizzazione asincrona di URL web.
 */

import { useState, useEffect, useRef } from 'react';
import { Globe, Plus, Trash2, Loader2, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { processIngestion } from '@/lib/ingestClient';

interface UrlMeta {
  id: string;
  url: string;
  title: string;
  chunksCount: number;
  status: string; // 'processing' | 'ready' | 'error'
  ingestedAt: string;
}

interface UrlInputProps {
  workspaceId: string;
}

type IngestMode = 'page' | 'section';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function UrlInput({ workspaceId }: UrlInputProps) {
  const [urls, setUrls] = useState<UrlMeta[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const [mode, setMode] = useState<IngestMode>('page');
  const [maxPages, setMaxPages] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; details: string } | null>(null);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (workspaceId) {
      fetchUrls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function fetchUrls() {
    try {
      const res = await fetch(`/api/ingest-url?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error('Errore recupero URL');
      const data = await res.json();
      const list: UrlMeta[] = data.urls || [];
      setUrls(list);
      list.filter(u => u.status === 'processing').forEach(u => runProcessing(u.id));
    } catch (err) {
      console.error('Errore caricamento URL:', err);
    }
  }

  /** Indicizzazione a batch di un URL, con aggiornamento del progresso. */
  async function runProcessing(urlId: string, total?: number) {
    if (inFlight.current.has(urlId)) return;
    inFlight.current.add(urlId);
    if (total) setProgress(p => ({ ...p, [urlId]: { done: 0, total } }));
    try {
      await processIngestion(urlId, 'url', workspaceId, pr =>
        setProgress(p => ({ ...p, [urlId]: { done: pr.done, total: pr.total } }))
      );
      setUrls(prev => prev.map(u => (u.id === urlId ? { ...u, status: 'ready' } : u)));
    } catch (err) {
      setUrls(prev => prev.map(u => (u.id === urlId ? { ...u, status: 'error' } : u)));
      setError({ title: 'Errore indicizzazione', details: getErrorMessage(err) || 'Indicizzazione non completata.' });
    } finally {
      inFlight.current.delete(urlId);
    }
  }

  async function handleIngest() {
    if (!inputUrl.trim() || loading) return;

    try {
      new URL(inputUrl);
    } catch {
      setError({ title: 'URL non valido', details: 'Inserisci un indirizzo completo (es: https://google.com)' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ingest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          url: inputUrl,
          mode,
          maxPages: mode === 'section' ? maxPages : 1,
          maxDepth: mode === 'section' ? 2 : 0,
        }),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Il server ha risposto in modo inaspettato. Controlla i log di Vercel.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "Errore durante l'ingestion");
      }

      setUrls(prev => [data.url, ...prev]);
      setInputUrl('');
      runProcessing(data.sourceId, data.totalChunks);
    } catch (err) {
      setError({
        title: 'Errore Ingestion',
        details: getErrorMessage(err) || 'Errore sconosciuto durante la lettura del sito.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(urlId: string) {
    if (!confirm('Eliminare questo sito e i relativi dati RAG?')) return;
    try {
      const res = await fetch(`/api/ingest-url?workspaceId=${workspaceId}&urlId=${urlId}`, { method: 'DELETE' });
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

          <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 p-0.5 rounded-xl bg-white/5 border border-white/10 flex-1">
              <button
                type="button"
                onClick={() => setMode('page')}
                className={`py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  mode === 'page' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Pagina
              </button>
              <button
                type="button"
                onClick={() => setMode('section')}
                className={`py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  mode === 'section' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Sezione
              </button>
            </div>

            {mode === 'section' && (
              <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
                Pagine
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxPages}
                  onChange={e => setMaxPages(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-12 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-500/30"
                />
              </label>
            )}
          </div>

          {error && (
            <div className="px-3 py-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
              <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[11px] text-amber-300 font-semibold">{error.title}</p>
                <p className="text-[10px] text-amber-400/80 leading-normal mt-1">{error.details}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-[10px] text-amber-400/60 hover:text-amber-400 underline underline-offset-2"
                >
                  Chiudi
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {urls.map(u => {
            const prog = progress[u.id];
            const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
            const isProcessing = u.status === 'processing';
            const isError = u.status === 'error';
            return (
              <div
                key={u.id}
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.06] transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  {isProcessing ? (
                    <Loader2 size={16} className="text-violet-400 animate-spin" />
                  ) : (
                    <Globe size={16} className={isError ? 'text-red-400' : 'text-amber-400'} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-slate-200 font-medium truncate" title={u.title || u.url}>
                    {u.title || u.url}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="truncate">{u.url}</span>
                    <span>•</span>
                    {isError ? (
                      <span className="text-red-400 flex-shrink-0">Errore</span>
                    ) : isProcessing ? (
                      <span className="text-violet-300 flex-shrink-0">Indicizzazione… {pct}%</span>
                    ) : (
                      <span className="flex-shrink-0">{u.chunksCount} chunks</span>
                    )}
                  </div>
                  {isProcessing && (
                    <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all"
                >
                  <Trash2 size={14} className="text-slate-500 hover:text-red-400" />
                </button>
              </div>
            );
          })}

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
