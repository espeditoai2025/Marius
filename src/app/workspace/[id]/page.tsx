'use client';

/**
 * Workspace Page — Il cuore operativo della piattaforma.
 * Layout a 3 colonne: Sidebar | Editor + Chat | Gestione Fonti
 */

import { useState, use } from 'react';
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import PromptEditor from "@/components/PromptEditor";
import ChatTester from "@/components/ChatTester";
import FileUploader from "@/components/FileUploader";
import UrlInput from "@/components/UrlInput";
import SourceList from "@/components/SourceList";

interface Source {
  type: 'document' | 'url';
  name: string;
  snippet: string;
  relevance: number;
}

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeSources, setActiveSources] = useState<Source[]>([]);

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Colonna 1: Workspace Navigation */}
      <WorkspaceSidebar />

      {/* Colonna 2: Core Testing (Center) */}
      <main className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
        <div className="animate-fade-in delay-75">
          <PromptEditor workspaceId={id} />
        </div>
        <div className="flex-1 animate-fade-in delay-150">
          <ChatTester 
            workspaceId={id} 
            onSourcesUpdate={setActiveSources} 
          />
        </div>
      </main>

      {/* Colonna 3: Knowledge Management (Right) */}
      <aside className="w-80 flex flex-col gap-4 p-4 border-l border-white/5 bg-[#0c0c14] overflow-y-auto animate-fade-in delay-300">
        <div className="h-[280px]">
          <FileUploader workspaceId={id} />
        </div>
        <div className="h-[240px]">
          <UrlInput workspaceId={id} />
        </div>
        <div className="flex-1 min-h-[300px]">
          <SourceList sources={activeSources} />
        </div>
      </aside>
    </div>
  );
}
