/**
 * store.ts — Storage basato su Neon (Postgres + pgvector)
 * Gestisce la persistenza dei dati per workspace, prompt, chat, documenti, URL e chunk.
 */

import { sql } from './db';

// ==========================================
// TIPI
// ==========================================

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPrompt {
  workspaceId: string;
  content: string;
  temperature: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  model?: string;
  timestamp: string;
}

export interface Source {
  type: 'document' | 'url';
  name: string;
  snippet: string;
  relevance: number;
}

export interface DocumentMeta {
  id: string;
  workspaceId: string;
  filename: string;
  mimeType: string;
  size: number;
  chunksCount: number;
  status: string; // 'processing' | 'ready' | 'error'
  uploadedAt: string;
  extraction?: 'raw' | 'ai'; // come è stato ricavato il testo indicizzato
  extractionModel?: string;  // modello di trascrizione, se extraction === 'ai'
  /** Testo grezzo conservato per diagnosi. Scritto in fase di upload, mai riletto in lista. */
  rawText?: string;
}

export interface UrlMeta {
  id: string;
  workspaceId: string;
  url: string;
  title: string;
  chunksCount: number;
  status: string; // 'processing' | 'ready' | 'error'
  ingestedAt: string;
}

/** Chunk testuale senza embedding (inserito durante l'upload, embeddato dopo). */
export interface ChunkText {
  id: string;
  sourceType: 'document' | 'url';
  sourceId: string;
  sourceName: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface DocumentChunk {
  id: string;
  workspaceId: string;
  sourceType: 'document' | 'url';
  sourceName: string;
  sourceId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

// Helper: pgvector accetta i vettori nel formato testuale '[1,2,3]'
function toVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// Helper: i campi jsonb possono tornare come oggetto o come stringa
function parseJson<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return undefined; }
  }
  return value as T;
}

// ==========================================
// WORKSPACE CRUD
// ==========================================

export async function getWorkspaces(ownerId: string): Promise<Workspace[]> {
  const rows = await sql`
    SELECT * FROM workspaces WHERE owner_id = ${ownerId} ORDER BY created_at DESC
  `;
  return rows.map(w => ({
    id: w.id,
    name: w.name,
    description: w.description,
    ownerId: w.owner_id,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }));
}

