/**
 * rag.ts — Pipeline RAG (Retrieval-Augmented Generation)
 * Ottimizzato per dare massima priorità al prompt dell'utente.
 */

import { chatCompletion, createEmbedding } from './openrouter';
import { getPrompt, Source } from './store';
import { supabase } from './supabase';

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

  // 2. Genera embedding della domanda
  const queryEmbedding = await createEmbedding(userQuestion);

  // 3. Cerca i chunk rilevanti (15 pezzi per ampio contesto)
  const { data: results, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.1,
    match_count: 15,
    p_workspace_id: workspaceId
  });

  if (error) {
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

    const sortedResults = [...results].sort((a, b) => (a.metadata?.index || 0) - (b.metadata?.index || 0));

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

--- CONTESTO DOCUMENTI ---
${contextText || 'Nessun documento trovato per questa ricerca.'}
--- FINE CONTESTO ---
  `.trim();

  // 6. Chiama il modello AI
  const { content, model } = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuestion },
  ], {
    temperature: 0, // Massima precisione
  });

  return { answer: content, sources, model };
}
