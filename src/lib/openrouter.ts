/**
 * openrouter.ts — Client OpenRouter API
 * Usa il pacchetto `openai` con baseURL personalizzato per OpenRouter.
 */

import OpenAI from 'openai';

// Modelli configurati
export const CHAT_MODEL = 'openai/gpt-4o-mini'; // Impostato come default come richiesto
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export const CLEANING_MODEL = 'openai/gpt-4o-mini';

// Funzione per ottenere il client
let clientInstance: OpenAI | null = null;

function getClient() {
  if (!clientInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    clientInstance = new OpenAI({
      apiKey: apiKey || 'no-key-provided', 
      baseURL: 'https://openrouter.ai/api/v1/',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Financial AI Lab',
      },
    });
  }
  return clientInstance;
}

/**
 * Esegue una completion generica.
 */
export async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<{ content: string; model: string }> {
  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: options?.model || CHAT_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    const content = response.choices[0]?.message?.content || '';
    const model = response.model || (options?.model || CHAT_MODEL);

    return { content, model };
  } catch (error) {
    console.error('[OpenRouter] Errore chat completion:', error);
    throw new Error(`Errore AI: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
  }
}

/**
 * Genera un embedding per il testo dato.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const client = getClient();
    const truncated = text.slice(0, 32000);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncated,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[OpenRouter] Errore embedding:', error);
    throw new Error(`Errore embedding: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
  }
}

/**
 * Genera embeddings per più testi in batch.
 */
export async function createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  try {
    const client = getClient();
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts.map(t => t.slice(0, 32000)),
    });

    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error('[OpenRouter] Errore batch embedding:', error);
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await createEmbedding(text));
    }
    return results;
  }
}
