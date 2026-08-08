/**
 * API Route: /api/eval/run — crea una nuova run di valutazione.
 * Il client poi processa una domanda alla volta via /api/eval/step.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createEvalRun, getEvalQuestions } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';
import { JUDGE_MODEL } from '@/lib/openrouter';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId } = body;

  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;

  const questions = await getEvalQuestions(workspaceId);
  if (questions.length === 0) {
    return NextResponse.json({ error: 'Nessuna domanda nel test set' }, { status: 400 });
  }

  const runId = uuidv4();
  // Registra il giudice: senza, lo storico non è confrontabile fra modelli diversi.
  await createEvalRun(workspaceId, runId, questions.length, JUDGE_MODEL);

  return NextResponse.json({
    runId,
    questionIds: questions.map(q => q.id),
    total: questions.length,
  });
}
