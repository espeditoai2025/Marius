/**
 * crawler.ts — Crawling URL e estrazione testo
 * Usa cheerio per parsare HTML e estrarre contenuto pulito.
 */

import * as cheerio from 'cheerio';

export interface CrawlResult {
  title: string;
  content: string;
  url: string;
}

/**
 * Effettua il crawling di un URL e estrae il testo principale.
 */
export async function crawlUrl(url: string): Promise<CrawlResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return extractContent(html, url);
  } catch (error) {
    console.error('[Crawler] Errore:', url, error);
    throw new Error(
      `Impossibile accedere a ${url}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
    );
  }
}

function extractContent(html: string, url: string): CrawlResult {
  const $ = cheerio.load(html);

  // Rimuovi elementi non-contenuto
  $('script, style, noscript, iframe, svg, canvas, nav, header, footer').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('.sidebar, .menu, .nav, .footer, .header, .ad, .cookie-banner').remove();

  const title = $('title').text().trim() ||
    $('h1').first().text().trim() || url;

  // Estrai contenuto principale
  let mainContent = '';
  const selectors = ['main', 'article', '[role="main"]', '.content', '.post-content'];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) { mainContent = el.text(); break; }
  }

  if (!mainContent || mainContent.trim().length < 100) {
    mainContent = $('body').text();
  }

  const cleanContent = mainContent
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  return { title: title.slice(0, 200), content: cleanContent, url };
}
