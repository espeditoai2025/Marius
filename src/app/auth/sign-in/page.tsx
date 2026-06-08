'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { FlaskConical, Loader2 } from 'lucide-react';
import { signInAction } from '../actions';

export default function SignInPage() {
  const [state, action, pending] = useActionState(signInAction, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-4">
            <FlaskConical size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Accedi ad Agent Lab</h1>
          <p className="text-sm text-slate-500 mt-1">Entra nel tuo laboratorio di agenti AI</p>
        </div>

        <form action={action} className="space-y-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@esempio.it"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
            />
          </div>

          {state.error && (
            <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-300">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : 'Accedi'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-4">
          Non hai un account?{' '}
          <Link href="/auth/sign-up" className="text-violet-400 hover:text-violet-300 font-medium">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
