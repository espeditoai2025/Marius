'use client';

/**
 * FileUploader — Upload documenti con indicizzazione asincrona a batch.
 */

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { processIngestion } from '@/lib/ingestClient';

interface DocumentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  chunksCount: number;
  status: string; // 'processing' | 'ready' | 'error'
  uploadedAt: string;
}

interface FileUploaderProps {
  workspaceId: string;
}

export default function FileUploader({ workspaceId }: FileUploaderProps) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (workspaceId) {
      fetchDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function fetchDocuments() {
    try {
      const res = await fetch(`/api/upload?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error('Errore nel recupero documenti');
      const data = await res.json();
      const docs: DocumentMeta[] = data.documents || [];
      setDocuments(docs);
      // Riprende l'indicizzazione di eventuali documenti rimasti "processing".
      docs.filter(d => d.status === 'processing').forEach(d => runProcessing(d.id));
    } catch (err) {
      console.error('Errore caricamento documenti:', err);
    }
  }

  /** Esegue l'indicizzazione a batch di un documento, aggiornando il progresso. */
  async function runProcessing(docId: string, total?: number) {
    if (inFlight.current.has(docId)) return;
    inFlight.current.add(docId);
    if (total) setProgress(p => ({ ...p, [docId]: { done: 0, total } }));
    try {
      await processIngestion(docId, 'document', workspaceId, pr =>
        setProgress(p => ({ ...p, [docId]: { done: pr.done, total: pr.total } }))
      );
      setDocuments(prev => prev.map(d => (d.id === docId ? { ...d, status: 'ready' } : d)));
    } catch (err: any) {
      setDocuments(prev => prev.map(d => (d.id === docId ? { ...d, status: 'error' } : d)));
      setError(err?.message || "Errore durante l'indicizzazione");
    } finally {
      inFlight.current.delete(docId);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || uploading) return;

    if (file.size > 10 * 1024 * 1024) {
      setError(`File troppo grande: ${(file.size / 1024 / 1024).toFixed(1)} MB. Limite massimo 10 MB.`);
      input.value = '';
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', workspaceId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });

      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await res.text();
        throw new Error('La API non ha restituito JSON: ' + text.slice(0, 200));
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ? `${data.error}\n${data.detail}` : data.error || 'Errore upload');
      }

      // Mostra subito il documento (stato processing), poi avvia l'indicizzazione.
      setDocuments(prev => [data.document, ...prev]);
      runProcessing(data.documentId, data.totalChunks);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Eliminare questo documento e i relativi dati RAG?')) return;
    try {
      const res = await fetch(`/api/upload?workspaceId=${workspaceId}&docId=${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      }
    } catch (err) {
      console.error('Errore eliminazione documento:', err);
    }
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2.5">
        <Upload size={16} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Documenti</h3>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">
          {documents.length}
        </span>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <label className={`relative flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          uploading ? 'bg-white/5 border-violet-500/50' : 'border-white/10 hover:border-violet-500/30 hover:bg-white/5'
        }`}>
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
            accept=".pdf,.docx,.txt,.csv"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="text-violet-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">Caricamento...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-slate-500" />
              <div className="text-center">
                <span className="text-xs text-slate-400 font-medium">Trascina o clicca per caricare</span>
                <p className="text-[10px] text-slate-600 mt-1">PDF, DOCX, TXT, CSV (max 10MB)</p>
              </div>
            </div>
          )}
        </label>

        {error && (
          <div className="px-3 py-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[11px] text-red-400 leading-normal font-medium whitespace-pre-wrap">{error}</p>
              <button
                onClick={() => setError('')}
                className="mt-2 text-[10px] text-red-400/60 hover:text-red-400 underline underline-offset-2"
              >
                Chiudi
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {documents.map(doc => {
            const prog = progress[doc.id];
            const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
            const isProcessing = doc.status === 'processing';
            const isError = doc.status === 'error';
            return (
              <div
                key={doc.id}
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.06] transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  {isProcessing ? (
                    <Loader2 size={16} className="text-violet-400 animate-spin" />
                  ) : (
                    <FileText size={16} className={isError ? 'text-red-400' : 'text-emerald-400'} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-slate-200 font-medium truncate" title={doc.filename}>
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{formatSize(doc.size)}</span>
                    <span>•</span>
                    {isError ? (
                      <span className="text-red-400">Errore indicizzazione</span>
                    ) : isProcessing ? (
                      <span className="text-violet-300">Indicizzazione… {pct}%</span>
                    ) : (
                      <span>{doc.chunksCount} chunks</span>
                    )}
                  </div>
                  {isProcessing && (
                    <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all"
                >
                  <Trash2 size={14} className="text-slate-500 hover:text-red-400" />
                </button>
              </div>
            );
          })}

          {documents.length === 0 && !uploading && (
            <div className="text-center py-8">
              <FileText size={24} className="text-slate-700 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-slate-500">Nessun documento caricato</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
