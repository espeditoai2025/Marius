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

    console.log(`[API Upload] Ricevuto file: ${file.name} (${file.size} bytes)`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name);
    
    // 1. Estrazione Testo
    const { parseDocument, cleanTextWithAI } = await import('@/lib/parser');
    let rawText = '';
    try {
      rawText = await parseDocument(buffer, mimeType);
    } catch (parseError: any) {
      console.error('[API Upload] Errore Parsing:', parseError);
      return NextResponse.json({ error: 'Errore lettura PDF', detail: parseError.message }, { status: 500 });
    }

    if (!rawText || rawText.trim().length === 0) {
      console.warn('[API Upload] Testo estratto vuoto. Possibile PDF scannerizzato.');
      return NextResponse.json({ 
        error: 'Il documento non contiene testo estraibile.', 
        detail: 'Se è una scansione o un\'immagine, il sistema non può leggerlo senza OCR.' 
      }, { status: 400 });
    }

    console.log(`[API Upload] Testo estratto: ${rawText.length} caratteri.`);

    // 2. Creazione Record Documento
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

    await addDocument(workspaceId, docMeta);

    // 3. Pulizia e Chunking
    const cleanedText = await cleanTextWithAI(rawText);
    const chunks = chunkText(cleanedText, { chunkSize: 2000, overlap: 300 });
    
    console.log(`[API Upload] Creati ${chunks.length} chunks.`);

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Errore nella divisione del testo in frammenti.' }, { status: 500 });
    }

    // 4. Generazione Embeddings e Salvataggio Chunk
    try {
      console.log(`[API Upload] Generazione embeddings per ${chunks.length} chunks...`);
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

      // Aggiorniamo il conteggio chunk nel documento per la UI
      const finalDocMeta = { ...docMeta, chunksCount: chunks.length };
      await addDocument(workspaceId, finalDocMeta);

      console.log('[API Upload] Upload completato con successo.');
      return NextResponse.json({ success: true, document: finalDocMeta });

    } catch (aiError: any) {
      console.error('[API Upload] Errore AI/Embeddings:', aiError);
      return NextResponse.json({ 
        error: 'Errore indicizzazione AI', 
        detail: 'Il file è stato caricato ma la generazione degli embeddings è fallita. Verifica la quota API.' 
      }, { status: 500 });
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
