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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Rimuovi elementi inutili
    $('script, style, nav, footer, header, aside, iframe, .cookie-banner, #cookie-consent').remove();

    const title = $('title').text().trim() || url;
    
    // Tenta di estrarre il contenuto principale (main, article o body)
    const mainContent = $('main, article, #content, .content, .main').first();
    const content = mainContent.length > 0 
      ? mainContent.text().trim() 
      : $('body').text().trim();

    // Pulisci il testo (rimuovi spazi multipli e ritorni a capo eccessivi)
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
