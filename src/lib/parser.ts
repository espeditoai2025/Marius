/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { chatCompletion, CLEANING_MODEL } from './openrouter';

/**
 * Estrazione testo da PDF usando pdf-parse 1.1.1 (stabile su Vercel/Node).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  console.log('[Parser] Avvio estrazione PDF con pdf-parse 1.1.1...');
  try {
    // Import dinamico
    const pdf = (await import('pdf-parse')).default;
    
    // pdf-parse 1.1.1 è sincrono/callback ma questa versione esporta una funzione async-friendly
    const data = await pdf(buffer);
    
    console.log(`[Parser] Estrazione completata. Pagine: ${data.numpages}`);
    return data.text || '';
  } catch (error: any) {
    console.error('[Parser PDF] Errore:', error);
    throw new Error(`Errore durante il parsing del PDF: ${error.message}`);
  }
}

/**
 * Dispatcher principale: estrae testo in base al tipo MIME.
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  console.log(`[Parser] Elaborazione file: ${mimeType}`);

  switch (mimeType) {
    case 'application/pdf':
      return await extractPdfText(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    case 'text/csv':
    case 'application/csv':
      const content = buffer.toString('utf-8');
      const records = csvParse(content, { skip_empty_lines: true, relax_column_count: true }) as string[][];
      return records.map(row => row.join(' | ')).join('\n');
    default:
      return buffer.toString('utf-8');
  }
}

/**
 * Pulisce il testo usando gpt-4o-mini.
 */
export async function cleanTextWithAI(rawText: string): Promise<string> {
  try {
    console.log('[Parser] Avvio pulizia AI...');
    const textToClean = rawText.slice(0, 12000); // Limite prudenziale

    const { content } = await chatCompletion([
      { role: 'system', content: 'Sei un assistente specializzato nella pulizia di documenti finanziari. Restituisci solo Markdown pulito.' },
      { role: 'user', content: `Pulisci e formatta questo testo estratto da un documento: \n\n${textToClean}` }
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
