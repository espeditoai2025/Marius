/**
 * store.ts — Storage basato su Supabase
 * Gestisce la persistenza dei dati per workspace, prompt, chat, documenti, URL e chunk.
 */

import { supabase } from './supabase';

// ==========================================
// TIPI
// ==========================================

export interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPrompt {
  workspaceId: string;
  content: string;
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
  uploadedAt: string;
}

export interface UrlMeta {
  id: string;
  workspaceId: string;
  url: string;
  title: string;
  chunksCount: number;
  ingestedAt: string;
}

export interface DocumentChunk {
  id: string;
  workspaceId: string;
  sourceType: 'document' | 'url';
  sourceName: string;
  sourceId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

// ==========================================
// WORKSPACE CRUD
// ==========================================

export async function getWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(w => ({
    id: w.id,
    name: w.name,
    description: w.description,
    createdAt: w.created_at,
    updatedAt: w.updated_at
  }));
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function createWorkspace(workspace: Workspace): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .insert([{
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      created_at: workspace.createdAt,
      updated_at: workspace.updatedAt
    }]);

  if (error) throw error;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ==========================================
// PROMPT CRUD
// ==========================================

export async function getPrompt(workspaceId: string): Promise<AgentPrompt | null> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) return null;
  return {
    workspaceId: data.workspace_id,
    content: data.content,
    updatedAt: data.updated_at
  };
}

export async function savePrompt(prompt: AgentPrompt): Promise<void> {
  const { error } = await supabase
    .from('prompts')
    .upsert({
      workspace_id: prompt.workspaceId,
      content: prompt.content,
      updated_at: new Date().toISOString()
    }, { onConflict: 'workspace_id' });

  if (error) throw error;
}

// ==========================================
// CHAT HISTORY CRUD
// ==========================================

export async function getChatHistory(workspaceId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return data.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    sources: m.sources,
    model: m.model,
    timestamp: m.created_at
  }));
}

export async function addChatMessage(workspaceId: string, message: ChatMessage): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .insert([{
      id: message.id.includes('-') ? message.id : undefined, // Usa UUID se valido, altrimenti lascia generare a Supabase
      workspace_id: workspaceId,
      role: message.role,
      content: message.content,
      sources: message.sources,
      model: message.model,
      created_at: message.timestamp
    }]);

  if (error) console.error('[Store] Errore salvataggio messaggio:', error);
}

export async function clearChatHistory(workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}

// ==========================================
// DOCUMENT METADATA CRUD
// ==========================================

export async function getDocuments(workspaceId: string): Promise<DocumentMeta[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(d => ({
    id: d.id,
    workspaceId: d.workspace_id,
    filename: d.filename,
    mimeType: d.mime_type,
    size: Number(d.size),
    chunksCount: d.chunks_count,
    uploadedAt: d.created_at
  }));
}

export async function addDocument(workspaceId: string, doc: DocumentMeta): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .insert([{
      id: doc.id,
      workspace_id: workspaceId,
      filename: doc.filename,
      mime_type: doc.mimeType,
      size: doc.size,
      chunks_count: doc.chunksCount,
      created_at: doc.uploadedAt
    }]);

  if (error) throw error;
}

export async function removeDocument(workspaceId: string, docId: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId);

  if (error) throw error;
}

// ==========================================
// URL METADATA CRUD
// ==========================================

export async function getUrls(workspaceId: string): Promise<UrlMeta[]> {
  const { data, error } = await supabase
    .from('urls')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(u => ({
    id: u.id,
    workspaceId: u.workspace_id,
    url: u.url,
    title: u.title,
    chunksCount: u.chunks_count,
    ingestedAt: u.created_at
  }));
}

export async function addUrl(workspaceId: string, url: UrlMeta): Promise<void> {
  const { error } = await supabase
    .from('urls')
    .insert([{
      id: url.id,
      workspace_id: workspaceId,
      url: url.url,
      title: url.title,
      chunks_count: url.chunksCount,
      created_at: url.ingestedAt
    }]);

  if (error) throw error;
}

export async function removeUrl(workspaceId: string, urlId: string): Promise<void> {
  const { error } = await supabase
    .from('urls')
    .delete()
    .eq('id', urlId);

  if (error) throw error;
}

// ==========================================
// CHUNKS CRUD
// ==========================================

export async function addChunks(workspaceId: string, chunks: DocumentChunk[]): Promise<void> {
  const formatted = chunks.map(c => ({
    id: c.id,
    workspace_id: workspaceId,
    source_type: c.sourceType,
    source_id: c.sourceId,
    source_name: c.sourceName,
    content: c.content,
    embedding: c.embedding,
    metadata: c.metadata
  }));

  const { error } = await supabase
    .from('chunks')
    .insert(formatted);

  if (error) throw error;
}

export async function getChunks(workspaceId: string): Promise<DocumentChunk[]> {
  const { data, error } = await supabase
    .from('chunks')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  return data.map(c => ({
    id: c.id,
    workspaceId: c.workspace_id,
    sourceType: c.source_type as 'document' | 'url',
    sourceName: c.source_name,
    sourceId: c.source_id,
    content: c.content,
    embedding: c.embedding,
    metadata: c.metadata
  }));
}
