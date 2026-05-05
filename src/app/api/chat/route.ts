/**
 * API Route: /api/chat
 * POST — Invia domanda, esegui RAG, ritorna risposta
 * GET  — Cronologia chat
 * DELETE — Pulisci cronologia
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getChatHistory, addChatMessage, clearChatHistory } from '@/lib/store';
import { executeRAGPipeline } from '@/lib/rag';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId obbligatorio' }, { status: 400 });
    }

    const history = await getChatHistory(workspaceId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error('[API] Errore GET chat:', error);
    return NextResponse.json({ error: 'Errore nel recupero della cronologia' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, question } = body;

    if (!workspaceId || !question) {
      return NextResponse.json({ error: 'workspaceId e question obbligatori' }, { status: 400 });
    }

    // Salva messaggio utente
    const userMessage = {
      id: uuidv4(),
      role: 'user' as const,
      content: question,
      timestamp: new Date().toISOString(),
    };
    await addChatMessage(workspaceId, userMessage);

    // Esegui pipeline RAG
    const result = await executeRAGPipeline(workspaceId, question);

    // Salva risposta assistente
    const assistantMessage = {
      id: uuidv4(),
      role: 'assistant' as const,
      content: result.answer,
      sources: result.sources,
      model: result.model,
      timestamp: new Date().toISOString(),
    };
    await addChatMessage(workspaceId, assistantMessage);

    return NextResponse.json({
      answer: result.answer,
      sources: result.sources,
      model: result.model,
      messageId: assistantMessage.id,
    });
  } catch (error) {
    console.error('[API] Errore POST chat:', error);
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json({ error: `Errore nella risposta AI: ${message}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId obbligatorio' }, { status: 400 });
    }

    await clearChatHistory(workspaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Errore DELETE chat:', error);
    return NextResponse.json({ error: 'Errore nella pulizia cronologia' }, { status: 500 });
  }
}
