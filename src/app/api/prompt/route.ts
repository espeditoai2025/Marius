/**
 * API Route: /api/prompt
 * GET  — Ottieni prompt attivo
 * POST — Salva/aggiorna prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrompt, savePrompt } from '@/lib/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId obbligatorio' }, { status: 400 });
    }

    const prompt = await getPrompt(workspaceId);
    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('[API] Errore GET prompt:', error);
    return NextResponse.json({ error: 'Errore nel recupero del prompt' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, content } = body;

    if (!workspaceId || typeof content !== 'string') {
      return NextResponse.json({ error: 'workspaceId e content obbligatori' }, { status: 400 });
    }

    const prompt = {
      workspaceId,
      content: content.trim(),
      updatedAt: new Date().toISOString(),
    };

    await savePrompt(prompt);
    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('[API] Errore POST prompt:', error);
    return NextResponse.json({ error: 'Errore nel salvataggio del prompt' }, { status: 500 });
  }
}
