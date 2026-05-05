/**
 * rag.ts — Pipeline RAG (Retrieval-Augmented Generation)
 * Ottimizzato per Supabase pgvector.
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
  const systemPrompt = agentPrompt?.content || 'Sei un assistente AI finanziario esperto. Rispondi in modo preciso e professionale basandoti sul contesto fornito.';

  // 2. Genera embedding della domanda
  const queryEmbedding = await createEmbedding(userQuestion);

  // 3. Cerca i chunk più rilevanti direttamente su Supabase (pgvector)
  const { data: results, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3, // Soglia di rilevanza
    match_count: 5,       // Top 5 chunks
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
      snippet: r.content.slice(0, 300) + '...',
      relevance: Math.round(r.score * 100) / 100,
    }));

    contextText = results
      .map((r: any, i: number) => `[Fonte ${i + 1}: ${r.source_name}]\n${r.content}`)
      .join('\n\n---\n\n');
  }

  // 5. Costruisci il prompt finale
  const finalPrompt = buildRAGPrompt(systemPrompt, contextText, userQuestion);

  // 6. Chiama il modello AI
  const { content, model } = await chatCompletion([
    { role: 'system', content: finalPrompt.system },
    { role: 'user', content: finalPrompt.user },
  ]);

  return { answer: content, sources, model };
}

/**
 * Costruisce il prompt strutturato per la chiamata AI.
 */
function buildRAGPrompt(
  agentPrompt: string,
  context: string,
  userQuestion: string
): { system: string; user: string } {
  let system = agentPrompt;

  if (context) {
    system += `\n\n--- CONTESTO DOCUMENTI ---\nUsa le seguenti informazioni per rispondere alla domanda. Se le informazioni non sono sufficienti, dillo chiaramente. Cita le fonti quando possibile.\n\n${context}\n--- FINE CONTESTO ---`;
  } else {
    system += '\n\nNota: Non ci sono documenti caricati nel workspace. Rispondi basandoti sulle tue conoscenze generali.';
  }

  return { system, user: userQuestion };
}
