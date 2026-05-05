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

    // Gestione formati come richiesto
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        // Import dinamico come suggerito
        const pdfParse = (await import('pdf-parse')).default;
        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } catch (pdfErr: any) {
        console.error('PDF_PARSE_ERROR', pdfErr);
        return NextResponse.json({ 
          error: 'Errore durante il parsing del PDF', 
          detail: pdfErr.message 
        }, { status: 500 });
      }
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
      text = buffer.toString('utf-8');
    } else if (file.name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: 'Formato file non ancora supportato' },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Non è stato possibile estrarre testo dal documento' },
        { status: 400 }
      );
    }

    // --- Integrazione con RAG Pipeline (Supabase + Embeddings) ---
    
    // 1. Pulizia opzionale con AI (gpt-4o-mini)
    const { parseDocument } = await import('@/lib/parser');
    // Usiamo la funzione di pulizia che abbiamo già configurato
    const cleanedText = text.length > 100 ? await (await import('@/lib/parser')).parseDocument(buffer, getMimeType(file.name)) : text;

    // 2. Chunking
    const chunks = chunkText(cleanedText, { chunkSize: 2500, overlap: 400 });

    // 3. Embeddings
    const embeddings = await createEmbeddingsBatch(chunks);

    // 4. Salvataggio Metadati
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

    // 5. Salvataggio Chunks
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
      document: docMeta,
      preview: text.slice(0, 500)
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
