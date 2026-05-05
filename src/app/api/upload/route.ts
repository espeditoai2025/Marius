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
  const requestId = uuidv4().slice(0, 8);
  console.log(`[API Upload][${requestId}] Inizio richiesta...`);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspaceId') as string | null;

    if (!file || !workspaceId) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name);
    
    // 1. Estrazione Testo
    const { parseDocument, cleanTextWithAI } = await import('@/lib/parser');
    let rawText = '';
    try {
      rawText = await parseDocument(buffer, mimeType);
    } catch (parseError: any) {
      console.error(`[API Upload][${requestId}] Errore Parsing:`, parseError);
      return NextResponse.json({ error: 'Errore lettura file', detail: parseError.message }, { status: 500 });
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: 'Documento vuoto o non leggibile' }, { status: 400 });
    }

    const docId = uuidv4();
    const docMeta = {
      id: docId,
      workspaceId,
      filename: file.name,
      mimeType,
      size: file.size,
      chunksCount: 0,
      uploadedAt: new Date().toISOString(),
    };

    // 2. Salvataggio Immediato Metadati
    await addDocument(workspaceId, docMeta);

    // 3. Chunking (usiamo il testo grezzo subito per velocità)
    const chunks = chunkText(rawText, { chunkSize: 1500, overlap: 200 });
    console.log(`[API Upload][${requestId}] Creati ${chunks.length} chunks.`);

    // 4. Generazione Embeddings (Batching di 10)
    try {
      const embeddings = await createEmbeddingsBatch(chunks);
      
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

      // Aggiorniamo il documento
      const finalDocMeta = { ...docMeta, chunksCount: chunks.length };
      await addDocument(workspaceId, finalDocMeta);

      // 5. Pulizia AI asincrona (opzionale per il futuro o limitata)
      // Per ora, avendo già i chunk indicizzati, l'app funzionerà.
      
      return NextResponse.json({ success: true, document: finalDocMeta });

    } catch (aiError: any) {
      console.error(`[API Upload][${requestId}] Errore Embeddings:`, aiError);
      return NextResponse.json({ error: 'Errore generazione vettori AI', detail: aiError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`[API Upload][${requestId}] Errore fatale:`, error);
    return NextResponse.json({ error: 'Errore interno', detail: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId mancante' }, { status: 400 });
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
