/**
 * openrouter.ts — Client OpenRouter API
 * Usa il pacchetto `openai` con baseURL personalizzato per OpenRouter.
 */

import OpenAI from 'openai';

// Modelli configurati
export const CHAT_MODEL = 'openai/gpt-4o-mini';
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
      temperature: options?.temperature ?? 0,
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
    // Pulisci il testo da newline eccessive e tronca
    const cleanText = text.replace(/\n/g, ' ').slice(0, 8000);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanText,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[OpenRouter] Errore embedding:', error);
    throw new Error(`Errore embedding: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
  }
}

/**
 * Genera embeddings per più testi in batch con gestione dei sottomoduli.
 * Suddivide in gruppi da 10 per evitare timeout e limiti di payload.
 */
export async function createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const batchSize = 10;
  const results: number[][] = [];
  
  console.log(`[OpenRouter] Avvio batch embedding per ${texts.length} frammenti...`);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const client = getClient();
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(t => t.replace(/\n/g, ' ').slice(0, 8000)),
      });
      
      const embeddings = response.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
      results.push(...embeddings);
      console.log(`[OpenRouter] Completato batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
    } catch (error) {
      console.warn(`[OpenRouter] Errore batch ${i}, procedo uno alla volta per questo gruppo...`);
      for (const text of batch) {
        results.push(await createEmbedding(text));
      }
    }
  }

  return results;
}
