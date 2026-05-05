/**
 * API Route: /api/upload
 * POST — Upload file, parsing, chunking, embedding
 * GET  — Lista documenti caricati
 * DELETE — Rimuovi documento
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { getDocuments, addDocument, removeDocument, addChunks, uploadsDir } from '@/lib/store';
import { parseDocument, getMimeType } from '@/lib/parser';
import { chunkText } from '@/lib/chunker';
import { createEmbeddingsBatch } from '@/lib/openrouter';
import type { DocumentChunk } from '@/lib/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId obbligatorio' }, { status: 400 });
    }

    const documents = await getDocuments(workspaceId);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error('[API] Errore GET documents:', error);
    return NextResponse.json({ error: 'Errore nel recupero documenti' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspaceId') as string | null;

    if (!file || !workspaceId) {
      return NextResponse.json({ error: 'File e workspaceId obbligatori' }, { status: 400 });
    }

    // Validazione tipo file
    const allowedExts = ['.pdf', '.docx', '.txt', '.csv'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: `Tipo file non supportato. Formati: ${allowedExts.join(', ')}` }, { status: 400 });
    }

    // Validazione dimensione (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File troppo grande (max 10MB)' }, { status: 400 });
    }

    // Leggi il contenuto del file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Salva il file originale
    const uploadDir = uploadsDir(workspaceId);
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, file.name);
    await fs.writeFile(filePath, buffer);

    // Parsing del documento
    const mimeType = getMimeType(file.name);
    const text = await parseDocument(buffer, mimeType);

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Nessun testo estratto dal documento' }, { status: 400 });
    }

    // Chunking
    const textChunks = chunkText(text);
    const docId = uuidv4();

    // Genera embeddings per batch
    const embeddings = await createEmbeddingsBatch(textChunks);

    // Crea i chunk con embeddings
    const chunks: DocumentChunk[] = textChunks.map((content, i) => ({
      id: uuidv4(),
      workspaceId,
      sourceType: 'document' as const,
      sourceName: file.name,
      sourceId: docId,
      content,
      embedding: embeddings[i] || [],
      metadata: { filename: file.name, chunkIndex: String(i) },
    }));

    // Salva metadati documento e chunk
    await addDocument(workspaceId, {
      id: docId,
      workspaceId,
      filename: file.name,
      mimeType,
      size: file.size,
      chunksCount: chunks.length,
      uploadedAt: new Date().toISOString(),
    });

    await addChunks(workspaceId, chunks);

    return NextResponse.json({
      document: { id: docId, filename: file.name, chunksCount: chunks.length },
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Errore POST upload:', error);
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json({ error: `Errore nell'upload: ${message}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const docId = searchParams.get('docId');

    if (!workspaceId || !docId) {
      return NextResponse.json({ error: 'workspaceId e docId obbligatori' }, { status: 400 });
    }

    await removeDocument(workspaceId, docId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Errore DELETE document:', error);
    return NextResponse.json({ error: 'Errore nella rimozione del documento' }, { status: 500 });
  }
}
