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
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name);
    
    // 1. Estrazione Testo Grezzo (Fase Critica)
    const { parseDocument, cleanTextWithAI } = await import('@/lib/parser');
    let rawText = '';
    try {
      rawText = await parseDocument(buffer, mimeType);
    } catch (parseError: any) {
      console.error('[API Upload] Errore Parsing:', parseError);
      return NextResponse.json({ error: 'Errore lettura file', detail: parseError.message }, { status: 500 });
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: 'Il file sembra vuoto' }, { status: 400 });
    }

    // 2. Creazione Record Documento su DB (Subito!)
    const docId = uuidv4();
    const docMeta = {
      id: docId,
      workspaceId,
      filename: file.name,
      mimeType,
      size: file.size,
      chunksCount: 0, // Verrà aggiornato dopo
      uploadedAt: new Date().toISOString(),
    };

    // Salviamo subito il metadato (così se il resto fallisce, il file è "censito")
    await addDocument(workspaceId, docMeta);

    // 3. Elaborazione AI (Pulizia e Chunking)
    // Se il testo è troppo lungo, lo puliamo con gpt-4o-mini
    const cleanedText = await cleanTextWithAI(rawText);
    const chunks = chunkText(cleanedText, { chunkSize: 2000, overlap: 300 });

    // 4. Generazione Embeddings e Salvataggio Chunk
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

      // Aggiorniamo il conteggio chunk nel documento
      const finalDocMeta = { ...docMeta, chunksCount: chunks.length };
      await addDocument(workspaceId, finalDocMeta);

      return NextResponse.json({ success: true, document: finalDocMeta });

    } catch (aiError: any) {
      console.error('[API Upload] Errore AI/Embeddings:', aiError);
      // Restituiamo comunque il successo per il documento, segnalando che l'indicizzazione è parziale
      return NextResponse.json({ 
        success: true, 
        document: docMeta, 
        warning: 'Documento caricato ma indicizzazione AI fallita.' 
      });
    }

  } catch (error: any) {
    console.error('[API Upload] Errore fatale:', error);
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
