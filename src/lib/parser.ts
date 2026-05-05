/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

// @ts-ignore
import { PDFParse } from 'pdf-parse';
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
  if (text && text.trim().length > 50) {
    return await cleanTextWithAI(text);
  }

  return text;
}

/**
 * Estrae testo da un file PDF usando pdf-parse 2.4.5 (interfaccia a classi).
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  let parser: any = null;
  try {
    // Istanziamento del parser con i dati del buffer
    parser = new PDFParse({ data: buffer });
    
    // Caricamento del documento
    await parser.load();
    
    // Estrazione del testo
    const result = await parser.getText();
    return result.text || '';
  } catch (error) {
    console.error('[Parser] Errore parsing PDF:', error);
    throw new Error('Impossibile leggere il file PDF con il parser avanzato.');
  } finally {
    // Pulizia risorse
    if (parser && parser.destroy) {
      await parser.destroy();
    }
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
