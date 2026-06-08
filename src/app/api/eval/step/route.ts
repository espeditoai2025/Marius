/**
 * API Route: /api/eval/step — valuta UNA domanda del test set.
 * Esegue la pipeline RAG e poi il giudice (Claude). Una domanda per chiamata
 * per non superare il timeout della singola richiesta.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEvalQuestion, addEvalResult } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';
import { executeRAGPipeline } from '@/lib/rag';
import { judgeAnswer } from '@/lib/judge';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, runId, questionId } = body;

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    if (!runId || !questionId) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const q = await getEvalQuestion(workspaceId, questionId);
    if (!q) return NextResponse.json({ error: 'Domanda non trovata' }, { status: 404 });

    // 1. Risposta dell'agente (stessa pipeline della chat)
    const rag = await executeRAGPipeline(workspaceId, q.question);

    // 2. Giudizio (Claude)
    const judge = await judgeAnswer({
      question: q.question,
      answer: rag.answer,
      context: rag.context,
      expected: q.expected,
    });

    const resultId = uuidv4();
    await addEvalResult(runId, {
      id: resultId,
      question: q.question,
      answer: rag.answer,
      score: judge.score,
      groundedness: judge.groundedness,
      correctness: judge.correctness,
      feedback: judge.feedback,
    });

    return NextResponse.json({
      result: {
        id: resultId,
        question: q.question,
        answer: rag.answer,
        score: judge.score,
        groundedness: judge.groundedness,
        correctness: judge.correctness,
        feedback: judge.feedback,
        sourcesCount: rag.sources.length,
      },
    });
  } catch (error: any) {
    console.error('[API Eval Step] Errore:', error);
    return NextResponse.json({ error: 'Errore durante la valutazione', detail: error?.message }, { status: 500 });
  }
}
