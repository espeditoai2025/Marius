'use client';

/**
 * PromptEditor — Editor per il prompt dell'agente AI + parametro Temperatura.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, Sparkles, Check, Thermometer } from 'lucide-react';

interface PromptEditorProps {
  workspaceId: string;
}

const DEFAULT_PROMPT = `Sei un assistente AI finanziario esperto. Il tuo compito è:

1. Analizzare documenti e dati finanziari forniti nel contesto
2. Rispondere in modo preciso, professionale e strutturato
3. Citare le fonti quando disponibili
4. Segnalare eventuali incertezze o limitazioni nei dati
5. Fornire analisi e insights utili per decisioni finanziarie

Rispondi sempre in italiano.`;

/** Suggerimento dinamico in base alla temperatura impostata. */
function tempHint(t: number): string {
  if (t <= 0.3) return 'Deterministica e ancorata ai dati. Consigliata per la finanza.';
  if (t <= 0.7) return 'Bilanciata: più varietà nel linguaggio, ancora controllata.';
  return 'Creativa e variabile, ma maggior rischio di imprecisioni.';
}

export default function PromptEditor({ workspaceId }: PromptEditorProps) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [temperature, setTemperature] = useState(0);
  const [savedTemperature, setSavedTemperature] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = content !== savedContent || temperature !== savedTemperature;

  // Carica prompt + temperatura
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/prompt?workspaceId=${workspaceId}`);
        const data = await res.json();
        const text = data.prompt?.content || DEFAULT_PROMPT;
        const temp = typeof data.prompt?.temperature === 'number' ? data.prompt.temperature : 0;
        setContent(text);
        setSavedContent(text);
        setTemperature(temp);
        setSavedTemperature(temp);
      } catch (err) {
        console.error('Errore caricamento prompt:', err);
        setContent(DEFAULT_PROMPT);
        setSavedContent(DEFAULT_PROMPT);
      }
    }
    load();
  }, [workspaceId]);

  // Salvataggio
  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, content, temperature }),
      });
      setSavedContent(content);
      setSavedTemperature(temperature);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Errore salvataggio prompt:', err);
    } finally {
      setSaving(false);
    }
  }, [workspaceId, content, temperature, isDirty, saving]);

  // Ctrl+S shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} className="text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Prompt Agente</h3>
          {isDirty && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-medium">
              Non salvato
            </span>
          )}
          {saved && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
              <Check size={10} /> Salvato
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 text-xs font-medium hover:bg-violet-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Save size={12} />
          {saving ? 'Salvataggio...' : 'Salva'}
          <span className="text-violet-500/60 text-[10px] ml-1">Ctrl+S</span>
        </button>
      </div>

      {/* Editor */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Inserisci il prompt per il tuo agente AI..."
        className="w-full h-44 px-5 py-4 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none leading-relaxed font-mono"
        spellCheck={false}
      />

      {/* Temperatura */}
      <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.015]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Thermometer size={14} className="text-orange-400" />
            <span className="text-xs font-semibold text-slate-200">Temperatura</span>
            <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 text-[10px] font-mono tabular-nums">
              {temperature.toFixed(1)}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">0 = preciso · 1 = creativo</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 w-12 text-right">Preciso</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            className="flex-1 accent-orange-500 cursor-pointer"
            aria-label="Temperatura del modello"
          />
          <span className="text-[10px] text-slate-500 w-12">Creativo</span>
        </div>

        <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
          Controlla quanto le risposte sono casuali. <span className="text-slate-400">{tempHint(temperature)}</span>
        </p>
      </div>
    </div>
  );
}
