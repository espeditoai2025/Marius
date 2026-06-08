/**
 * api/prompt — Gestione del prompt di sistema dell'agente
 */

import { NextResponse } from 'next/server';
import { getPrompt, savePrompt } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    const prompt = await getPrompt(workspaceId!);
    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('[API Prompt GET] Errore:', error);
    return NextResponse.json({ error: 'Errore caricamento prompt' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceId, content, temperature } = body;

    if (content === undefined) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    try {
      await savePrompt({
        workspaceId,
        content,
        temperature: typeof temperature === 'number' ? temperature : 0,
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
