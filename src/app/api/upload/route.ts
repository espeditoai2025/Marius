/**
 * api/upload — Caricamento e indicizzazione documenti
 */

import { NextResponse } from 'next/server';
import { addDocument, addChunks } from '@/lib/store';
import { getMimeType } from '@/lib/parser';
import { chunkText } from '@/lib/chunker';
import { createEmbeddingsBatch } from '@/lib/openrouter';
import { v4 as uuidv4 } from 'uuid';

// Forza il runtime Node.js per supportare le librerie di parsing
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string;

    if (!file || !workspaceId) {
      return NextResponse.json({ error: 'File o Workspace ID mancante' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name);
    let text = '';

    // Import dinamico del parser per evitare errori di build/static analysis
    const { parseDocument } = await import('@/lib/parser');

    try {
      text = await parseDocument(buffer, mimeType);
    } catch (parseError: any) {
      console.error('[API Upload] Errore parsing:', parseError);
      return NextResponse.json({ 
        error: 'Errore durante la lettura del file', 
        details: parseError.message || 'Il formato del file potrebbe non essere supportato o il file è corrotto.' 
      }, { status: 500 });
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Il file non contiene testo leggibile' }, { status: 400 });
    }

    // 2. Chunking
    const chunks = chunkText(text, { chunkSize: 2500, overlap: 400 });

    // 3. Generazione Embeddings (Batch)
    let embeddings: number[][] = [];
    try {
      embeddings = await createEmbeddingsBatch(chunks);
    } catch (embError: any) {
      console.error('[API Upload] Errore embeddings:', embError);
      return NextResponse.json({ 
        error: 'Errore generazione embeddings AI',
        details: embError.message 
      }, { status: 500 });
    }

    // 4. Salvataggio Metadati Documento
    const docId = uuidv4();
    const docMeta = {
      id: docId,
      workspaceId,
      filename: file.name,
      mimeType,
      size: file.size,
      chunksCount: chunks.length,
      uploadedAt: new Date().toISOString(),
    };

    await addDocument(workspaceId, docMeta);

    // 5. Salvataggio Chunks su Supabase
    const docChunks = chunks.map((content, i) => ({
      id: uuidv4(),
      workspaceId,
      sourceType: 'document' as const,
      sourceId: docId,
      sourceName: file.name,
      content,
      embedding: embeddings[i] || [],
      metadata: { index: i },
    }));

    await addChunks(workspaceId, docChunks);

    return NextResponse.json({ document: docMeta });
  } catch (error: any) {
    console.error('[API Upload] Errore fatale:', error);
    return NextResponse.json({ 
      error: 'Errore interno durante il caricamento', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID mancante' }, { status: 400 });
    }

    const { getDocuments } = await import('@/lib/store');
    const documents = await getDocuments(workspaceId);
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json({ error: 'Errore caricamento documenti' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const docId = searchParams.get('docId');

    if (!workspaceId || !docId) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const { removeDocument } = await import('@/lib/store');
    await removeDocument(workspaceId, docId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Errore eliminazione documento' }, { status: 500 });
  }
}
