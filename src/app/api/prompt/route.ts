/**
 * api/prompt — Gestione del prompt di sistema dell'agente
 */

import { NextResponse } from 'next/server';
import { getPrompt, savePrompt } from '@/lib/store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID mancante' }, { status: 400 });
    }

    const prompt = await getPrompt(workspaceId);
    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('[API Prompt GET] Errore:', error);
    return NextResponse.json({ error: 'Errore caricamento prompt' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceId, content } = body;

    if (!workspaceId || content === undefined) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    try {
      await savePrompt({
        workspaceId,
        content,
        updatedAt: new Date().toISOString(),
      });
    } catch (dbError: any) {
      console.error('[API Prompt POST] Errore DB:', dbError);
      return NextResponse.json({ 
        error: 'Errore salvataggio prompt nel database',
        details: dbError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Prompt POST] Errore:', error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
