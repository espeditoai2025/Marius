/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

// @ts-ignore
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { chatCompletion, CLEANING_MODEL } from './openrouter';

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
      text = await parsePDF(buffer);
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

  // Se il testo è significativo, lo puliamo con l'AI (GPT-4o-mini)
  if (text && text.trim().length > 100) {
    return await cleanTextWithAI(text);
  }

  return text;
}

/**
 * Estrae testo da un file PDF.
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('[Parser] Errore parsing PDF:', error);
    throw new Error('Impossibile leggere il file PDF.');
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
 * Pulisce e formatta il testo estratto usando GPT-4o-mini.
 * Rimuove rumore, corregge errori di parsing e struttura in Markdown.
 */
async function cleanTextWithAI(rawText: string): Promise<string> {
  try {
    // Tronchiamo il testo se è troppo lungo per una singola passata di pulizia (max ~15k caratteri)
    const textToClean = rawText.slice(0, 15000);

    const prompt = `Sei un esperto di analisi documenti finanziari. 
Il testo seguente è stato estratto da un file tramite OCR o parsing PDF e potrebbe contenere rumore (numeri di pagina, intestazioni ripetute, caratteri speciali errati).

OBIETTIVO:
1. Pulisci il testo rimuovendo intestazioni/piè di pagina ripetitivi.
2. Mantieni tutti i dati numerici, tabelle e informazioni chiave.
3. Formatta il risultato in Markdown pulito e leggibile.
4. Non aggiungere commenti personali, restituisci solo il testo elaborato.

TESTO DA ELABORARE:
${textToClean}`;

    const { content } = await chatCompletion([
      { role: 'system', content: 'Sei un estrattore di dati preciso.' },
      { role: 'user', content: prompt }
    ], { 
      model: CLEANING_MODEL,
      temperature: 0.1 // Bassa temperatura per massima precisione
    });

    return content;
  } catch (error) {
    console.error('[Parser] Errore pulizia AI:', error);
    // Se l'AI fallisce, restituiamo il testo originale troncato (meglio di niente)
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
