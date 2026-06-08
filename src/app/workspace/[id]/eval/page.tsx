'use client';

/**
 * Eval Page — Valutazione dell'agente con test set + giudice LLM (Claude).
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Play, Loader2, Gauge, AlertCircle, History,
} from 'lucide-react';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';

interface Question { id: string; question: string; expected?: string }
interface Result {
  id: string; question: string; answer: string;
  score: number; groundedness: number; correctness: number; feedback: string; sourcesCount?: number;
}
interface Run { id: string; status: string; avgScore: number | null; total: number; createdAt: string }

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-400';
  if (s >= 50) return 'text-amber-400';
  return 'text-red-400';
}
function scoreBg(s: number) {
  if (s >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (s >= 50) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export default function EvalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = use(params);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQ, setNewQ] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [adding, setAdding] = useState(false);

  const [results, setResults] = useState<Result[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [avg, setAvg] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuestions();
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function loadQuestions() {
    try {
      const res = await fetch(`/api/eval/questions?workspaceId=${workspaceId}`);
      if (res.ok) setQuestions((await res.json()).questions || []);
    } catch { /* ignore */ }
  }

  async function loadRuns() {
    try {
      const res = await fetch(`/api/eval/runs?workspaceId=${workspaceId}`);
      if (res.ok) setRuns((await res.json()).runs || []);
    } catch { /* ignore */ }
  }

  async function addQuestion() {
    if (!newQ.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/eval/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, question: newQ, expected: newExpected }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(prev => [...prev, data.question]);
        setNewQ('');
        setNewExpected('');
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteQuestion(qid: string) {
    await fetch(`/api/eval/questions?workspaceId=${workspaceId}&questionId=${qid}`, { method: 'DELETE' });
    setQuestions(prev => prev.filter(q => q.id !== qid));
  }

  async function runEval() {
    if (running || questions.length === 0) return;
    setRunning(true);
    setError('');
    setResults([]);
    setAvg(null);
    try {
      const r = await fetch('/api/eval/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Impossibile avviare la valutazione');

      const { runId, questionIds, total } = data as { runId: string; questionIds: string[]; total: number };
      setProgress({ done: 0, total });

      for (const qid of questionIds) {
        const sr = await fetch('/api/eval/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, runId, questionId: qid }),
        });
        const sd = await sr.json();
        if (!sr.ok) throw new Error(sd.detail || sd.error || 'Errore durante la valutazione');
        setResults(prev => [...prev, sd.result]);
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }

      const fr = await fetch('/api/eval/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, runId }),
      });
      const fd = await fr.json();
      setAvg(typeof fd.avgScore === 'number' ? fd.avgScore : null);
      loadRuns();
    } catch (e: any) {
      setError(e?.message || 'Errore sconosciuto');
    } finally {
      setRunning(false);
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      <WorkspaceSidebar />

      <main className="flex-1 flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/workspace/${workspaceId}`}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Gauge size={18} className="text-emerald-400" /> Valutazione
              </h1>
              <p className="text-xs text-slate-500">Test set + giudice AI (Claude) per misurare la qualità dell&apos;agente</p>
            </div>
          </div>
          <button
            onClick={runEval}
            disabled={running || questions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? `Valutazione… ${pct}%` : 'Esegui valutazione'}
          </button>
        </div>

        {/* Progress bar */}
        {running && (
          <div className="mb-6 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-sm text-red-300">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Test set */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Test set ({questions.length})</h3>

              <div className="space-y-2 mb-4">
                <textarea
                  value={newQ}
                  onChange={e => setNewQ(e.target.value)}
                  placeholder="Domanda golden (es: Quanto costa il canone mensile?)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-emerald-500/40 transition-all"
                />
                <textarea
                  value={newExpected}
                  onChange={e => setNewExpected(e.target.value)}
                  placeholder="Risposta attesa (opzionale)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-emerald-500/40 transition-all"
                />
                <button
                  onClick={addQuestion}
                  disabled={!newQ.trim() || adding}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-40 transition-all"
                >
                  <Plus size={14} /> Aggiungi domanda
                </button>
              </div>

              <div className="space-y-2">
                {questions.map(q => (
                  <div key={q.id} className="group flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-slate-200 leading-snug">{q.question}</p>
                      {q.expected && <p className="text-[10px] text-slate-500 mt-1 truncate">Attesa: {q.expected}</p>}
                    </div>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all flex-shrink-0"
                    >
                      <Trash2 size={12} className="text-slate-500 hover:text-red-400" />
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">Aggiungi domande per valutare l&apos;agente.</p>
                )}
              </div>
            </div>

            {/* Storico */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <History size={14} className="text-slate-400" /> Storico
              </h3>
              <div className="space-y-2">
                {runs.filter(r => r.status === 'done').map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {new Date(r.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      <span className="text-slate-600"> · {r.total} dom.</span>
                    </span>
                    <span className={`font-semibold ${scoreColor(r.avgScore ?? 0)}`}>{r.avgScore ?? 0}/100</span>
                  </div>
                ))}
                {runs.filter(r => r.status === 'done').length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-2">Nessuna run completata.</p>
                )}
              </div>
            </div>
          </div>

          {/* Risultati */}
          <div className="lg:col-span-2 space-y-4">
            {avg !== null && (
              <div className={`rounded-2xl border p-5 flex items-center justify-between ${scoreBg(avg)}`}>
                <div>
                  <p className="text-xs text-slate-400">Punteggio medio</p>
                  <p className="text-xs text-slate-500 mt-0.5">{results.length} domande valutate</p>
                </div>
                <span className={`text-3xl font-bold ${scoreColor(avg)}`}>{avg}<span className="text-base text-slate-500">/100</span></span>
              </div>
            )}

            {results.length === 0 && !running && (
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-10 text-center">
                <Gauge size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Nessun risultato</p>
                <p className="text-xs text-slate-600 mt-1">Aggiungi domande e premi &quot;Esegui valutazione&quot;.</p>
              </div>
            )}

            <div className="space-y-3">
              {results.map((res, i) => (
                <div key={res.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm text-slate-200 font-medium flex-1">
                      <span className="text-slate-500 mr-1.5">{i + 1}.</span>{res.question}
                    </p>
                    <span className={`text-lg font-bold ${scoreColor(res.score)} flex-shrink-0`}>{res.score}</span>
                  </div>
                  <div className="flex gap-3 mb-2 text-[10px]">
                    <span className="text-slate-500">Groundedness <span className={scoreColor(res.groundedness)}>{res.groundedness}</span></span>
                    <span className="text-slate-500">Correttezza <span className={scoreColor(res.correctness)}>{res.correctness}</span></span>
                    {typeof res.sourcesCount === 'number' && <span className="text-slate-600">· {res.sourcesCount} fonti</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 italic border-l-2 border-white/10 pl-2.5 mb-2">{res.feedback}</p>
                  <details className="text-[11px]">
                    <summary className="text-slate-500 cursor-pointer hover:text-slate-400">Risposta dell&apos;agente</summary>
                    <p className="text-slate-400 mt-1.5 whitespace-pre-wrap leading-relaxed">{res.answer}</p>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
