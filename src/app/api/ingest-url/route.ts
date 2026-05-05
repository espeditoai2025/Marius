/**
 * API Route: /api/ingest-url
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
    return NextResponse.json({ error: 'Errore nel recupero degli URL' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, url } = body;

    if (!workspaceId || !url) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // Crawl URL con gestione esplicita degli errori HTTP (come il 403)
    try {
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

      // Salva
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

    } catch (crawlError: any) {
      console.error('[API Ingest URL] Errore crawl:', crawlError);
      
      // Gestione specifica del 403 Forbidden
      if (crawlError.message?.includes('403') || crawlError.status === 403) {
        return NextResponse.json({ 
          error: "Il sito blocca l'accesso automatico (HTTP 403).",
          details: "Carica il contenuto come PDF/TXT oppure usa un altro URL che non blocchi i crawler." 
        }, { status: 403 });
      }

      return NextResponse.json({ 
        error: "Errore durante l'accesso al sito web.",
        details: crawlError.message 
      }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: "Errore interno del server", details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const urlId = searchParams.get('urlId');

    if (!workspaceId || !urlId) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    await removeUrl(workspaceId, urlId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Errore nella rimozione dell\'URL' }, { status: 500 });
  }
}
