/**
 * rag.ts — Pipeline RAG (Retrieval-Augmented Generation)
 * Ottimizzato per precisione finanziaria e grandi contesti.
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
  // 1. Carica il prompt agente
  const agentPrompt = await getPrompt(workspaceId);
  const baseSystemPrompt = agentPrompt?.content || 'Sei un assistente AI finanziario esperto.';

  // 2. Genera embedding della domanda
  const queryEmbedding = await createEmbedding(userQuestion);

  // 3. Cerca i chunk più rilevanti direttamente su Supabase (pgvector)
  // Aumentiamo match_count a 15 per coprire più contesto in documenti densi
  const { data: results, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.1, // Molto più permissivo per non perdere dati numerici
    match_count: 15,       // Top 15 chunks (visione ampia)
    p_workspace_id: workspaceId
  });

  if (error) {
    console.error('[RAG] Errore ricerca semantica:', error);
  }

  let contextText = '';
  let sources: Source[] = [];

  if (results && results.length > 0) {
    // 4. Costruisci le fonti e il contesto
    sources = results.map((r: any) => ({
      type: r.source_type,
      name: r.source_name,
      snippet: r.content.slice(0, 400) + '...',
      relevance: Math.round(r.score * 100) / 100,
    }));

    // Ordiniamo per indice metadati per mantenere la coerenza del testo se possibile
    const sortedResults = [...results].sort((a, b) => (a.metadata?.index || 0) - (b.metadata?.index || 0));

    contextText = sortedResults
      .map((r: any, i: number) => `[DOCUMENTO: ${r.source_name}]\n${r.content}`)
      .join('\n\n---\n\n');
  }

  // 5. Costruisci il prompt finale (più rigido contro le allucinazioni)
  const systemPrompt = `
${baseSystemPrompt}

ISTRUZIONI CRITICHE:
- Rispondi basandoti ESCLUSIVAMENTE sui documenti forniti nel CONTESTO sotto.
- Se le informazioni non sono presenti nei documenti, dichiara onestamente che non le trovi.
- NON inventare nomi di banche o cifre basandoti sulla tua conoscenza generale (es. non confondere BPM con BPER).
- Se i documenti parlano di "Banco BPM", rispondi solo su "Banco BPM".
- Cita sempre il nome del documento da cui trai l'informazione.

--- CONTESTO DOCUMENTI ---
${contextText || 'NESSUN DOCUMENTO TROVATO NEL DATABASE.'}
--- FINE CONTESTO ---
  `.trim();

  // 6. Chiama il modello AI
  const { content, model } = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuestion },
  ], {
    temperature: 0, // Zero creatività, massima precisione
  });

  return { answer: content, sources, model };
}
