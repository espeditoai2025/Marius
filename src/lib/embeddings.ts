/**
 * embeddings.ts — Gestione embeddings e ricerca semantica
 * Cosine similarity per trovare i chunk più rilevanti.
 */

import { DocumentChunk } from './store';

/**
 * Calcola la cosine similarity tra due vettori.
 * Ritorna un valore tra -1 e 1 (1 = identici).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Cerca i chunk più simili alla query embedding.
 * Ritorna i top K chunk ordinati per rilevanza.
 */
export function searchSimilarChunks(
  queryEmbedding: number[],
  chunks: DocumentChunk[],
  topK: number = 5
): Array<{ chunk: DocumentChunk; score: number }> {
  // Calcola la similarity per ogni chunk
  const scored = chunks
    .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
    .map(chunk => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

  // Ordina per score decrescente e prendi i top K
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}
