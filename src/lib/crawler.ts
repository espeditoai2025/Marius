/**
 * crawler.ts - Crawler web basato su fetch e cheerio.
 */

import * as cheerio from 'cheerio';

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
};

const NON_HTML_EXTENSIONS = new Set([
  '7z',
  'avi',
  'css',
  'doc',
  'docx',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'js',
  'json',
  'mp3',
  'mp4',
  'pdf',
  'png',
  'ppt',
  'pptx',
  'rar',
  'svg',
  'webp',
  'xls',
  'xlsx',
  'xml',
  'zip',
]);

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['csv', 'docx', 'pdf', 'txt']);

const JUNK_SELECTOR = [
  'script',
  'style',
  'noscript',
  'nav',
  'footer',
  'header',
  'aside',
  'iframe',
  'form',
  '.cookie-banner',
  '#cookie-consent',
  '[aria-hidden="true"]',
].join(', ');

export class CrawlHttpError extends Error {
  status: number;

  constructor(status: number, statusText: string, url: string) {
    super(`HTTP ${status}: ${statusText} (${url})`);
    this.name = 'CrawlHttpError';
    this.status = status;
  }
}

export interface CrawlResult {
  title: string;
  content: string;
}

export interface CrawlPageResult extends CrawlResult {
  url: string;
  links: string[];
  linkedFiles: CrawlLinkedFile[];
  depth: number;
}

export interface CrawlLinkedFile {
  url: string;
  label: string;
  extension: string;
}

export interface CrawlSectionOptions {
  maxPages?: number;
  maxDepth?: number;
  sectionPrefix?: string;
  delayMs?: number;
}

export interface CrawlSectionResult {
  startUrl: string;
  sectionPrefix: string;
  pages: CrawlPageResult[];
  skipped: Array<{ url: string; reason: string }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeUrl(input: string, base?: string): string | null {
  try {
    const parsed = new URL(input, base);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.hash = '';

    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) parsed.searchParams.delete(key);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function hasHtmlPath(pathname: string): boolean {
  const ext = getPathExtension(pathname);
  if (!ext) return true;
  return !NON_HTML_EXTENSIONS.has(ext);
}

function getPathExtension(pathname: string): string {
  const lastSegment = pathname.split('/').pop() || '';
  if (!lastSegment.includes('.')) return '';
  return lastSegment.split('.').pop()?.toLowerCase() || '';
}

export function getSectionPrefix(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (!parsed.pathname || parsed.pathname === '/') return '/';
  if (parsed.pathname.endsWith('/')) return parsed.pathname;

  const parts = parsed.pathname.split('/');
  parts.pop();
  const prefix = `${parts.join('/')}/`;
  return prefix === '//' ? '/' : prefix;
}

function isAllowedSectionUrl(candidateUrl: string, startUrl: string, sectionPrefix: string): boolean {
  const candidate = new URL(candidateUrl);
  const start = new URL(startUrl);
  if (candidate.origin !== start.origin) return false;
  if (!hasHtmlPath(candidate.pathname)) return false;
  if (sectionPrefix === '/') return true;

  const sectionRoot = sectionPrefix.endsWith('/') ? sectionPrefix.slice(0, -1) : sectionPrefix;
  return candidate.pathname === sectionRoot || candidate.pathname.startsWith(sectionPrefix);
}

/**
 * Scarica il contenuto di un URL e ne estrae testo principale e link interni.
 */
export async function crawlPage(url: string, depth = 0): Promise<CrawlPageResult> {
  const normalized = normalizeUrl(url);
  if (!normalized) throw new Error('URL non valido');

  const res = await fetch(normalized, { headers: REQUEST_HEADERS });
  if (!res.ok) throw new CrawlHttpError(res.status, res.statusText, normalized);

  const contentType = res.headers.get('content-type') || '';
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error(`Contenuto non HTML: ${contentType}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  $(JUNK_SELECTOR).remove();

  const title = $('title').first().text().replace(/\s+/g, ' ').trim() || normalized;
  const mainContent = $('main, article, [role="main"], #content, .content, .main').first();
  const scope = mainContent.length > 0 ? mainContent : $('body');

  const links: string[] = [];
  const linkedFiles: CrawlLinkedFile[] = [];
  const seenFiles = new Set<string>();

  scope.find('a[href]').each((_, el) => {
    const link = normalizeUrl($(el).attr('href') || '', normalized);
    if (!link) return;

    links.push(link);

    const parsed = new URL(link);
    const extension = getPathExtension(parsed.pathname);
    if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(extension) || seenFiles.has(link)) return;

    seenFiles.add(link);
    linkedFiles.push({
      url: link,
      label: $(el).text().replace(/\s+/g, ' ').trim() || parsed.pathname.split('/').pop() || link,
      extension,
    });
  });

  const content = scope.text().replace(/\s+/g, ' ').trim();

  return {
    url: normalized,
    title,
    content,
    links: [...new Set(links)],
    linkedFiles,
    depth,
  };
}

/**
 * Scarica una singola pagina.
 */
export async function crawlUrl(url: string): Promise<CrawlResult> {
  try {
    const page = await crawlPage(url);
    return {
      title: page.title,
      content: page.content,
    };
  } catch (error) {
    console.error('[Crawler] Errore:', error);
    throw error;
  }
}

/**
 * Esplora una sezione del sito seguendo link HTML dello stesso dominio/prefix.
 */
export async function crawlSection(url: string, options?: CrawlSectionOptions): Promise<CrawlSectionResult> {
  const startUrl = normalizeUrl(url);
  if (!startUrl) throw new Error('URL non valido');

  const maxPages = clamp(Math.floor(options?.maxPages ?? 8), 1, 20);
  const maxDepth = clamp(Math.floor(options?.maxDepth ?? 2), 0, 3);
  const delayMs = clamp(Math.floor(options?.delayMs ?? 150), 0, 1000);
  const sectionPrefix = options?.sectionPrefix || getSectionPrefix(startUrl);

  const pages: CrawlPageResult[] = [];
  const skipped: Array<{ url: string; reason: string }> = [];
  const seen = new Set<string>();
  const queued = new Set<string>([startUrl]);
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

  while (queue.length > 0 && pages.length < maxPages) {
    const item = queue.shift();
    if (!item || seen.has(item.url)) continue;

    seen.add(item.url);

    try {
      const page = await crawlPage(item.url, item.depth);
      if (page.content.trim().length >= 50) {
        pages.push(page);
      } else {
        skipped.push({ url: item.url, reason: 'Contenuto troppo breve' });
      }

      if (item.depth < maxDepth) {
        for (const link of page.links) {
          if (pages.length + queue.length >= maxPages) break;
          if (seen.has(link) || queued.has(link)) continue;
          if (!isAllowedSectionUrl(link, startUrl, sectionPrefix)) continue;

          queued.add(link);
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    } catch (error) {
      skipped.push({ url: item.url, reason: getErrorMessage(error) });
    }

    if (delayMs > 0 && queue.length > 0 && pages.length < maxPages) {
      await sleep(delayMs);
    }
  }

  return {
    startUrl,
    sectionPrefix,
    pages,
    skipped,
  };
}
