/**
 * api/workspaces — Gestione dei workspace
 */

import { NextResponse } from 'next/server';
import { 
  getWorkspaces, 
  createWorkspace, 
  deleteWorkspace, 
  savePrompt,
  Workspace 
} from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const workspaces = await getWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('[API Workspaces GET] Errore:', error);
    return NextResponse.json({ error: 'Errore nel caricamento workspace' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    // Salvataggio su DB (Supabase)
    try {
      await createWorkspace(workspace);
      
      // Crea un prompt iniziale per il workspace
      await savePrompt({
        workspaceId: workspace.id,
        content: 'Sei un assistente AI finanziario esperto. Analizza i dati forniti e rispondi in modo professionale, citando le fonti se disponibili.',
        updatedAt: new Date().toISOString(),
      });
    } catch (dbError: any) {
      console.error('[API Workspaces POST] Errore DB:', dbError);
      return NextResponse.json({ 
        error: 'Errore salvataggio database', 
        details: dbError.message || 'Controlla le configurazioni di Supabase (URL/Key) e le RLS policies.' 
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID mancante' }, { status: 400 });
    }

    await deleteWorkspace(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Workspaces DELETE] Errore:', error);
    return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 });
  }
}