export async function getWorkspace(id: string, ownerId: string): Promise<Workspace | null> {
  const rows = await sql`SELECT * FROM workspaces WHERE id = ${id} AND owner_id = ${ownerId}`;
  const data = rows[0];
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    ownerId: data.owner_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createWorkspace(workspace: Workspace, ownerId: string): Promise<void> {
  await sql`
    INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at)
    VALUES (${workspace.id}, ${workspace.name}, ${workspace.description}, ${ownerId},
            ${workspace.createdAt}, ${workspace.updatedAt})
  `;
}

export async function deleteWorkspace(id: string, ownerId: string): Promise<void> {
  // Le tabelle figlie hanno ON DELETE CASCADE, quindi basta eliminare il workspace.
  await sql`DELETE FROM workspaces WHERE id = ${id} AND owner_id = ${ownerId}`;
}

/** True se il workspace appartiene all'utente. Da usare per autorizzare le route API. */
export async function userOwnsWorkspace(workspaceId: string, ownerId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${ownerId} LIMIT 1`;
  return rows.length > 0;
}

// ==========================================
// PROMPT CRUD
// ==========================================

export async function getPrompt(workspaceId: string): Promise<AgentPrompt | null> {
  const rows = await sql`SELECT * FROM prompts WHERE workspace_id = ${workspaceId}`;
  const data = rows[0];
  if (!data) return null;
  return {
    workspaceId: data.workspace_id,
    content: data.content,
    temperature: data.temperature ?? 0,
    updatedAt: data.updated_at,
  };
}

export async function savePrompt(prompt: AgentPrompt): Promise<void> {
  // Clamp di sicurezza: la temperatura resta nell'intervallo [0, 1].
  const temperature = Math.min(1, Math.max(0, Number(prompt.temperature) || 0));
  await sql`
    INSERT INTO prompts (workspace_id, content, temperature, updated_at)
    VALUES (${prompt.workspaceId}, ${prompt.content}, ${temperature}, ${new Date().toISOString()})
    ON CONFLICT (workspace_id)
    DO UPDATE SET content = EXCLUDED.content, temperature = EXCLUDED.temperature, updated_at = EXCLUDED.updated_at
  `;
}

// ==========================================
// CHAT HISTORY CRUD
// ==========================================

export async function getChatHistory(workspaceId: string): Promise<ChatMessage[]> {
  try {
    const rows = await sql`
      SELECT * FROM chat_messages
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at ASC
    `;
    return rows.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      sources: parseJson<Source[]>(m.sources),
      model: m.model,
      timestamp: m.created_at,
    }));
  } catch (error) {
    console.error('[Store] Errore lettura cronologia:', error);
    return [];
  }
}

export async function addChatMessage(workspaceId: string, message: ChatMessage): Promise<void> {
  try {
    // Se l'id non è un uuid valido lasciamo che lo generi il DB.
    const id = message.id && message.id.includes('-') ? message.id : null;
    const sources = message.sources ? JSON.stringify(message.sources) : null;
    await sql`
      INSERT INTO chat_messages (id, workspace_id, role, content, sources, model, created_at)
      VALUES (
        COALESCE(${id}::uuid, gen_random_uuid()),
        ${workspaceId}, ${message.role}, ${message.content},
        ${sources}::jsonb, ${message.model ?? null}, ${message.timestamp}
      )
    `;
  } catch (error) {
    console.error('[Store] Errore salvataggio messaggio:', error);
  }
}

export async function clearChatHistory(workspaceId: string): Promise<void> {
  await sql`DELETE FROM chat_messages WHERE workspace_id = ${workspaceId}`;
}

// ==========================================
// DOCUMENT METADATA CRUD
// ==========================================

export async function getDocuments(workspaceId: string): Promise<DocumentMeta[]> {
  // Colonne esplicite: raw_text può pesare centinaia di KB per documento e non
  // serve in lista, quindi non va né letto dal DB né spedito al browser.
  const rows = await sql`
    SELECT id, workspace_id, filename, mime_type, size, chunks_count,
           status, created_at, extraction, extraction_model
    FROM documents
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map(d => ({
    id: d.id,
    workspaceId: d.workspace_id,
    filename: d.filename,
    mimeType: d.mime_type,
    size: Number(d.size),
    chunksCount: d.chunks_count,
    status: d.status ?? 'ready',
    uploadedAt: d.created_at,
    extraction: (d.extraction ?? 'raw') as 'raw' | 'ai',
    extractionModel: d.extraction_model ?? undefined,
  }));
}

/**
 * Aggiunge o aggiorna un documento (UPSERT su id).
 */
export async function addDocument(workspaceId: string, doc: DocumentMeta): Promise<void> {
  await sql`
    INSERT INTO documents (id, workspace_id, filename, mime_type, size, chunks_count,
                           status, created_at, extraction, extraction_model, raw_text)
    VALUES (${doc.id}, ${workspaceId}, ${doc.filename}, ${doc.mimeType},
            ${doc.size}, ${doc.chunksCount}, ${doc.status}, ${doc.uploadedAt},
            ${doc.extraction ?? 'raw'}, ${doc.extractionModel ?? null}, ${doc.rawText ?? null})
    ON CONFLICT (id) DO UPDATE SET
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      chunks_count = EXCLUDED.chunks_count,
      status = EXCLUDED.status,
      extraction = EXCLUDED.extraction,
      extraction_model = EXCLUDED.extraction_model,
      raw_text = EXCLUDED.raw_text
  `;
}

export async function setDocumentStatus(id: string, status: string): Promise<void> {
  await sql`UPDATE documents SET status = ${status} WHERE id = ${id}`;
}

export async function removeDocument(workspaceId: string, docId: string): Promise<void> {
  // 1. Elimina prima tutti i chunk associati per evitare "fantasmi" nel RAG.
  await sql`DELETE FROM chunks WHERE source_id = ${docId}`;
  // 2. Elimina il metadato del documento.
  await sql`DELETE FROM documents WHERE id = ${docId}`;
}

// ==========================================
// URL METADATA CRUD
// ==========================================

export async function getUrls(workspaceId: string): Promise<UrlMeta[]> {
  const rows = await sql`
    SELECT * FROM urls
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map(u => ({
    id: u.id,
    workspaceId: u.workspace_id,
    url: u.url,
    title: u.title,
    chunksCount: u.chunks_count,
    status: u.status ?? 'ready',
    ingestedAt: u.created_at,
  }));
}

export async function addUrl(workspaceId: string, url: UrlMeta): Promise<void> {
  await sql`
    INSERT INTO urls (id, workspace_id, url, title, chunks_count, status, created_at)
    VALUES (${url.id}, ${workspaceId}, ${url.url}, ${url.title},
            ${url.chunksCount}, ${url.status}, ${url.ingestedAt})
    ON CONFLICT (id) DO UPDATE SET
      url = EXCLUDED.url,
      title = EXCLUDED.title,
      chunks_count = EXCLUDED.chunks_count,
      status = EXCLUDED.status
  `;
}

export async function setUrlStatus(id: string, status: string): Promise<void> {
  await sql`UPDATE urls SET status = ${status} WHERE id = ${id}`;
}

export async function removeUrl(workspaceId: string, urlId: string): Promise<void> {
  // Elimina anche i chunk associati per evitare residui nel RAG.
  await sql`DELETE FROM chunks WHERE source_id = ${urlId}`;
  await sql`DELETE FROM urls WHERE id = ${urlId}`;
}

// ==========================================
// CHUNKS CRUD
// ==========================================

export async function addChunks(workspaceId: string, chunks: DocumentChunk[]): Promise<void> {
  if (chunks.length === 0) return;

  // Costruiamo un INSERT multi-riga parametrizzato.
  const cols = 8; // id, workspace_id, source_type, source_id, source_name, content, embedding, metadata
  const params: unknown[] = [];
  const tuples = chunks.map((c, i) => {
    const b = i * cols;
    params.push(
      c.id,
      workspaceId,
      c.sourceType,
      c.sourceId,
      c.sourceName,
      c.content,
      toVector(c.embedding),
      JSON.stringify(c.metadata ?? {})
    );
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::vector, $${b + 8}::jsonb)`;
  });

  const query = `
    INSERT INTO chunks (id, workspace_id, source_type, source_id, source_name, content, embedding, metadata)
    VALUES ${tuples.join(', ')}
  `;

  await sql.query(query, params);
}

