/**
 * openrouter.ts — Client OpenRouter API
 * Usa il pacchetto `openai` con baseURL personalizzato per OpenRouter.
 * Chat: deepseek/deepseek-v4-flash
 * Embeddings: openai/text-embedding-3-small
 */

import OpenAI from 'openai';

// Modelli configurati
export const CHAT_MODEL = 'deepseek/deepseek-v4-flash';
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

// Client OpenRouter (compatibile OpenAI SDK)
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1/',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Financial AI Lab',
  },
});

/**
 * Esegue una chat completion tramite DeepSeek v4 Flash via OpenRouter.
 */
export async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<{ content: string; model: string }> {
  try {
    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    const content = response.choices[0]?.message?.content || '';
    const model = response.model || CHAT_MODEL;

    return { content, model };
  } catch (error) {
    console.error('[OpenRouter] Errore chat completion:', error);
    throw new Error(
      `Errore nella chiamata al modello AI: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
    );
  }
}

/**
 * Genera un embedding per il testo dato usando text-embedding-3-small via OpenRouter.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    // Tronca il testo se troppo lungo (max ~8000 token ≈ 32000 chars)
    const truncated = text.slice(0, 32000);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncated,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[OpenRouter] Errore embedding:', error);
    throw new Error(
      `Errore nella generazione embedding: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
    );
  }
}

/**
 * Genera embeddings per più testi in batch.
 */
export async function createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // OpenRouter/OpenAI supporta batch embeddings
  try {
    const truncated = texts.map(t => t.slice(0, 32000));

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncated,
    });

    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error('[OpenRouter] Errore batch embedding:', error);
    // Fallback: genera uno alla volta
    const results: number[][] = [];
    for (const text of texts) {
      const embedding = await createEmbedding(text);
      results.push(embedding);
    }
    return results;
  }
}
