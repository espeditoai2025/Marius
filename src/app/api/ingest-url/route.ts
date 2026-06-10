/**
 * API Route: /api/ingest-url
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUrls, addUrl, removeUrl, addChunkTexts } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';
import { CrawlHttpError, crawlPage, crawlSection, type CrawlLinkedFile, type CrawlPageResult } from '@/lib/crawler';
import { chunkText } from '@/lib/chunker';
import { getMimeType, parseDocument } from '@/lib/parser';
import type { ChunkText } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestMode = 'page' | 'section';

const MAX_LINKED_FILES = 5;
const MAX_LINKED_FILE_BYTES = 10 * 1024 * 1024;

interface IngestUrlRequest {
  workspaceId?: string;
  url?: string;
  mode?: string;
  maxPages?: number;
  maxDepth?: number;
}

interface CrawlTextSource {
  title: string;
  url: string;
  content: string;
  sourceKind: 'page' | 'file';
  depth: number;
  pageIndex?: number;
  fileExtension?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function clampRequestNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function formatSectionTitle(firstPageTitle: string, pagesCount: number, filesCount: number): string {
  const label = pagesCount === 1 ? '1 pagina' : `${pagesCount} pagine`;
  const fileLabel = filesCount > 0 ? `, ${filesCount} file` : '';
  return `${firstPageTitle} (${label}${fileLabel})`;
}

function createChunkTexts(params: {
  sources: CrawlTextSource[];
  sourceId: string;
  mode: IngestMode;
}): ChunkText[] {
  const chunks: ChunkText[] = [];

  params.sources.forEach((source, sourceIndex) => {
    const sourceChunks = chunkText(source.content);

    sourceChunks.forEach((content, sourceChunkIndex) => {
      chunks.push({
        id: uuidv4(),
        sourceType: 'url',
        sourceName: source.title,
        sourceId: params.sourceId,
        content,
        metadata: {
          index: chunks.length,
          sourceIndex,
          sourceChunkIndex,
          pageIndex: source.pageIndex,
          url: source.url,
          title: source.title,
          crawlMode: params.mode,
          sourceKind: source.sourceKind,
          depth: source.depth,
          fileExtension: source.fileExtension,
        },
      });
    });
  });

  return chunks;
}

function pageSources(pages: CrawlPageResult[]): CrawlTextSource[] {
  return pages.map((page, pageIndex) => ({
    title: page.title,
    url: page.url,
    content: page.content,
    sourceKind: 'page' as const,
    depth: page.depth,
    pageIndex,
  }));
}

function getLinkedFiles(pages: CrawlPageResult[]): CrawlLinkedFile[] {
  const files = new Map<string, CrawlLinkedFile>();

  for (const page of pages) {
    for (const file of page.linkedFiles) {
      if (!files.has(file.url)) files.set(file.url, file);
      if (files.size >= MAX_LINKED_FILES) return [...files.values()];
    }
  }

  return [...files.values()];
}

function filenameFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  return decodeURIComponent(pathname.split('/').pop() || 'documento');
}

async function fetchLinkedFile(file: CrawlLinkedFile): Promise<CrawlTextSource | null> {
  const res = await fetch(file.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Accept: 'application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*',
    },
  });

  if (!res.ok) return null;

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_LINKED_FILE_BYTES) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_LINKED_FILE_BYTES) return null;

  const filename = filenameFromUrl(file.url);
  const text = await parseDocument(buffer, getMimeType(filename));
  if (!text.trim()) return null;

  return {
    title: file.label || filename,
    url: file.url,
    content: text,
    sourceKind: 'file',
    depth: 0,
    fileExtension: file.extension,
  };
}

async function fetchLinkedFiles(files: CrawlLinkedFile[]): Promise<CrawlTextSource[]> {
  const sources: CrawlTextSource[] = [];

  for (const file of files) {
    try {
      const source = await fetchLinkedFile(file);
      if (source) sources.push(source);
    } catch (error) {
      console.warn('[API Ingest URL] File collegato ignorato:', file.url, getErrorMessage(error));
    }
  }

  return sources;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    const urls = await getUrls(workspaceId!);
    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ error: 'Errore nel recupero degli URL' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as IngestUrlRequest;
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null;
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    const mode: IngestMode = body.mode === 'section' ? 'section' : 'page';
    const maxPages = clampRequestNumber(body.maxPages, 8, 1, 20);
    const maxDepth = clampRequestNumber(body.maxDepth, 2, 0, 3);

    if (!rawUrl) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    try {
      const sectionResult = mode === 'section'
        ? await crawlSection(rawUrl, { maxPages, maxDepth })
        : null;
      const pages = sectionResult?.pages ?? [await crawlPage(rawUrl)];

      if (pages.length === 0) {
        return NextResponse.json({
          error: 'Nessun contenuto significativo trovato nella sezione',
          details: sectionResult?.skipped[0]?.reason,
        }, { status: 400 });
      }

      const urlId = uuidv4();
      const firstPageTitle = pages[0]?.title || rawUrl;
      const fileSources = mode === 'section' ? await fetchLinkedFiles(getLinkedFiles(pages)) : [];
      const sources = [...pageSources(pages), ...fileSources];
      const title = mode === 'section'
        ? formatSectionTitle(firstPageTitle, pages.length, fileSources.length)
        : firstPageTitle;
      const chunks = createChunkTexts({ sources, sourceId: urlId, mode });

      if (chunks.length === 0) {
        return NextResponse.json({ error: 'Nessun contenuto significativo trovato nell\'URL' }, { status: 400 });
      }

      const status = chunks.length > 0 ? 'processing' : 'ready';
      const now = new Date().toISOString();

      await addUrl(workspaceId!, {
        id: urlId,
        workspaceId: workspaceId!,
        url: rawUrl,
        title,
        chunksCount: chunks.length,
        status,
        ingestedAt: now,
      });

      await addChunkTexts(workspaceId!, chunks);

      return NextResponse.json({
        url: {
          id: urlId,
          url: rawUrl,
          title,
          chunksCount: chunks.length,
          status,
          ingestedAt: now,
        },
        sourceId: urlId,
        totalChunks: chunks.length,
        pagesCount: pages.length,
        filesCount: fileSources.length,
        skippedCount: sectionResult?.skipped.length ?? 0,
        sectionPrefix: sectionResult?.sectionPrefix,
      }, { status: 201 });
    } catch (crawlError) {
      console.error('[API Ingest URL] Errore crawl:', crawlError);

      if (crawlError instanceof CrawlHttpError && crawlError.status === 403) {
        return NextResponse.json({
          error: "Il sito blocca l'accesso automatico (HTTP 403).",
          details: "Carica il contenuto come PDF/TXT oppure usa un altro URL che non blocchi i crawler.",
        }, { status: 403 });
      }

      return NextResponse.json({
        error: "Errore durante l'accesso al sito web.",
        details: getErrorMessage(crawlError),
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      error: 'Errore interno del server',
      details: getErrorMessage(error),
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const urlId = searchParams.get('urlId');

    if (!urlId) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const guard = await requireWorkspace(workspaceId);
    if ('res' in guard) return guard.res;

    await removeUrl(workspaceId!, urlId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore nella rimozione dell\'URL' }, { status: 500 });
  }
}
