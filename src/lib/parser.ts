/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { chatCompletion, CLEANING_MODEL } from './openrouter';

/**
 * Estrazione testo da PDF usando unpdf.
 * Gestisce l'output come array di stringhe (una per pagina).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { extractText } = await import("unpdf");

    const arrayBuffer: ArrayBuffer = new ArrayBuffer(buffer.byteLength);
    const view = new Uint8Array(arrayBuffer);
    view.set(buffer);

    const result = await extractText(arrayBuffer);

    const extractedText = Array.isArray(result.text)
      ? result.text.filter(Boolean).join("\n\n")
      : (result.text as string) || "";

    console.log(
      `[Parser] Estrazione PDF completata. Pagine: ${Array.isArray(result.text) ? result.text.length : 1}. Caratteri: ${extractedText.length}`
    );

    if (!extractedText.trim()) {
      throw new Error("Il PDF non contiene testo estraibile");
    }

    return extractedText;
  } catch (error: any) {
    console.error("[Parser PDF] Errore:", error);
    throw new Error(`Errore estrazione PDF: ${error?.message || "errore sconosciuto"}`);
  }
}

/**
 * Dispatcher principale.
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
 * Per documenti molto grandi, pulisce solo i blocchi iniziali per non eccedere i limiti.
 */
export async function cleanTextWithAI(rawText: string): Promise<string> {
  // Se il testo è mastodontico (> 100k caratteri), la pulizia AI di tutto il testo 
  // rischierebbe di fallire o metterci troppo. Puliamo solo se ragionevole.
  if (rawText.length > 200000) {
    console.warn('[Parser] Documento troppo grande per pulizia AI integrale. Procedo con testo grezzo.');
    return rawText;
  }

  try {
    console.log(`[Parser] Avvio pulizia AI per ${rawText.length} caratteri...`);
    
    // Per gpt-4o-mini possiamo pulire fino a ~50k caratteri in una volta sola in modo sicuro
    const textToClean = rawText.slice(0, 50000); 

    const { content } = await chatCompletion([
      { role: 'system', content: 'Sei un assistente esperto in analisi di documenti bancari e finanziari. Il tuo compito è pulire il testo estratto da un PDF, rimuovendo intestazioni ripetitive, numeri di pagina e rumore. Formatta il contenuto in Markdown pulito mantenendo tabelle e dati numerici.' },
      { role: 'user', content: `Pulisci e formatta questo testo: \n\n${textToClean}` }
    ], { 
      model: CLEANING_MODEL,
      temperature: 0
    });

    // Se abbiamo troncato il testo per la pulizia, aggiungiamo il resto del testo grezzo
    if (rawText.length > 50000) {
      return content + "\n\n" + rawText.slice(50000);
    }

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
