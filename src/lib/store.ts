/**
 * store.ts — Storage JSON su file system
 * Gestisce la persistenza dei dati per workspace, prompt, chat, documenti, URL e chunk.
 */

import fs from 'fs/promises';
import path from 'path';

// Directory base per i dati
const DATA_DIR = path.join(process.cwd(), 'data');

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
  metadata: Record<string, string>;
}

// ==========================================
// HELPER — Lettura/Scrittura file JSON
// ==========================================

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // La directory esiste già
  }
}

async function readJSON<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ==========================================
// PATH HELPERS
// ==========================================

function workspacesPath(): string {
  return path.join(DATA_DIR, 'workspaces.json');
}

function workspaceDir(workspaceId: string): string {
  return path.join(DATA_DIR, 'workspaces', workspaceId);
}

function promptPath(workspaceId: string): string {
  return path.join(workspaceDir(workspaceId), 'prompt.json');
}

function chatHistoryPath(workspaceId: string): string {
  return path.join(workspaceDir(workspaceId), 'chat-history.json');
}

function documentsPath(workspaceId: string): string {
  return path.join(workspaceDir(workspaceId), 'documents.json');
}

function urlsPath(workspaceId: string): string {
  return path.join(workspaceDir(workspaceId), 'urls.json');
}

function chunksPath(workspaceId: string): string {
  return path.join(workspaceDir(workspaceId), 'chunks.json');
}

export function uploadsDir(workspaceId: string): string {
  return path.join(DATA_DIR, 'uploads', workspaceId);
}

// ==========================================
// WORKSPACE CRUD
// ==========================================

export async function getWorkspaces(): Promise<Workspace[]> {
  return readJSON<Workspace[]>(workspacesPath(), []);
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const workspaces = await getWorkspaces();
  return workspaces.find(w => w.id === id) || null;
}

export async function createWorkspace(workspace: Workspace): Promise<void> {
  const workspaces = await getWorkspaces();
  workspaces.push(workspace);
  await writeJSON(workspacesPath(), workspaces);
  // Crea la directory del workspace
  await ensureDir(workspaceDir(workspace.id));
}

export async function deleteWorkspace(id: string): Promise<void> {
  const workspaces = await getWorkspaces();
  const filtered = workspaces.filter(w => w.id !== id);
  await writeJSON(workspacesPath(), filtered);
  // Rimuovi la directory del workspace
  try {
    await fs.rm(workspaceDir(id), { recursive: true, force: true });
    await fs.rm(uploadsDir(id), { recursive: true, force: true });
  } catch {
    // Ignora errori di pulizia
  }
}

// ==========================================
// PROMPT CRUD
// ==========================================

export async function getPrompt(workspaceId: string): Promise<AgentPrompt | null> {
  return readJSON<AgentPrompt | null>(promptPath(workspaceId), null);
}

export async function savePrompt(prompt: AgentPrompt): Promise<void> {
  await writeJSON(promptPath(prompt.workspaceId), prompt);
}

// ==========================================
// CHAT HISTORY CRUD
// ==========================================

export async function getChatHistory(workspaceId: string): Promise<ChatMessage[]> {
  return readJSON<ChatMessage[]>(chatHistoryPath(workspaceId), []);
}

export async function addChatMessage(workspaceId: string, message: ChatMessage): Promise<void> {
  const history = await getChatHistory(workspaceId);
  history.push(message);
  await writeJSON(chatHistoryPath(workspaceId), history);
}

export async function clearChatHistory(workspaceId: string): Promise<void> {
  await writeJSON(chatHistoryPath(workspaceId), []);
}

// ==========================================
// DOCUMENT METADATA CRUD
// ==========================================

export async function getDocuments(workspaceId: string): Promise<DocumentMeta[]> {
  return readJSON<DocumentMeta[]>(documentsPath(workspaceId), []);
}

export async function addDocument(workspaceId: string, doc: DocumentMeta): Promise<void> {
  const docs = await getDocuments(workspaceId);
  docs.push(doc);
  await writeJSON(documentsPath(workspaceId), docs);
}

export async function removeDocument(workspaceId: string, docId: string): Promise<void> {
  const docs = await getDocuments(workspaceId);
  const filtered = docs.filter(d => d.id !== docId);
  await writeJSON(documentsPath(workspaceId), filtered);
  // Rimuovi anche i chunk associati
  await removeChunksBySource(workspaceId, docId);
}

// ==========================================
// URL METADATA CRUD
// ==========================================

export async function getUrls(workspaceId: string): Promise<UrlMeta[]> {
  return readJSON<UrlMeta[]>(urlsPath(workspaceId), []);
}

export async function addUrl(workspaceId: string, url: UrlMeta): Promise<void> {
  const urls = await getUrls(workspaceId);
  urls.push(url);
  await writeJSON(urlsPath(workspaceId), urls);
}

export async function removeUrl(workspaceId: string, urlId: string): Promise<void> {
  const urls = await getUrls(workspaceId);
  const filtered = urls.filter(u => u.id !== urlId);
  await writeJSON(urlsPath(workspaceId), filtered);
  // Rimuovi anche i chunk associati
  await removeChunksBySource(workspaceId, urlId);
}

// ==========================================
// CHUNKS CRUD
// ==========================================

export async function getChunks(workspaceId: string): Promise<DocumentChunk[]> {
  return readJSON<DocumentChunk[]>(chunksPath(workspaceId), []);
}

export async function addChunks(workspaceId: string, chunks: DocumentChunk[]): Promise<void> {
  const existing = await getChunks(workspaceId);
  existing.push(...chunks);
  await writeJSON(chunksPath(workspaceId), existing);
}

async function removeChunksBySource(workspaceId: string, sourceId: string): Promise<void> {
  const chunks = await getChunks(workspaceId);
  const filtered = chunks.filter(c => c.sourceId !== sourceId);
  await writeJSON(chunksPath(workspaceId), filtered);
}
