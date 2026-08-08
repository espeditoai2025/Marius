/**
 * openrouter.ts — Client OpenRouter API
 */

import OpenAI from 'openai';

// Modelli configurati
export const CHAT_MODEL = 'deepseek/deepseek-v4-pro';
export const EMBEDDING_MODEL = 'text-embedding-3-small'; // OpenAI diretto — 1536 dimensioni
// Trascrizione del PDF nativo: il modello legge il layout della pagina, quindi
// ricostruisce le tabelle davvero invece di indovinarle dal testo già appiattito.
export const CLEANING_MODEL = 'google/gemini-3.5-flash-lite';
/**
 * Giudice per la valutazione (LLM-as-judge).
 * Misurato contro Opus 5 sugli stessi documenti reali: scarto medio 0,2 punti
 * su risposte corrette, e 4 falsificazioni su 4 smascherate (SWIFT alterato,
 * percentuali alterate, ente inventato) senza falsi positivi — a un settimo
 * del costo. Per tornare a Opus 5 basta cambiare questa riga.
 */
export const JUDGE_MODEL = 'anthropic/claude-haiku-4.5';

// Header di attribuzione OpenRouter, condivisi dal client SDK e da transcribePdf.
const APP_URL = 'https://marius-omega.vercel.app';
const APP_TITLE = 'Marius Financial AI';

/**
 * Endpoint OpenRouter. Impostare OPENROUTER_BASE_URL a
 * `https://eu.openrouter.ai/api/v1/` per il routing in-region UE
 * (richiede un contratto enterprise con OpenRouter).
 */
const BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/';

/**
 * Vincoli di routing applicati a ogni richiesta: i documenti dei clienti non
 * devono finire a provider che li conservano o li usano per addestramento.
 *   data_collection: 'deny' → esclude i provider che raccolgono dati utente
 *   zdr: true               → solo endpoint che non conservano i prompt
 * Sono un OR con le impostazioni a livello di account, che vanno comunque
 * configurate nella dashboard OpenRouter.
 */
const PROVIDER_POLICY = { data_collection: 'deny', zdr: true } as const;

/** Consente di aggiungere il campo `provider`, estensione OpenRouter fuori dallo schema OpenAI. */
type WithProvider<T> = T & { provider: typeof PROVIDER_POLICY };

let clientInstance: OpenAI | null = null;
let embeddingClientInstance: OpenAI | null = null;

// Client OpenRouter — usato per la chat (DeepSeek) e la pulizia testo.
function getClient() {
  if (!clientInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    clientInstance = new OpenAI({
      apiKey: apiKey || '',
      baseURL: BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': APP_URL,
        'X-Title': APP_TITLE,
      },
    });
  }
  return clientInstance;
}

// Client OpenAI diretto — usato per gli embeddings.
// OpenRouter non espone l'endpoint /embeddings, quindi usiamo OpenAI direttamente.
function getEmbeddingClient() {
  if (!embeddingClientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;

    embeddingClientInstance = new OpenAI({
      apiKey: apiKey || '',
      // baseURL di default = https://api.openai.com/v1
    });
  }
  return embeddingClientInstance;
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
    // `provider` non è nello schema OpenAI: il tipo intersezione lo aggiunge
    // senza cast, e l'SDK inoltra il body così com'è.
    const params: WithProvider<OpenAI.ChatCompletionCreateParamsNonStreaming> = {
      model: options?.model || CHAT_MODEL,
      messages,
      temperature: options?.temperature ?? 0,
      max_tokens: options?.maxTokens ?? 4096,
      provider: PROVIDER_POLICY,
    };
    const response = await client.chat.completions.create(params);

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

const TRANSCRIBE_PROMPT = `Trascrivi FEDELMENTE questo documento in Markdown.
Regole tassative:
- Riproduci le tabelle come tabelle Markdown, associando ogni voce al SUO valore secondo il layout visivo della pagina.
- Non riassumere, non commentare, non aggiungere né omettere righe.
- Non alterare alcun numero, importo, percentuale o data.
- Rimuovi solo intestazioni/piè di pagina ripetuti e numeri di pagina.
Restituisci esclusivamente il Markdown, senza preamboli.`;

/**
 * Trascrive un PDF in Markdown mandando il file nativo al modello multimodale.
 *
 * A differenza di una pulizia sul testo già estratto, qui il modello vede la
 * pagina: nei fogli costi bancari le colonne restano associate alla voce giusta.
 * Usa `fetch` diretto perché `plugins` è un'estensione OpenRouter fuori dallo
 * schema OpenAI.
 */
export async function transcribePdf(
  pdf: Buffer,
  filename: string,
  options?: { model?: string; maxTokens?: number; signal?: AbortSignal }
): Promise<{ content: string; model: string }> {
  const model = options?.model || CLEANING_MODEL;

  const response = await fetch(`${BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: options?.signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': APP_URL,
      'X-Title': APP_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: TRANSCRIBE_PROMPT },
            {
              type: 'file',
              file: {
                filename,
                file_data: `data:application/pdf;base64,${pdf.toString('base64')}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: options?.maxTokens ?? 32000,
      // engine 'native': usa la capacità multimodale del modello sulla pagina.
      plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }],
      provider: PROVIDER_POLICY,
    }),
  });

  const data = await response.json();

  if (!response.ok || data?.error) {
    const detail = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Trascrizione PDF (${model}): ${detail}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error(`Trascrizione PDF (${model}): risposta vuota`);
  }

  return { content, model: data.model || model };
}

/**
 * Genera un embedding per il testo dato.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const client = getEmbeddingClient();
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
    console.error(`[OpenAI] Embedding Error (${EMBEDDING_MODEL}):`, detail);
    throw new Error(`OpenAI Embedding (${EMBEDDING_MODEL}): ${detail}`);
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
      const client = getEmbeddingClient();
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
