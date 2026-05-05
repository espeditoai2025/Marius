import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { FlaskConical, ArrowRight, Sparkles, Database, Globe, Cpu } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <WorkspaceSidebar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-3xl w-full text-center space-y-8 relative z-10 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-violet-400 text-xs font-semibold mb-4">
            <Sparkles size={14} />
            <span>AI-Powered Financial Intelligence</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight">
            Il tuo Laboratorio di <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400">
              Agenti AI Finanziari
            </span>
          </h1>
          
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Costruisci, testa e ottimizza agenti RAG specializzati nel settore finanziario. 
            Carica documenti, indicizza siti web e interroga i tuoi dati con DeepSeek v4 Flash.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                <Database size={20} />
              </div>
              <h3 className="text-sm font-semibold text-white">Document RAG</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Carica PDF, DOCX e CSV. Chunking automatico ed embedding per ricerca semantica.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Globe size={20} />
              </div>
              <h3 className="text-sm font-semibold text-white">Web Ingestion</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Inserisci URL per estrarre contenuti web e usarli come base di conoscenza.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Cpu size={20} />
              </div>
              <h3 className="text-sm font-semibold text-white">Prompt Engineering</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Editor dedicato per raffinare il comportamento dell&apos;agente e le sue istruzioni.</p>
            </div>
          </div>
          
          <div className="pt-8 flex flex-col items-center gap-4">
            <p className="text-sm text-slate-500">Seleziona o crea un workspace dalla sidebar per iniziare</p>
            <div className="animate-bounce mt-4">
              <ArrowRight size={20} className="text-slate-700 rotate-180" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
