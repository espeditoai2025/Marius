/**
 * api/upload — Caricamento e indicizzazione documenti
 */

import { NextResponse } from 'next/server';
import { addDocument, addChunks } from '@/lib/store';
import { parseDocument, getMimeType } from '@/lib/parser';
import { chunkText } from '@/lib/chunker';
import { createEmbeddingsBatch } from '@/lib/openrouter';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string;

    if (!file || !workspaceId) {
      return NextResponse.json({ error: 'File o Workspace ID mancante' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. Parsing del documento (direttamente dal buffer in memoria)
    const mimeType = getMimeType(file.name);
    let text = '';
    try {
      text = await parseDocument(buffer, mimeType);
    } catch (parseError) {
      console.error('[API Upload] Errore parsing:', parseError);
      return NextResponse.json({ error: 'Impossibile leggere il contenuto del file' }, { status: 500 });
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Il file sembra essere vuoto o non leggibile' }, { status: 400 });
    }

    // 2. Chunking
    const chunks = chunkText(text, 2500, 400);

    // 3. Generazione Embeddings (Batch)
    const chunkTexts = chunks.map(c => c.content);
    let embeddings: number[][] = [];
    try {
      embeddings = await createEmbeddingsBatch(chunkTexts);
    } catch (embError) {
      console.error('[API Upload] Errore embeddings:', embError);
      return NextResponse.json({ error: 'Errore generazione embeddings AI' }, { status: 500 });
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
    const docChunks = chunks.map((c, i) => ({
      id: uuidv4(),
      workspaceId,
      sourceType: 'document' as const,
      sourceId: docId,
      sourceName: file.name,
      content: c.content,
      embedding: embeddings[i],
      metadata: { page: c.page, index: i },
    }));

    await addChunks(workspaceId, docChunks);

    return NextResponse.json({ document: docMeta });
  } catch (error: any) {
    console.error('[API Upload] Errore generale:', error);
    return NextResponse.json({ 
      error: 'Errore interno durante l\'upload', 
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
