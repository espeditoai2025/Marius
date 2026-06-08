-- ============================================================
-- schema.sql — Schema database per Neon (Postgres + pgvector)
-- Esegui questo file UNA VOLTA sul database Neon collegato.
--   psql "$DATABASE_URL" -f db/schema.sql
-- oppure incolla il contenuto nella SQL Console di Neon.
-- ============================================================

-- Estensione per la ricerca vettoriale (RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- Workspaces
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id    text, -- id utente Neon Auth (neon_auth.users_sync)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Migrazione per DB esistenti: collega i workspace all'utente proprietario.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id text;
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- ------------------------------------------------------------
-- Prompt dell'agente (uno per workspace)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prompts (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  content      text NOT NULL,
  temperature  real NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Migrazione per DB esistenti: aggiunge la colonna se manca.
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS temperature real NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- Cronologia chat
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role         text NOT NULL,
  content      text NOT NULL,
  sources      jsonb,
  model        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace ON chat_messages(workspace_id);

-- ------------------------------------------------------------
-- Metadati documenti
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  filename     text NOT NULL,
  mime_type    text,
  size         bigint,
  chunks_count integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'ready', -- 'processing' | 'ready' | 'error'
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

-- ------------------------------------------------------------
-- Metadati URL indicizzati
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS urls (
  id           uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url          text NOT NULL,
  title        text,
  chunks_count integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'ready', -- 'processing' | 'ready' | 'error'
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_urls_workspace ON urls(workspace_id);
ALTER TABLE urls ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

-- ------------------------------------------------------------
-- Chunk con embedding (1536 dim = text-embedding-3-small)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
  id           uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type  text NOT NULL,
  source_id    uuid NOT NULL,
  source_name  text,
  content      text NOT NULL,
  embedding    vector(1536),
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_chunks_workspace ON chunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);

-- Indice vettoriale per la ricerca semantica (cosine)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON chunks USING hnsw (embedding vector_cosine_ops);
