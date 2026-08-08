import Link from "next/link";
import {
  FlaskConical, ArrowRight, FileSearch, ShieldCheck, Table2, SlidersHorizontal,
  Gauge, FolderLock, Landmark, Calculator, UserRoundCheck, Upload, MessageSquareQuote,
  Download, Globe, Check,
} from "lucide-react";

export const metadata = {
  title: "Agent Lab — L'assistente che risponde solo dai tuoi documenti",
  description:
    "Per banche, studi professionali e consulenti finanziari: carica fogli informativi, contratti e circolari, e ottieni risposte con la fonte sempre citata.",
};

/* ---------- dati di pagina ---------- */

const CAPABILITIES = [
  {
    icon: FileSearch,
    tint: "text-violet-300 bg-violet-500/10",
    title: "Risposte con la fonte citata",
    desc: "Sotto ogni risposta trovi i documenti da cui è stata ricavata, con l'estratto pertinente. Nessuna affermazione che non puoi risalire alla carta.",
  },
  {
    icon: ShieldCheck,
    tint: "text-emerald-300 bg-emerald-500/10",
    title: "Se il dato non c'è, te lo dice",
    desc: "L'assistente risponde solo da ciò che gli hai fornito. Quando un'informazione manca lo dichiara, invece di riempire il vuoto con una plausibilità.",
  },
  {
    icon: Table2,
    tint: "text-sky-300 bg-sky-500/10",
    title: "Costruito per tabelle e importi",
    desc: "Legge fogli costi e condizioni economiche mantenendo ogni voce agganciata al suo valore, e restituisce confronti in tabella con gli importi in evidenza.",
  },
  {
    icon: SlidersHorizontal,
    tint: "text-orange-300 bg-orange-500/10",
    title: "Comportamento su misura",
    desc: "Scrivi tu le istruzioni: tono, struttura della risposta, cosa mettere sempre in evidenza. Da rigoroso e ripetibile a più discorsivo, con un cursore.",
  },
  {
    icon: Gauge,
    tint: "text-amber-300 bg-amber-500/10",
    title: "Qualità misurata, non dichiarata",
    desc: "Prepara un test set di domande e ottieni un punteggio da 0 a 100 su aderenza alle fonti e correttezza, con lo storico di ogni modifica.",
  },
  {
    icon: FolderLock,
    tint: "text-rose-300 bg-rose-500/10",
    title: "Uno spazio per ogni pratica",
    desc: "Ogni cliente, mandato o analisi vive in uno spazio separato, con i suoi documenti e le sue regole. Niente si mescola.",
  },
] as const;

const STEPS = [
  {
    icon: Upload,
    title: "Carica i documenti",
    desc: "Fogli informativi, contratti, circolari, bilanci, listini. PDF, Word, Excel, CSV — oppure indicizza direttamente una pagina o un'intera sezione di sito.",
  },
  {
    icon: SlidersHorizontal,
    title: "Definisci il comportamento",
    desc: "Descrivi come deve rispondere: il livello di dettaglio, la struttura, cosa evidenziare sempre. Lo modifichi quando vuoi.",
  },
  {
    icon: MessageSquareQuote,
    title: "Chiedi in linguaggio naturale",
    desc: "«Quanto costa il canone mensile? Fammi una tabella con tutte le commissioni.» Ottieni la risposta e le fonti da cui arriva.",
  },
  {
    icon: Gauge,
    title: "Verifica e migliora",
    desc: "Lancia la valutazione, leggi i punteggi, aggiusta istruzioni o documenti e rimisura. Il miglioramento lo vedi in un numero.",
  },
] as const;

const AUDIENCES = [
  {
    icon: Landmark,
    tint: "text-violet-300 bg-violet-500/10",
    title: "Istituti bancari e finanziari",
    lead: "Condizioni, compliance e supporto alla rete.",
    points: [
      "Confronto immediato fra condizioni economiche di più prodotti",
      "Risposte uniformi alla rete commerciale, sempre tracciabili alla fonte",
      "Interrogazione di normativa interna e documentazione di prodotto",
    ],
  },
  {
    icon: Calculator,
    tint: "text-emerald-300 bg-emerald-500/10",
    title: "Studi associati e commercialisti",
    lead: "Un assistente per pratica, non uno generico.",
    points: [
      "Circolari, prassi e documentazione cliente sempre consultabili",
      "Uno spazio separato per ogni cliente, senza contaminazioni",
      "Risposte esportabili in PDF da allegare al fascicolo",
    ],
  },
  {
    icon: UserRoundCheck,
    tint: "text-sky-300 bg-sky-500/10",
    title: "Consulenti finanziari indipendenti",
    lead: "L'analisi che richiedeva ore, in una domanda.",
    points: [
      "Estrazione di costi e condizioni da documenti lunghi e complessi",
      "Confronti fra prodotti pronti da portare al cliente",
      "Nessuna infrastruttura da gestire: si usa dal browser",
    ],
  },
] as const;

