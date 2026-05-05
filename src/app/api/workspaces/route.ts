/**
 * API Route: /api/workspaces
 * GET  — Lista workspace
 * POST — Crea workspace
 * DELETE — Elimina workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getWorkspaces, createWorkspace, deleteWorkspace } from '@/lib/store';

export async function GET() {
  try {
    const workspaces = await getWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('[API] Errore GET workspaces:', error);
    return NextResponse.json({ error: 'Errore nel recupero dei workspace' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 });
    }

    const workspace = {
      id: uuidv4(),
      name: name.trim(),
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createWorkspace(workspace);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('[API] Errore POST workspace:', error);
    return NextResponse.json({ error: 'Errore nella creazione del workspace' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID workspace obbligatorio' }, { status: 400 });
    }

    await deleteWorkspace(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Errore DELETE workspace:', error);
    return NextResponse.json({ error: 'Errore nella cancellazione del workspace' }, { status: 500 });
  }
}
