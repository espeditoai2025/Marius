/**
 * parser.ts — Parsing documenti (PDF, DOCX, TXT, CSV)
 * Estrae testo grezzo dai file caricati.
 */

import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { transcribePdf } from './openrouter';

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

export interface ExtractionResult {
  /** Testo da indicizzare: la trascrizione se riuscita, altrimenti il grezzo. */
  text: string;
  /** Testo grezzo dell'estrattore locale (vuoto se il PDF non ne contiene). */
  raw: string;
  /** Metodo effettivamente usato per `text`. */
  extraction: 'raw' | 'ai';
  /** Modello usato, solo quando extraction === 'ai'. */
  model?: string;
}

// Oltre questa soglia il PDF non viene mandato al modello: il payload base64
// e i tempi di risposta non stanno nel budget della singola richiesta.
const MAX_TRANSCRIBE_BYTES = 6 * 1024 * 1024;
// Margine sotto maxDuration della route, così un modello lento non la fa scadere.
const TRANSCRIBE_TIMEOUT_MS = 45_000;

/**
 * Ricava il testo migliore ottenibile da un documento.
 *
 * Per i PDF tenta la trascrizione del file nativo (il modello vede il layout,
 * quindi le tabelle costi restano associate alla voce giusta) e ricade sul
 * testo grezzo a ogni errore: la trascrizione è un miglioramento opportunistico,
 * non un punto di rottura dell'ingestione.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractionResult> {
  // Il testo grezzo è sempre il piano B, anche quando l'estrattore locale fallisce
  // (tipico dei PDF scansionati, dove però la trascrizione visiva funziona).
  let raw = '';
  let rawError: unknown = null;
  try {
    raw = await parseDocument(buffer, mimeType);
  } catch (error) {
    rawError = error;
  }

  if (mimeType !== 'application/pdf') {
    if (rawError) throw rawError;
    return { text: raw, raw, extraction: 'raw' };
  }

  if (buffer.byteLength > MAX_TRANSCRIBE_BYTES) {
    console.warn(
      `[Parser] PDF da ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB: oltre il limite di trascrizione, uso il testo grezzo.`
    );
    if (rawError) throw rawError;
    return { text: raw, raw, extraction: 'raw' };
  }

  try {
    const { content, model } = await transcribePdf(buffer, filename, {
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
    console.log(`[Parser] Trascrizione PDF completata (${model}). Caratteri: ${content.length} (grezzo: ${raw.length}).`);
    return { text: content, raw, extraction: 'ai', model };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[Parser] Trascrizione PDF fallita, uso il testo grezzo: ${detail}`);
    // Nessuna trascrizione e nessun testo estraibile: qui l'errore è reale.
    if (rawError) throw rawError;
    return { text: raw, raw, extraction: 'raw' };
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
