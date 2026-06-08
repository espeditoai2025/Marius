/**
 * api/workspaces — Gestione dei workspace (scopati per utente proprietario).
 */

import { NextResponse } from 'next/server';
import { getWorkspaces, createWorkspace, deleteWorkspace, savePrompt, Workspace } from '@/lib/store';
import { getUserId } from '@/lib/auth/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const workspaces = await getWorkspaces(userId);
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('[API Workspaces GET] Errore:', error);
    return NextResponse.json({ error: 'Errore nel caricamento workspace' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 });
    }

    const workspace: Workspace = {
      id: uuidv4(),
      name,
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await createWorkspace(workspace, userId);

      // Prompt iniziale per il workspace
      await savePrompt({
        workspaceId: workspace.id,
        content: 'Sei un assistente AI finanziario esperto. Analizza i dati forniti e rispondi in modo professionale, citando le fonti se disponibili.',
        temperature: 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (dbError: any) {
      console.error('[API Workspaces POST] Errore DB:', dbError);
      return NextResponse.json({
        error: 'Errore salvataggio database',
        details: dbError.message || 'Controlla la configurazione del database.',
      }, { status: 500 });
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('[API Workspaces POST] Errore:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID mancante' }, { status: 400 });
    }

    await deleteWorkspace(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Workspaces DELETE] Errore:', error);
    return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 });
  }
}
