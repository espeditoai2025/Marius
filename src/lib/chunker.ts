/**
 * chunker.ts — Suddivisione testo in chunk per RAG
 * Target: 500-800 token (~2000-3200 caratteri)
 * Overlap: 100 token (~400 caratteri)
 */

export interface ChunkOptions {
  /** Dimensione target del chunk in caratteri (default: 2500) */
  chunkSize?: number;
  /** Overlap tra chunk consecutivi in caratteri (default: 400) */
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 2500;
const DEFAULT_OVERLAP = 400;

/**
 * Suddivide il testo in chunk con overlap.
 * Tenta di spezzare su confini naturali (paragrafi, frasi).
 */
export function chunkText(text: string, options?: ChunkOptions): string[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  // Pulisci il testo
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanText.length <= chunkSize) {
    return cleanText.length > 0 ? [cleanText] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleanText.length) {
    let end = start + chunkSize;

    if (end >= cleanText.length) {
      // Ultimo chunk
      chunks.push(cleanText.slice(start).trim());
      break;
    }

    // Trova un punto di interruzione naturale
    const breakPoint = findBreakPoint(cleanText, start, end);
    chunks.push(cleanText.slice(start, breakPoint).trim());

    // Avanza con overlap
    start = breakPoint - overlap;
    if (start < 0) start = 0;

    // Evita loop infiniti
    if (start >= breakPoint) {
      start = breakPoint;
    }
  }

  // Filtra chunk vuoti o troppo corti
  return chunks.filter(chunk => chunk.length > 50);
}

/**
 * Trova il miglior punto di interruzione vicino alla posizione target.
 * Priorità: paragrafo > frase > parola.
 */
function findBreakPoint(text: string, start: number, targetEnd: number): number {
  // Range di ricerca: cerca indietro dal target
  const searchStart = Math.max(start, targetEnd - 500);
  const searchText = text.slice(searchStart, targetEnd);

  // 1. Cerca fine paragrafo (\n\n)
  const paragraphBreak = searchText.lastIndexOf('\n\n');
  if (paragraphBreak !== -1 && paragraphBreak > searchText.length * 0.3) {
    return searchStart + paragraphBreak + 2;
  }

  // 2. Cerca fine riga (\n)
  const lineBreak = searchText.lastIndexOf('\n');
  if (lineBreak !== -1 && lineBreak > searchText.length * 0.3) {
    return searchStart + lineBreak + 1;
  }

  // 3. Cerca fine frase (. ! ?)
  const sentenceEnd = Math.max(
    searchText.lastIndexOf('. '),
    searchText.lastIndexOf('! '),
    searchText.lastIndexOf('? ')
  );
  if (sentenceEnd !== -1 && sentenceEnd > searchText.length * 0.3) {
    return searchStart + sentenceEnd + 2;
  }

  // 4. Cerca spazio (fine parola)
  const spaceBreak = searchText.lastIndexOf(' ');
  if (spaceBreak !== -1) {
    return searchStart + spaceBreak + 1;
  }

  // 5. Fallback: taglia esattamente al target
  return targetEnd;
}