const FORMATS = ["PDF", "Word", "Excel", "CSV", "Testo", "Pagine web"];

/* ---------- pagina ---------- */

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">
      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/20">
              <FlaskConical size={18} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">Agent Lab</p>
              <p className="text-[10px] text-slate-500">Financial Intelligence</p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#funzioni" className="text-sm text-slate-400 transition-colors hover:text-white">Funzioni</a>
            <a href="#come-funziona" className="text-sm text-slate-400 transition-colors hover:text-white">Come funziona</a>
            <a href="#per-chi" className="text-sm text-slate-400 transition-colors hover:text-white">Per chi</a>
            <a href="#qualita" className="text-sm text-slate-400 transition-colors hover:text-white">Qualità</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/sign-in" className="text-sm text-slate-300 transition-colors hover:text-white">
              Accedi
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:from-violet-500 hover:to-blue-500"
            >
              Inizia ora
            </Link>
          </div>
        </nav>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-emerald-600/5 blur-[120px]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-wide text-violet-300">
            Per banche, studi professionali e consulenti finanziari
          </div>

          <h1 className="mt-8 text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl">
            Ogni risposta, ancorata
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
              ai tuoi documenti
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            Carica fogli informativi, contratti, circolari e bilanci. Fai domande in linguaggio
            naturale e ottieni risposte con la fonte sempre citata — o l&apos;indicazione esplicita
            che quel dato non è nei documenti.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/sign-up"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:from-violet-500 hover:to-blue-500"
            >
              Crea il tuo primo assistente
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#come-funziona"
              className="rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:border-white/20 hover:bg-white/10"
            >
              Vedi come funziona
            </a>
          </div>

          {/* formati supportati */}
          <div className="mt-14">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              Legge i formati con cui lavori già
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {FORMATS.map((f) => (
                <span
                  key={f}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ IL PROBLEMA ============ */}
      <section className="border-y border-white/5 bg-white/[0.02] px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold leading-snug text-white md:text-3xl">
            Un assistente generico inventa. In finanza, questo lo rende inutilizzabile.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-400">
            Un importo sbagliato in una comparazione di costi non è un dettaglio: è una consulenza
            errata. Agent Lab parte dal vincolo opposto — l&apos;assistente può usare
            <span className="text-slate-200"> soltanto i documenti che gli hai dato</span>, deve
            dire da dove viene ogni informazione, e quando un dato non c&apos;è lo dichiara.
          </p>
        </div>
      </section>

      {/* ============ FUNZIONI ============ */}
      <section id="funzioni" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Funzioni</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Tutto quello che serve per fidarsi di una risposta
            </h2>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className="group rounded-2xl border border-white/5 bg-white/[0.03] p-7 transition-all hover:border-white/10 hover:bg-white/[0.05]"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.tint}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-white">{c.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ COME FUNZIONA ============ */}
      <section id="come-funziona" className="border-y border-white/5 bg-white/[0.02] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Come funziona</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Operativo in quattro passaggi
            </h2>
            <p className="mt-4 leading-relaxed text-slate-400">
              Nessuna configurazione tecnica, nessuna integrazione da far approvare. Si usa dal
              browser.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative rounded-2xl border border-white/5 bg-[#0a0a0f] p-7">
                  <span className="absolute right-6 top-6 text-3xl font-bold text-white/5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-300">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-5 text-sm font-semibold text-white">{s.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ PER CHI ============ */}
      <section id="per-chi" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Per chi</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Pensato per chi risponde con i numeri
            </h2>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {AUDIENCES.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.title}
                  className="flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-7 transition-all hover:border-white/10"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${a.tint}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-white">{a.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-400">{a.lead}</p>
                  <ul className="mt-5 space-y-3 border-t border-white/5 pt-5">
                    {a.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-slate-500">
                        <Check size={15} className="mt-0.5 shrink-0 text-emerald-400/70" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ QUALITÀ MISURABILE ============ */}
      <section id="qualita" className="border-y border-white/5 bg-white/[0.02] px-6 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              La differenza
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-white md:text-4xl">
              La qualità la misuri.
              <br />
              Non la speri.
            </h2>
            <p className="mt-6 leading-relaxed text-slate-400">
              È facile capire se una risposta «suona bene». È difficile sapere se è
              <span className="text-slate-200"> affidabile</span> — e impossibile sapere se la
              modifica che hai appena fatto l&apos;ha migliorata o peggiorata.
            </p>
            <p className="mt-4 leading-relaxed text-slate-400">
              Agent Lab include una valutazione indipendente: prepari un set di domande di
              controllo, e un valutatore terzo assegna a ogni risposta un punteggio su quanto è
              fedele ai documenti e quanto è corretta, con un commento sul punto debole.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Punteggio 0–100 su aderenza alle fonti e correttezza",
                "Media della sessione e storico di tutte le valutazioni",
                "Confronta ogni modifica a istruzioni o documenti con un numero",
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-sm text-slate-400">
                  <Check size={16} className="mt-0.5 shrink-0 text-amber-400/70" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* mock del pannello valutazione */}
          <div className="rounded-2xl border border-white/10 bg-[#0c0c14] p-7 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Gauge size={15} className="text-amber-400" /> Valutazione
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                completata
              </span>
            </div>

            <div className="py-7 text-center">
              <p className="text-5xl font-bold text-emerald-400">94</p>
              <p className="mt-1.5 text-xs text-slate-500">punteggio medio · 12 domande</p>
            </div>

            <div className="space-y-3.5">
              {[
                { label: "Aderenza alle fonti", value: 97, tone: "bg-emerald-500" },
                { label: "Correttezza", value: 91, tone: "bg-sky-500" },
              ].map((m) => (
                <div key={m.label}>
                  <div className="mb-1.5 flex justify-between text-[11px]">
                    <span className="text-slate-400">{m.label}</span>
                    <span className="font-semibold text-slate-300">{m.value}/100</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className={`h-full rounded-full ${m.tone}`} style={{ width: `${m.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 space-y-2 border-t border-white/5 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Storico
              </p>
              {[
                { when: "oggi", score: 94, tone: "text-emerald-400" },
                { when: "ieri", score: 88, tone: "text-emerald-400/80" },
                { when: "3 giorni fa", score: 71, tone: "text-amber-400" },
              ].map((r) => (
                <div key={r.when} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{r.when}</span>
                  <span className={`font-semibold ${r.tone}`}>{r.score}/100</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ RIASSICURAZIONI ============ */}
      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            {
              icon: FolderLock,
              title: "I tuoi spazi sono privati",
              desc: "Ogni account vede soltanto i propri spazi di lavoro. I documenti di un cliente non entrano mai nel contesto di un altro.",
            },
            {
              icon: Globe,
              title: "Anche le fonti pubbliche",
              desc: "Oltre ai file, puoi indicizzare una pagina o un'intera sezione di sito: condizioni pubblicate, normativa, listini online.",
            },
            {
              icon: Download,
              title: "Porti via il risultato",
              desc: "Ogni risposta è esportabile in PDF, pronta da allegare a un fascicolo o da consegnare al cliente.",
            },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="rounded-2xl border border-white/5 bg-white/[0.03] p-7">
                <Icon size={20} className="text-slate-400" />
                <h3 className="mt-4 text-sm font-semibold text-white">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ CTA FINALE ============ */}
      <section className="relative overflow-hidden px-6 pb-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[130px]" />
        <div className="relative mx-auto max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-8 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Prova con un tuo documento
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate-400">
            Carica un foglio informativo o un contratto, fai la domanda che faresti a un collega, e
            valuta la risposta con le fonti alla mano.
          </p>
          <Link
            href="/auth/sign-up"
            className="group mt-9 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:from-violet-500 hover:to-blue-500"
          >
            Inizia ora
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-5 text-xs text-slate-600">
            Hai già un account?{" "}
            <Link href="/auth/sign-in" className="text-slate-400 underline underline-offset-4 hover:text-white">
              Accedi
            </Link>
          </p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/5 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500">
              <FlaskConical size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-300">Agent Lab</span>
          </div>
          <div className="flex items-center gap-7 text-xs text-slate-500">
            <Link href="/guida" className="transition-colors hover:text-slate-300">Guida</Link>
            <Link href="/auth/sign-in" className="transition-colors hover:text-slate-300">Accedi</Link>
            <Link href="/auth/sign-up" className="transition-colors hover:text-slate-300">Registrati</Link>
          </div>
          <p className="text-xs text-slate-600">Financial Intelligence Platform</p>
        </div>
      </footer>
    </div>
  );
}
