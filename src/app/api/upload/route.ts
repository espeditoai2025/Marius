/**
 * api/upload — Caricamento e indicizzazione documenti
 */

import { NextRequest, NextResponse } from 'next/server';
import { addDocument, addChunks } from '@/lib/store';
import { getMimeType } from '@/lib/parser';
import { chunkText } from '@/lib/chunker';
import { createEmbeddingsBatch } from '@/lib/openrouter';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspaceId') as string | null;

    if (!file || !workspaceId) {
      return NextResponse.json(
        { error: 'Nessun file ricevuto o Workspace ID mancante' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    // Import dinamico del parser per stabilità
    const { extractPdfText, parseDocument } = await import('@/lib/parser');

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        text = await extractPdfText(buffer);
      } else {
        text = await parseDocument(buffer, getMimeType(file.name));
      }
    } catch (parseError: any) {
      console.error('PARSE_ERROR', parseError);
      return NextResponse.json({ 
        error: 'Errore durante il parsing del documento', 
        detail: parseError.message 
      }, { status: 500 });
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Non è stato possibile estrarre testo dal documento' },
        { status: 400 }
      );
    }

    // --- RAG Pipeline ---
    // Dividiamo il testo e generiamo embeddings
    const chunks = chunkText(text, { chunkSize: 2500, overlap: 400 });
    const embeddings = await createEmbeddingsBatch(chunks);

    // Metadati
    const docId = uuidv4();
    const docMeta = {
      id: docId,
      workspaceId,
      filename: file.name,
      mimeType: getMimeType(file.name),
      size: file.size,
      chunksCount: chunks.length,
      uploadedAt: new Date().toISOString(),
    };

    await addDocument(workspaceId, docMeta);

    // Chunks
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

    return NextResponse.json({
      success: true,
      document: docMeta
    });

  } catch (error: any) {
    console.error('UPLOAD_ERROR', error);
    return NextResponse.json(
      {
        error: 'Errore durante il caricamento del documento',
        detail: error?.message ?? 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'Mancante workspaceId' }, { status: 400 });
  const { getDocuments } = await import('@/lib/store');
  const documents = await getDocuments(workspaceId);
  return NextResponse.json({ documents });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const docId = searchParams.get('docId');
  if (!workspaceId || !docId) return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
  const { removeDocument } = await import('@/lib/store');
  await removeDocument(workspaceId, docId);
  return NextResponse.json({ success: true });
}
