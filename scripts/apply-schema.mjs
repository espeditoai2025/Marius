/**
 * apply-schema.mjs — Applica db/schema.sql al database Neon.
 *
 * Uso:
 *   1. Assicurati che DATABASE_URL (o marius_DATABASE_URL) sia disponibile:
 *        vercel env pull .env.local --environment=production
 *      oppure incolla la connection string Neon in .env.local
 *   2. Esegui:
 *        npm run db:setup
 *
 * Lo script è idempotente (lo schema usa IF NOT EXISTS), puoi rieseguirlo.
 */
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

// Carica le variabili da .env.local se presente (senza dipendenze esterne).
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* .env.local opzionale */ }

const url =
  process.env.DATABASE_URL ||
  process.env.marius_DATABASE_URL ||
  process.env.marius_POSTGRES_URL;

if (!url) {
  console.error('✗ DATABASE_URL non trovata. Imposta la connection string Neon in .env.local.');
  process.exit(1);
}

const sql = neon(url);

const raw = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
// Rimuove le righe di commento e divide in singole istruzioni.
const cleaned = raw
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n');
const statements = cleaned.split(';').map((s) => s.trim()).filter(Boolean);

console.log(`Applico ${statements.length} istruzioni su Neon...`);
for (const stmt of statements) {
  const label = stmt.split('\n')[0].slice(0, 70);
  try {
    await sql.query(stmt);
    console.log('  ✓', label);
  } catch (err) {
    console.error('  ✗', label, '\n   ', err.message);
    process.exit(1);
  }
}
console.log('✓ Schema applicato con successo.');