export async function getChunks(workspaceId: string): Promise<DocumentChunk[]> {
  const rows = await sql`SELECT * FROM chunks WHERE workspace_id = ${workspaceId}`;
  return rows.map(c => ({
    id: c.id,
    workspaceId: c.workspace_id,
    sourceType: c.source_type as 'document' | 'url',
    sourceName: c.source_name,
    sourceId: c.source_id,
    content: c.content,
    embedding: parseJson<number[]>(c.embedding) ?? [],
    metadata: parseJson<Record<string, unknown>>(c.metadata) ?? {},
  }));
}

// ==========================================
// INGESTIONE ASINCRONA
// ==========================================

/**
 * Inserisce i chunk SENZA embedding (embedding = NULL).
 * Gli embedding vengono generati dopo, a batch, dall'endpoint /api/ingest/process.
 */
export async function addChunkTexts(workspaceId: string, chunks: ChunkText[]): Promise<void> {
  if (chunks.length === 0) return;

  const cols = 7; // id, workspace_id, source_type, source_id, source_name, content, metadata
  const params: unknown[] = [];
  const tuples = chunks.map((c, i) => {
    const b = i * cols;
    params.push(
      c.id,
      workspaceId,
      c.sourceType,
      c.sourceId,
      c.sourceName,
      c.content,
      JSON.stringify(c.metadata ?? {})
    );
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::jsonb)`;
  });

  const query = `
    INSERT INTO chunks (id, workspace_id, source_type, source_id, source_name, content, metadata)
    VALUES ${tuples.join(', ')}
  `;
  await sql.query(query, params);
}

/** Ritorna i prossimi chunk ancora privi di embedding per una sorgente. */
export async function getPendingChunks(sourceId: string, limit: number): Promise<{ id: string; content: string }[]> {
  const rows = await sql`
    SELECT id, content FROM chunks
    WHERE source_id = ${sourceId} AND embedding IS NULL
    ORDER BY id
    LIMIT ${limit}
  `;
  return rows.map(r => ({ id: r.id, content: r.content }));
}

/** Aggiorna in blocco gli embedding dei chunk indicati. */
export async function setChunkEmbeddings(pairs: { id: string; embedding: number[] }[]): Promise<void> {
  const valid = pairs.filter(p => p.embedding && p.embedding.length > 0);
  if (valid.length === 0) return;

  const params: unknown[] = [];
  const values = valid.map((p, i) => {
    const b = i * 2;
    params.push(p.id, `[${p.embedding.join(',')}]`);
    return `($${b + 1}::uuid, $${b + 2}::vector)`;
  });

  const query = `
    UPDATE chunks AS c
    SET embedding = v.emb
    FROM (VALUES ${values.join(', ')}) AS v(id, emb)
    WHERE c.id = v.id
  `;
  await sql.query(query, params);
}

/** Conteggio totale e completati (con embedding) per una sorgente. */
export async function getChunkProgress(sourceId: string): Promise<{ total: number; done: number }> {
  const rows = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE embedding IS NOT NULL)::int AS done
    FROM chunks WHERE source_id = ${sourceId}
  `;
  return { total: rows[0]?.total ?? 0, done: rows[0]?.done ?? 0 };
}

// ==========================================
// VALUTAZIONE (test set + LLM-judge)
// ==========================================

export interface EvalQuestion {
  id: string;
  workspaceId: string;
  question: string;
  expected?: string;
  createdAt: string;
}

export interface EvalRun {
  id: string;
  workspaceId: string;
  status: string;
  avgScore: number | null;
  total: number;
  createdAt: string;
  /** Giudice usato: i punteggi sono confrontabili solo fra run dello stesso modello. */
  judgeModel?: string;
}

export interface EvalResultRow {
  id: string;
  runId: string;
  question: string;
  answer: string;
  score: number;
  groundedness: number;
  correctness: number;
  feedback: string;
  createdAt: string;
}

export async function getEvalQuestions(workspaceId: string): Promise<EvalQuestion[]> {
  const rows = await sql`
    SELECT * FROM eval_questions WHERE workspace_id = ${workspaceId} ORDER BY created_at ASC
  `;
  return rows.map(r => ({
    id: r.id,
    workspaceId: r.workspace_id,
    question: r.question,
    expected: r.expected ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function getEvalQuestion(workspaceId: string, questionId: string): Promise<EvalQuestion | null> {
  const rows = await sql`
    SELECT * FROM eval_questions WHERE id = ${questionId} AND workspace_id = ${workspaceId}
  `;
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, workspaceId: r.workspace_id, question: r.question, expected: r.expected ?? undefined, createdAt: r.created_at };
}

export async function addEvalQuestion(workspaceId: string, q: { id: string; question: string; expected?: string }): Promise<void> {
  await sql`
    INSERT INTO eval_questions (id, workspace_id, question, expected)
    VALUES (${q.id}, ${workspaceId}, ${q.question}, ${q.expected ?? null})
  `;
}

export async function removeEvalQuestion(workspaceId: string, questionId: string): Promise<void> {
  await sql`DELETE FROM eval_questions WHERE id = ${questionId} AND workspace_id = ${workspaceId}`;
}

export async function createEvalRun(
  workspaceId: string,
  runId: string,
  total: number,
  judgeModel: string
): Promise<void> {
  await sql`
    INSERT INTO eval_runs (id, workspace_id, status, total, judge_model)
    VALUES (${runId}, ${workspaceId}, 'running', ${total}, ${judgeModel})
  `;
}

export async function addEvalResult(runId: string, r: {
  id: string; question: string; answer: string;
  score: number; groundedness: number; correctness: number; feedback: string;
}): Promise<void> {
  await sql`
    INSERT INTO eval_results (id, run_id, question, answer, score, groundedness, correctness, feedback)
    VALUES (${r.id}, ${runId}, ${r.question}, ${r.answer}, ${r.score}, ${r.groundedness}, ${r.correctness}, ${r.feedback})
  `;
}

export async function finalizeEvalRun(runId: string): Promise<{ avgScore: number; total: number }> {
  const rows = await sql`
    SELECT avg(score)::real AS avg, count(*)::int AS total FROM eval_results WHERE run_id = ${runId}
  `;
  const avgScore = Math.round(rows[0]?.avg ?? 0);
  const total = rows[0]?.total ?? 0;
  await sql`UPDATE eval_runs SET status = 'done', avg_score = ${avgScore}, total = ${total} WHERE id = ${runId}`;
  return { avgScore, total };
}

export async function getEvalRuns(workspaceId: string, limit = 10): Promise<EvalRun[]> {
  const rows = await sql`
    SELECT * FROM eval_runs WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(r => ({
    id: r.id,
    workspaceId: r.workspace_id,
    status: r.status,
    avgScore: r.avg_score,
    total: r.total,
    createdAt: r.created_at,
    judgeModel: r.judge_model ?? undefined,
  }));
}
