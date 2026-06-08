/**
 * API Route: /api/eval/questions — gestione del test set di valutazione.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEvalQuestions, addEvalQuestion, removeEvalQuestion } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;

  const questions = await getEvalQuestions(workspaceId!);
  return NextResponse.json({ questions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId, question, expected } = body;

  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;

  if (!question || !String(question).trim()) {
    return NextResponse.json({ error: 'Domanda obbligatoria' }, { status: 400 });
  }

  const id = uuidv4();
  const trimmed = String(question).trim();
  const exp = expected ? String(expected).trim() : undefined;
  await addEvalQuestion(workspaceId, { id, question: trimmed, expected: exp });

  return NextResponse.json({ question: { id, workspaceId, question: trimmed, expected: exp } });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const questionId = searchParams.get('questionId');

  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;

  if (!questionId) return NextResponse.json({ error: 'questionId mancante' }, { status: 400 });

  await removeEvalQuestion(workspaceId!, questionId);
  return NextResponse.json({ success: true });
}
