/**
 * rag.ts — Pipeline RAG (Retrieval-Augmented Generation)
 * Orchestratore principale: query → embedding → search → prompt → risposta.
 */

import { chatCompletion, createEmbedding, CHAT_MODEL } from './openrouter';
import { searchSimilarChunks } from './embeddings';
import { getChunks, getPrompt, Source } from './store';

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

  // 2. Carica tutti i chunk del workspace
  const allChunks = await getChunks(workspaceId);

  let contextText = '';
  let sources: Source[] = [];

  if (allChunks.length > 0) {
    // 3. Genera embedding della domanda
    const queryEmbedding = await createEmbedding(userQuestion);

    // 4. Cerca i chunk più rilevanti (top 5)
    const results = searchSimilarChunks(queryEmbedding, allChunks, 5);

    // 5. Costruisci il contesto RAG
    sources = results
      .filter(r => r.score > 0.3) // Solo chunk con rilevanza sufficiente
      .map(r => ({
        type: r.chunk.sourceType,
        name: r.chunk.sourceName,
        snippet: r.chunk.content.slice(0, 300) + '...',
        relevance: Math.round(r.score * 100) / 100,
      }));

    contextText = results
      .filter(r => r.score > 0.3)
      .map((r, i) => `[Fonte ${i + 1}: ${r.chunk.sourceName}]\n${r.chunk.content}`)
      .join('\n\n---\n\n');
  }

  // 6. Costruisci il prompt finale
  const finalPrompt = buildRAGPrompt(systemPrompt, contextText, userQuestion);

  // 7. Chiama il modello AI
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
