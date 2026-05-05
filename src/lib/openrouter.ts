/**
 * openrouter.ts — Client OpenRouter API
 * Usa il pacchetto `openai` con baseURL personalizzato per OpenRouter.
 */

import OpenAI from 'openai';

// Modelli configurati
export const CHAT_MODEL = 'openai/gpt-4o-mini';
export const EMBEDDING_MODEL = 'nomic-ai/nomic-embed-text-v1.5'; // Cambiato per maggiore stabilità su OpenRouter
export const CLEANING_MODEL = 'openai/gpt-4o-mini';

// Funzione per ottenere il client
let clientInstance: OpenAI | null = null;

function getClient() {
  if (!clientInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log(`[OpenRouter] Inizializzazione client. Chiave presente: ${!!apiKey}`);
    
    clientInstance = new OpenAI({
      apiKey: apiKey || '', 
      baseURL: 'https://openrouter.ai/api/v1/',
      defaultHeaders: {
        'HTTP-Referer': 'https://financial-ai-lab.vercel.app',
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

    const content = response.choices[0]?.message?.content || '';
    const model = response.model || (options?.model || CHAT_MODEL);

    return { content, model };
  } catch (error: any) {
    console.error('[OpenRouter] Errore chat completion:', error?.message || error);
    throw new Error(`AI Chat Error: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Genera un embedding per il testo dato.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const client = getClient();
    const cleanText = text.replace(/\s+/g, ' ').slice(0, 10000);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanText,
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Risposta embedding vuota da OpenRouter');
    }

    return response.data[0].embedding;
  } catch (error: any) {
    console.error(`[OpenRouter] Errore embedding (${EMBEDDING_MODEL}):`, error?.message || error);
    throw error;
  }
}

/**
 * Genera embeddings per più testi in batch.
 */
export async function createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const batchSize = 5; // Ridotto ulteriormente per massima stabilità
  const results: number[][] = [];
  
  console.log(`[OpenRouter] Avvio batch embedding (${EMBEDDING_MODEL}) per ${texts.length} frammenti...`);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const client = getClient();
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(t => t.replace(/\s+/g, ' ').slice(0, 10000)),
      });
      
      const embeddings = response.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
      results.push(...embeddings);
      console.log(`[OpenRouter] Batch ${Math.floor(i/batchSize) + 1} completato.`);
    } catch (error: any) {
      console.warn(`[OpenRouter] Batch ${i} fallito: ${error?.message}. Riprovo singolarmente...`);
      for (const text of batch) {
        results.push(await createEmbedding(text));
      }
    }
  }

  return results;
}
