/**
 * openrouter.ts — Client OpenRouter API
 */

import OpenAI from 'openai';

// Modelli configurati
export const CHAT_MODEL = 'deepseek/deepseek-v4-flash';
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small'; // Ritorno definitivo a 1536 dimensioni
export const CLEANING_MODEL = 'openai/gpt-4o-mini';

let clientInstance: OpenAI | null = null;

function getClient() {
  if (!clientInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    clientInstance = new OpenAI({
      apiKey: apiKey || '', 
      baseURL: 'https://openrouter.ai/api/v1/',
      defaultHeaders: {
        'HTTP-Referer': 'https://marius-lab.vercel.app',
        'X-Title': 'Marius Financial AI',
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
      temperature: options?.temperature ?? 0,
      max_tokens: options?.maxTokens ?? 4096,
    });

    return { 
      content: response.choices[0]?.message?.content || '', 
      model: response.model 
    };
  } catch (error: any) {
    const msg = error?.response?.data?.error?.message || error?.message || 'Errore AI sconosciuto';
    console.error('[OpenRouter] Chat Error:', msg);
    throw new Error(msg);
  }
}

/**
 * Genera un embedding per il testo dato.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const client = getClient();
    // Pulizia testo per embedding
    const cleanText = text.replace(/\s+/g, ' ').slice(0, 8000);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanText,
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Risposta embedding vuota');
    }

    return response.data[0].embedding;
  } catch (error: any) {
    const detail = error?.response?.data?.error?.message || error?.message || 'Errore tecnico';
    console.error(`[OpenRouter] Embedding Error (${EMBEDDING_MODEL}):`, detail);
    throw new Error(`OpenRouter Embedding (${EMBEDDING_MODEL}): ${detail}`);
  }
}

/**
 * Genera embeddings per più testi in batch.
 */
export async function createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const batchSize = 10;
  const results: number[][] = [];
  
  console.log(`[OpenRouter] Inizio batch embedding (${EMBEDDING_MODEL}) per ${texts.length} frammenti...`);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const client = getClient();
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(t => t.replace(/\s+/g, ' ').slice(0, 8000)),
      });
      
      const embeddings = response.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
      results.push(...embeddings);
    } catch (error: any) {
      const detail = error?.response?.data?.error?.message || error?.message || 'Batch failed';
      console.warn(`[OpenRouter] Batch ${i} fallito: ${detail}. Riprovo singoli...`);
      for (const text of batch) {
        results.push(await createEmbedding(text));
      }
    }
  }

  return results;
}
