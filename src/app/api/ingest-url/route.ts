/**
 * API Route: /api/ingest-url
 * POST — Ingest URL: crawl, chunk, embed
 * GET  — Lista URL indicizzati
 * DELETE — Rimuovi URL e relativi chunk
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUrls, addUrl, removeUrl, addChunks } from '@/lib/store';
import { crawlUrl } from '@/lib/crawler';
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

    const urls = await getUrls(workspaceId);
    return NextResponse.json({ urls });
  } catch (error) {
    console.error('[API] Errore GET urls:', error);
    return NextResponse.json({ error: 'Errore nel recupero degli URL' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, url } = body;

    if (!workspaceId || !url) {
      return NextResponse.json({ error: 'workspaceId e url obbligatori' }, { status: 400 });
    }

    // Validazione URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL non valido' }, { status: 400 });
    }

    // Crawl URL
    const crawlResult = await crawlUrl(url);

    if (!crawlResult.content || crawlResult.content.trim().length < 50) {
      return NextResponse.json({ error: 'Nessun contenuto significativo trovato nell\'URL' }, { status: 400 });
    }

    // Chunking
    const textChunks = chunkText(crawlResult.content);
    const urlId = uuidv4();

    // Genera embeddings
    const embeddings = await createEmbeddingsBatch(textChunks);

    // Crea chunk con embeddings
    const chunks: DocumentChunk[] = textChunks.map((content, i) => ({
      id: uuidv4(),
      workspaceId,
      sourceType: 'url' as const,
      sourceName: crawlResult.title || url,
      sourceId: urlId,
      content,
      embedding: embeddings[i] || [],
      metadata: { url, title: crawlResult.title, chunkIndex: String(i) },
    }));

    // Salva metadati URL e chunk
    await addUrl(workspaceId, {
      id: urlId,
      workspaceId,
      url,
      title: crawlResult.title,
      chunksCount: chunks.length,
      ingestedAt: new Date().toISOString(),
    });

    await addChunks(workspaceId, chunks);

    return NextResponse.json({
      url: { id: urlId, url, title: crawlResult.title, chunksCount: chunks.length },
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Errore POST ingest-url:', error);
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json({ error: `Errore nell'ingestion URL: ${message}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const urlId = searchParams.get('urlId');

    if (!workspaceId || !urlId) {
      return NextResponse.json({ error: 'workspaceId e urlId obbligatori' }, { status: 400 });
    }

    await removeUrl(workspaceId, urlId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Errore DELETE url:', error);
    return NextResponse.json({ error: 'Errore nella rimozione dell\'URL' }, { status: 500 });
  }
}
