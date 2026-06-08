import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { FlaskConical, ArrowRight, Database, SlidersHorizontal, Network, Gauge } from "lucide-react";

const FEATURES = [
  {
    icon: Database,
    color: "violet",
    title: "RAG su documenti & web",
    desc: "Carica PDF, DOCX, CSV o indicizza siti. Chunking ed embedding per risposte ancorate ai dati, con citazione delle fonti.",
    tag: null,
  },
  {
    icon: SlidersHorizontal,
    color: "orange",
    title: "Controllo prompt & temperatura",
    desc: "Modella la Direttiva Primaria dell'agente e regola la temperatura: da deterministico e preciso a più creativo.",
    tag: null,
  },
  {
    icon: Network,
    color: "blue",
    title: "Workflow multi-agente",
    desc: "Orchestra più agenti specializzati in parallelo, ognuno con la propria conoscenza e il proprio comportamento.",
    tag: "Presto",
  },
  {
    icon: Gauge,
    color: "emerald",
    title: "Valutazione & ottimizzazione",
    desc: "Testa le risposte su set di domande, confronta le versioni di prompt e affina con metriche, non a occhio.",
    tag: "Presto",
  },
] as const;

const COLORS: Record<string, string> = {
  violet: "bg-violet-500/10 text-violet-400",
  orange: "bg-orange-500/10 text-orange-400",
  blue: "bg-blue-500/10 text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
};

export default function Home() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <WorkspaceSidebar />

      <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-4xl w-full text-center space-y-8 relative z-10 animate-slide-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-violet-300 text-xs font-semibold tracking-wide">
            <FlaskConical size={14} />
            <span>AGENT LAB · Financial Intelligence</span>
          </div>

          {/* Hero */}
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight">
            Costruisci agenti AI <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400">
              finanziari, in parallelo
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Il laboratorio dove progetti, testi e ottimizzi agenti RAG specializzati.
            Dai loro documenti e regole, controlla prompt e temperatura, e mettili alla prova —
            il tutto su DeepSeek e ricerca semantica.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-left">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3 hover:bg-white/[0.05] transition-colors"
                >
                  {f.tag && (
                    <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-medium">
                      {f.tag}
                    </span>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${COLORS[f.color]}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="pt-6 flex flex-col items-center gap-3">
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <ArrowRight size={16} className="text-slate-600 rotate-180" />
              Seleziona o crea un workspace dalla sidebar per iniziare
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
