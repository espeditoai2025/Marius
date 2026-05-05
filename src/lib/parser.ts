/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { chatCompletion, CLEANING_MODEL } from './openrouter';

/**
 * Estrazione testo da PDF usando unpdf.
 * Libreria in puro JS senza dipendenze native, perfetta per Vercel.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  console.log('[Parser] Avvio estrazione PDF con unpdf...');
  try {
    const { extractText } = await import('unpdf');
    
    // Conversione sicura da Buffer a ArrayBuffer (evita SharedArrayBuffer)
    const arrayBuffer: ArrayBuffer = new ArrayBuffer(buffer.byteLength);
    const view = new Uint8Array(arrayBuffer);
    view.set(buffer);

    const { text } = await extractText(arrayBuffer);
    
    console.log(`[Parser] Estrazione completata con unpdf. Lunghezza: ${text?.length || 0}`);
    return text || '';
  } catch (error: any) {
    console.error('[Parser PDF] Errore unpdf:', error);
    throw new Error(`Errore unpdf: ${error.message}`);
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
    const textToClean = rawText.slice(0, 12000); 

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
