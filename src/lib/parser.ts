/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { chatCompletion, CLEANING_MODEL } from './openrouter';

/**
 * Funzione robusta per l'estrazione di testo da PDF usando pdfjs-dist.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  console.log('[Parser] Avvio estrazione PDF...');
  try {
    // Import dinamico
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
    
    // Configura il worker per l'ambiente Node.js
    if (typeof process !== 'undefined') {
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.js');
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
    }

    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false, // Maggiore sicurezza
    });

    const pdf = await loadingTask.promise;
    console.log(`[Parser] PDF caricato: ${pdf.numPages} pagine.`);
    
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    console.log(`[Parser] Estrazione completata. Lunghezza testo: ${fullText.length}`);
    return fullText;
  } catch (error: any) {
    console.error('[Parser PDF] Errore critico:', error);
    throw new Error(`Errore PDF.js: ${error.message}`);
  }
}

/**
 * Dispatcher principale: estrae testo in base al tipo MIME.
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  let text = '';
  
  console.log(`[Parser] Tipo file rilevato: ${mimeType}`);

  try {
    switch (mimeType) {
      case 'application/pdf':
        text = await extractPdfText(buffer);
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        text = await parseDOCX(buffer);
        break;
      case 'text/csv':
      case 'application/csv':
        text = await parseCSV(buffer);
        break;
      default:
        text = buffer.toString('utf-8');
        break;
    }

    if (text && text.trim().length > 50) {
      console.log('[Parser] Avvio pulizia AI con gpt-4o-mini...');
      return await cleanTextWithAI(text);
    }

    return text;
  } catch (err: any) {
    console.error('[Parser] Errore durante parseDocument:', err);
    throw err;
  }
}

/**
 * Estrae testo da un file DOCX.
 */
async function parseDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/**
 * Estrae testo da un file CSV.
 */
function parseCSV(buffer: Buffer): string {
  const content = buffer.toString('utf-8');
  const records = csvParse(content, {
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][];

  return records
    .map((row: string[]) => row.join(' | '))
    .join('\n');
}

/**
 * Pulisce e formatta il testo estratto usando gpt-4o-mini.
 */
async function cleanTextWithAI(rawText: string): Promise<string> {
  try {
    const textToClean = rawText.slice(0, 15000);

    const { content } = await chatCompletion([
      { role: 'system', content: 'Sei un assistente specializzato nella pulizia di documenti finanziari. Restituisci solo Markdown pulito.' },
      { role: 'user', content: `Pulisci questo testo: \n\n${textToClean}` }
    ], { 
      model: CLEANING_MODEL,
      temperature: 0
    });

    return content;
  } catch (error) {
    console.warn('[Parser] Pulizia AI fallita, uso testo grezzo:', error);
    return rawText;
  }
}

/**
 * Determina il tipo MIME dal nome del file.
 */
export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'csv': return 'text/csv';
    case 'txt': return 'text/plain';
    default: return 'text/plain';
  }
}
