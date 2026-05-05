'use client';

/**
 * SourceList — Visualizza le fonti utilizzate nell'ultima risposta dell'agente.
 */

import { FileText, Globe, ExternalLink, Info } from 'lucide-react';

interface Source {
  type: 'document' | 'url';
  name: string;
  snippet: string;
  relevance: number;
}

interface SourceListProps {
  sources: Source[];
}

export default function SourceList({ sources }: SourceListProps) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2.5">
        <Info size={16} className="text-violet-400" />
        <h3 className="text-sm font-semibold text-white">Fonti Rilevanti</h3>
        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px]">
          {sources.length}
        </span>
      </div>

      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Info size={24} className="text-slate-700 mb-2 opacity-50" />
            <p className="text-xs text-slate-500 px-4">
              Fai una domanda per vedere quali fonti vengono citate.
            </p>
          </div>
        ) : (
          sources.map((source, i) => (
            <div
              key={i}
              className="group p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:border-violet-500/20 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                    source.type === 'document' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {source.type === 'document' ? <FileText size={12} /> : <Globe size={12} />}
                  </div>
                  <span className="text-[12px] text-slate-200 font-medium truncate" title={source.name}>
                    {source.name}
                  </span>
                </div>
                <div className="flex-shrink-0 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-400">
                  {Math.round(source.relevance * 100)}%
                </div>
              </div>
              
              <div className="text-[11px] text-slate-400 leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5 italic">
                &quot;{source.snippet}&quot;
              </div>
              
              {source.type === 'url' && (
                <a
                  href={source.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors pt-1"
                >
                  <ExternalLink size={10} />
                  Visita sito
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
