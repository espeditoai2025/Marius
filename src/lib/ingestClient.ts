/**
 * ingestClient.ts — Orchestrazione lato client dell'indicizzazione.
 * Chiama /api/ingest/process a batch finché tutti i chunk sono embeddati,
 * riportando il progresso via callback.
 */

export interface IngestProgress {
  done: number;
  total: number;
  finished: boolean;
}

export async function processIngestion(
  sourceId: string,
  sourceType: 'document' | 'url',
  onProgress?: (p: IngestProgress) => void
): Promise<void> {
  let lastDone = -1;
  let stalled = 0;

  for (;;) {
    const res = await fetch('/api/ingest/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, sourceType }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || data.error || "Errore durante l'indicizzazione");
    }

    const p = (await res.json()) as IngestProgress;
    onProgress?.({ done: p.done, total: p.total, finished: p.finished });

    if (p.finished) return;

    // Guardia anti-stallo: se per 3 giri il progresso non avanza, interrompi.
    if (p.done <= lastDone) {
      if (++stalled >= 3) throw new Error('Indicizzazione bloccata: nessun progresso.');
    } else {
      stalled = 0;
      lastDone = p.done;
    }
  }
}
