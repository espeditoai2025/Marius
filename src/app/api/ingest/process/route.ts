/**
 * API Route: /api/ingest/process
 * Embedda un batch di chunk ancora privi di embedding per una sorgente.
 * Il client chiama questo endpoint in loop finché `finished` non è true,
 * così l'indicizzazione non supera mai il timeout della singola richiesta.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingChunks,
  setChunkEmbeddings,
  getChunkProgress,
  setDocumentStatus,
  setUrlStatus,
} from '@/lib/store';
import { createEmbeddingsBatch } from '@/lib/openrouter';
import { requireWorkspace } from '@/lib/auth/guard';

export const runtime = 'nodejs';

// Chunk processati per chiamata: abbastanza piccolo da stare nel timeout.
const BATCH = 20;

export async function POST(req: NextRequest) {
  try {
    const { sourceId, sourceType, workspaceId } = await req.json();

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId mancante' }, { status: 400 });
    }

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    const setStatus = sourceType === 'url' ? setUrlStatus : setDocumentStatus;

    const pending = await getPendingChunks(sourceId, BATCH);

    if (pending.length > 0) {
      let embeddings: number[][];
      try {
        embeddings = await createEmbeddingsBatch(pending.map(c => c.content));
      } catch (aiError: any) {
        await setStatus(sourceId, 'error');
        return NextResponse.json(
          { error: 'Errore generazione embedding', detail: aiError?.message },
          { status: 500 }
        );
      }

      await setChunkEmbeddings(
        pending.map((c, i) => ({ id: c.id, embedding: embeddings[i] || [] }))
      );
    }

    const { total, done } = await getChunkProgress(sourceId);
    const finished = done >= total;

    if (finished) {
      await setStatus(sourceId, 'ready');
    }

    return NextResponse.json({ processed: pending.length, done, total, finished });
  } catch (error: any) {
    console.error('[API Ingest Process] Errore:', error);
    return NextResponse.json({ error: 'Errore interno', detail: error?.message }, { status: 500 });
  }
}
