'use client';

/**
 * FileUploader — Componente per l'upload e la gestione dei documenti.
 */

import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Loader2, X } from 'lucide-react';

interface DocumentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  chunksCount: number;
  uploadedAt: string;
}

interface FileUploaderProps {
  workspaceId: string;
}

export default function FileUploader({ workspaceId }: FileUploaderProps) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [workspaceId]);

  async function fetchDocuments() {
    try {
      const res = await fetch(`/api/upload?workspaceId=${workspaceId}`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Errore caricamento documenti:', err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', workspaceId);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Errore durante l\'upload');
      }

      setDocuments(prev => [...prev, data.document]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setUploading(false);
      // Reset input file
      e.target.value = '';
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Eliminare questo documento e i relativi dati RAG?')) return;

    try {
      const res = await fetch(`/api/upload?workspaceId=${workspaceId}&docId=${docId}`, {
        method: 'DELETE',
      });

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
        {/* Area Upload */}
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
              <span className="text-xs text-slate-400 font-medium">Elaborazione...</span>
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
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}><X size={12} /></button>
          </div>
        )}

        {/* Lista Documenti */}
        <div className="space-y-2">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.06] transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-slate-200 font-medium truncate" title={doc.filename}>
                  {doc.filename}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{formatSize(doc.size)}</span>
                  <span>•</span>
                  <span>{doc.chunksCount} chunks</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all"
              >
                <Trash2 size={14} className="text-slate-500 hover:text-red-400" />
              </button>
            </div>
          ))}

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
