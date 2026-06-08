/**
 * API Route: /api/eval/finalize — chiude la run e calcola il punteggio medio.
 */
import { NextRequest, NextResponse } from 'next/server';
import { finalizeEvalRun } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId, runId } = body;

  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;

  if (!runId) return NextResponse.json({ error: 'runId mancante' }, { status: 400 });

  const summary = await finalizeEvalRun(runId);
  return NextResponse.json(summary);
}
