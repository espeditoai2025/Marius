/**
 * rag.ts — Pipeline RAG (Retrieval-Augmented Generation)
 * Ottimizzato per dare massima priorità al prompt dell'utente.
 */

import { chatCompletion, createEmbedding } from './openrouter';
import { getPrompt, Source } from './store';
import { sql } from './db';

export interface RAGResult {
  answer: string;
  sources: Source[];
  model: string;
}

/**
 * Esegue la pipeline RAG completa per una domanda utente.
 */
export async function executeRAGPipeline(
  workspaceId: string,
  userQuestion: string
): Promise<RAGResult> {
  // 1. Carica il prompt personalizzato dell'agente (Direttiva Primaria)
  const agentPrompt = await getPrompt(workspaceId);
  const userCustomInstructions = agentPrompt?.content || 'Sei un assistente AI finanziario esperto.';
  const agentTemperature = agentPrompt?.temperature ?? 0;

  // 2. Genera embedding della domanda
  const queryEmbedding = await createEmbedding(userQuestion);
  const queryVector = `[${queryEmbedding.join(',')}]`;

  // 3. Cerca i chunk rilevanti via pgvector (cosine), 15 pezzi per ampio contesto.
  //    score = similarità coseno (1 = identico); soglia minima 0.1.
  let results: Array<Record<string, unknown>> = [];
  try {
    results = await sql`
      SELECT
        content,
        source_type,
        source_name,
        metadata,
        1 - (embedding <=> ${queryVector}::vector) AS score
      FROM chunks
      WHERE workspace_id = ${workspaceId}
        AND 1 - (embedding <=> ${queryVector}::vector) > 0.1
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT 15
    `;
  } catch (error) {
    console.error('[RAG] Errore ricerca semantica:', error);
  }

  let contextText = '';
  let sources: Source[] = [];

  if (results && results.length > 0) {
    sources = results.map((r: any) => ({
      type: r.source_type,
      name: r.source_name,
      snippet: r.content.slice(0, 400) + '...',
      relevance: Math.round(r.score * 100) / 100,
    }));

    // metadata è jsonb: può tornare come oggetto o (raramente) come stringa.
    const indexOf = (r: Record<string, unknown>): number => {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      return (meta as { index?: number })?.index ?? 0;
    };
    const sortedResults = [...results].sort((a, b) => indexOf(a) - indexOf(b));

    contextText = sortedResults
      .map((r: any) => `[DOCUMENTO: ${r.source_name}]\n${r.content}`)
      .join('\n\n---\n\n');
  }

  // 5. Costruisci il prompt finale con PRIORITÀ ASSOLUTA al prompt utente
  const systemPrompt = `
DIRETTIVA PRIMARIA (DA SEGUIRE RIGOROSAMENTE):
${userCustomInstructions}

ISTRUZIONI TECNICHE DI SUPPORTO:
- Analizza il CONTESTO DOCUMENTI fornito sotto.
- Rispondi in modo preciso basandoti sui dati estratti.
- Se il prompt della DIRETTIVA PRIMARIA contrasta con la conoscenza generale, segui sempre la DIRETTIVA PRIMARIA e i DOCUMENTI.
- Cita i nomi dei documenti usati.
- NOTA SUL LAYOUT: I documenti potrebbero contenere tabelle dove i nomi dei servizi e i relativi prezzi sono separati. Cerca di ricostruire l'associazione corretta basandoti sull'ordine di apparizione.

FORMATTAZIONE RISPOSTA (FINANZIARIA):
- Usa TABELLE MARKDOWN per presentare elenchi di costi, tariffe o confronti.
- Metti in GRASSETTO tutti gli importi monetari (es. **25,50 €**).
- Usa titoli di sezione chiari (es. ### Costi del Conto).
- Se utile, crea una sezione finale "Sintesi per il Decision Maker" con i punti chiave.

--- CONTESTO DOCUMENTI ---
${contextText || 'Nessun documento trovato per questa ricerca.'}
--- FINE CONTESTO ---
  `.trim();

  // 6. Chiama il modello AI
  const { content, model } = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuestion },
  ], {
    temperature: agentTemperature, // Impostata dall'utente per workspace (0 = massima precisione)
  });

  return { answer: content, sources, model };
}
