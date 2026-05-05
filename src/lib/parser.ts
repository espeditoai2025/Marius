/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

// @ts-ignore
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';

/**
 * Dispatcher principale: estrae testo in base al tipo MIME.
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePDF(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return parseDOCX(buffer);
    case 'text/csv':
    case 'application/csv':
      return parseCSV(buffer);
    case 'text/plain':
    default:
      return parseTXT(buffer);
  }
}

/**
 * Estrae testo da un file PDF.
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse 1.1.1 è una funzione che accetta il buffer direttamente
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('[Parser] Errore parsing PDF:', error);
    throw new Error('Impossibile leggere il file PDF. Assicurati che non sia protetto da password.');
  }
}

/**
 * Estrae testo da un file DOCX.
 */
async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('[Parser] Errore parsing DOCX:', error);
    throw new Error('Impossibile leggere il file DOCX');
  }
}

/**
 * Estrae testo da un file TXT.
 */
function parseTXT(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Estrae testo da un file CSV (converte in testo tabellare).
 */
function parseCSV(buffer: Buffer): string {
  try {
    const content = buffer.toString('utf-8');
    const records = csvParse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];

    // Converte il CSV in testo leggibile
    return records
      .map((row: string[]) => row.join(' | '))
      .join('\n');
  } catch (error) {
    console.error('[Parser] Errore parsing CSV:', error);
    // Fallback: tratta come testo semplice
    return buffer.toString('utf-8');
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
