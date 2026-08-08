import Link from 'next/link';
import { FlaskConical, ArrowRight } from 'lucide-react';
import Markdown from '@/components/Markdown';
import { GUIDE_MD } from '@/lib/guide';

export const metadata = {
  title: 'Guida — Agent Lab',
};

export default function GuidaPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">Agent Lab</span>
          </Link>
          <Link
            href="/workspace"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-medium hover:bg-white/10 transition-all"
          >
            Vai all&apos;app <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Contenuto */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Markdown content={GUIDE_MD} variant="doc" />
      </main>
    </div>
  );
}
