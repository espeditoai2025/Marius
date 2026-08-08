/**
 * api/upload — Caricamento e indicizzazione documenti
 */

import { NextRequest, NextResponse } from 'next/server';
import { addDocument, addChunkTexts, ChunkText } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';
import { getMimeType } from '@/lib/parser';
import { chunkText } from '@/lib/chunker';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
// La trascrizione del PDF è una sola chiamata al modello, ma su documenti lunghi
// può richiedere decine di secondi: serve più del default. L'embedding resta
// asincrono a batch (/api/ingest/process), quindi il costo qui è limitato.
export const maxDuration = 60;

// Limite dimensione file (coerente con l'avviso in UI).
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

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

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File troppo grande: ${(file.size / 1024 / 1024).toFixed(1)} MB. Limite massimo ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name);
    
    const { extractDocumentText } = await import('@/lib/parser');
    let extracted;
    try {
      // Per i PDF tenta la trascrizione del file nativo e ricade sul testo
      // grezzo da sola: solleva solo se non c'è proprio nulla di leggibile.
      extracted = await extractDocumentText(buffer, mimeType, file.name);
    } catch (parseError: any) {
      return NextResponse.json({ error: 'Errore lettura file', detail: parseError.message }, { status: 500 });
    }

    if (!extracted.text || extracted.text.trim().length === 0) {
      return NextResponse.json({ error: 'Documento vuoto o non leggibile' }, { status: 400 });
    }

    const docId = uuidv4();

    // chunkSize a 4000 per tenere insieme le tabelle (voce e valore nello stesso chunk)
    const chunks = chunkText(extracted.text, { chunkSize: 4000, overlap: 600 });
    // Documento vuoto dopo il chunking → lo salviamo comunque come "ready" senza chunk
    const status = chunks.length > 0 ? 'processing' : 'ready';

    // Restituito al client: senza raw_text, che resta solo a DB per diagnosi.
    const docMeta = {
      id: docId,
      workspaceId,
      filename: file.name,
      mimeType,
      size: file.size,
      chunksCount: chunks.length,
      status,
      uploadedAt: new Date().toISOString(),
      extraction: extracted.extraction,
      extractionModel: extracted.model,
    };

    // 1. Salva i metadati del documento (stato: processing)
    try {
      await addDocument(workspaceId, { ...docMeta, rawText: extracted.raw || undefined });
    } catch (dbError: any) {
      console.error(`[API Upload][${requestId}] Errore DB Documenti:`, dbError);
      return NextResponse.json({ error: 'Errore Database (Documenti)', detail: dbError.message }, { status: 500 });
    }

    // 2. Salva i chunk SENZA embedding (l'embedding avviene dopo, via /api/ingest/process)
    try {
      const chunkTexts: ChunkText[] = chunks.map((content, i) => ({
        id: uuidv4(),
        sourceType: 'document',
        sourceId: docId,
        sourceName: file.name,
        content,
        metadata: { index: i },
      }));

      await addChunkTexts(workspaceId, chunkTexts);

      // Risposta immediata: il client avvierà l'indicizzazione a batch.
      return NextResponse.json({
        success: true,
        documentId: docId,
        totalChunks: chunks.length,
        document: docMeta,
      });
    } catch (dbError: any) {
      console.error(`[API Upload][${requestId}] Errore DB Chunks:`, dbError);
      return NextResponse.json({ error: 'Errore Salvataggio Database (Chunks)', detail: dbError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`[API Upload][${requestId}] Errore fatale:`, error);
    return NextResponse.json({ error: 'Errore interno server', detail: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;
  const { getDocuments } = await import('@/lib/store');
  const documents = await getDocuments(workspaceId!);
  return NextResponse.json({ documents });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const docId = searchParams.get('docId');
  if (!docId) return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;
  const { removeDocument } = await import('@/lib/store');
  await removeDocument(workspaceId!, docId);
  return NextResponse.json({ success: true });
}
