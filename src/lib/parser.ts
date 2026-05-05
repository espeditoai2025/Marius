/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { chatCompletion, CLEANING_MODEL } from './openrouter';

/**
 * Funzione robusta per l'estrazione di testo da PDF usando pdfjs-dist.
 * Risolve l'errore "DOMMatrix is not defined".
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Import dinamico del worker e della libreria (legacy build per Node.js)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
    
    // Uint8Array richiesto da pdfjs
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true, // Importante per stabilità in Node.js
    });

    const pdf = await loadingTask.promise;
    let fullText = '';

    // Cicla su tutte le pagine
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error: any) {
    console.error('[Parser PDF] Errore:', error);
    throw new Error(`Errore estrazione PDF: ${error.message}`);
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
    case 'text/plain':
    default:
      text = buffer.toString('utf-8');
      break;
  }

  // Se il testo è significativo, lo puliamo con l'AI (gpt-4o-mini)
  if (text && text.trim().length > 50) {
    return await cleanTextWithAI(text);
  }

  return text;
}

/**
 * Estrae testo da un file DOCX.
 */
async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    throw new Error('Errore durante la lettura del file Word');
  }
}

/**
 * Estrae testo da un file CSV.
 */
function parseCSV(buffer: Buffer): string {
  try {
    const content = buffer.toString('utf-8');
    const records = csvParse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];

    return records
      .map((row: string[]) => row.join(' | '))
      .join('\n');
  } catch (error) {
    return buffer.toString('utf-8');
  }
}

/**
 * Pulisce e formatta il testo estratto usando gpt-4o-mini.
 */
async function cleanTextWithAI(rawText: string): Promise<string> {
  try {
    const textToClean = rawText.slice(0, 15000);

    const prompt = `Pulisci e formatta il seguente testo estratto da un documento finanziario. 
Rimuovi intestazioni ripetitive, numeri di pagina e rumore di parsing. 
Mantieni la struttura (tabelle, elenchi) e converti in Markdown pulito.
Restituisci solo il testo elaborato senza commenti.

TESTO:
${textToClean}`;

    const { content } = await chatCompletion([
      { role: 'system', content: 'Sei un assistente specializzato nella pulizia di documenti finanziari.' },
      { role: 'user', content: prompt }
    ], { 
      model: CLEANING_MODEL,
      temperature: 0
    });

    return content;
  } catch (error) {
    console.error('[Parser] Errore pulizia AI:', error);
    return rawText.slice(0, 15000);
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
