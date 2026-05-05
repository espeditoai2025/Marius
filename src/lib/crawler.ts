/**
 * crawler.ts — Semplice crawler web basato su fetch e cheerio.
 */

import * as cheerio from 'cheerio';

export interface CrawlResult {
  title: string;
  content: string;
}

/**
 * Scarica il contenuto di un URL e ne estrae il testo principale.
 */
export async function crawlUrl(url: string): Promise<CrawlResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) {
      // Lanciamo un errore che includa lo status per essere gestito dall'API
      const error: any = new Error(`HTTP ${res.status}: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Rimuovi elementi inutili
    $('script, style, nav, footer, header, aside, iframe, .cookie-banner, #cookie-consent').remove();

    const title = $('title').text().trim() || url;
    
    // Tenta di estrarre il contenuto principale
    const mainContent = $('main, article, #content, .content, .main').first();
    const content = mainContent.length > 0 
      ? mainContent.text().trim() 
      : $('body').text().trim();

    const cleanContent = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    return {
      title,
      content: cleanContent,
    };
  } catch (error: any) {
    console.error('[Crawler] Errore:', error);
    throw error;
  }
}
