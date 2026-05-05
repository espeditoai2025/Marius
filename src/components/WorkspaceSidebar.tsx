'use client';

/**
 * WorkspaceSidebar — Sidebar con lista workspace e creazione nuovi.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FolderOpen, Plus, Trash2, FlaskConical, ChevronRight,
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export default function WorkspaceSidebar() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const activeId = params?.id as string;

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  async function fetchWorkspaces() {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      console.error('Errore caricamento workspace:', err);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      const data = await res.json();
      if (data.workspace) {
        setWorkspaces(prev => [...prev, data.workspace]);
        setNewName('');
        setNewDesc('');
        setShowCreate(false);
        router.push(`/workspace/${data.workspace.id}`);
      }
    } catch (err) {
      console.error('Errore creazione workspace:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Eliminare questo workspace e tutti i suoi dati?')) return;
    try {
      await fetch(`/api/workspaces?id=${id}`, { method: 'DELETE' });
      setWorkspaces(prev => prev.filter(w => w.id !== id));
      if (activeId === id) router.push('/');
    } catch (err) {
      console.error('Errore eliminazione workspace:', err);
    }
  }

  return (
    <aside className="w-72 min-h-screen bg-[#0c0c14] border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => router.push('/')}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <FlaskConical size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">Financial AI Lab</h1>
            <p className="text-[10px] text-slate-500">RAG Testing Platform</p>
          </div>
        </div>
      </div>

      {/* Lista workspace */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3 px-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Workspace</span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center transition-all hover:scale-110"
          >
            <Plus size={14} className="text-slate-400 hover:text-violet-400" />
          </button>
        </div>

        {/* Form creazione */}
        {showCreate && (
          <div className="mb-3 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <input
              type="text"
              placeholder="Nome workspace..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
              autoFocus
            />
            <input
              type="text"
              placeholder="Descrizione (opzionale)..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={loading || !newName.trim()}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-semibold hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 transition-all"
              >
                {loading ? 'Creazione...' : 'Crea'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 rounded-lg bg-white/5 text-slate-400 text-xs hover:bg-white/10 transition-all"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="space-y-1">
          {workspaces.map(ws => (
            <div
              key={ws.id}
              onClick={() => router.push(`/workspace/${ws.id}`)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                activeId === ws.id
                  ? 'bg-violet-500/15 border border-violet-500/20 shadow-sm shadow-violet-500/5'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <FolderOpen
                size={16}
                className={activeId === ws.id ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-400'}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${activeId === ws.id ? 'text-white font-medium' : 'text-slate-300'}`}>
                  {ws.name}
                </p>
                {ws.description && (
                  <p className="text-[10px] text-slate-500 truncate">{ws.description}</p>
                )}
              </div>
              {activeId === ws.id && (
                <ChevronRight size={14} className="text-violet-400" />
              )}
              <button
                onClick={e => handleDelete(ws.id, e)}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all"
              >
                <Trash2 size={12} className="text-slate-500 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>

        {workspaces.length === 0 && !showCreate && (
          <div className="text-center py-8 px-4">
            <FolderOpen size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Nessun workspace</p>
            <p className="text-xs text-slate-600 mt-1">Crea il tuo primo workspace per iniziare</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <p className="text-[10px] text-slate-600 text-center">
          Powered by DeepSeek v4 Flash
        </p>
      </div>
    </aside>
  );
}
