/**
 * db.ts — Client database Neon (Postgres serverless + pgvector)
 *
 * Sostituisce il client Supabase. Usa il driver HTTP serverless di Neon,
 * ideale per le funzioni serverless di Vercel (una query = una fetch).
 *
 * Variabile d'ambiente richiesta: DATABASE_URL (fornita da Neon/Vercel).
 */
import { neon } from '@neondatabase/serverless';

// L'integrazione Neon su Vercel espone le variabili con prefisso dello store
// (es. `marius_DATABASE_URL`). Supportiamo sia il nome standard sia quello con prefisso.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.marius_DATABASE_URL ||
  process.env.marius_POSTGRES_URL ||
  '';

if (!connectionString) {
  console.warn(
    '[DB] Attenzione: DATABASE_URL non impostata. ' +
    'Configurala su Vercel (integrazione Neon) o in .env.local per lo sviluppo locale.'
  );
}

// Fallback sintatticamente valido: evita il crash di import/build quando la
// variabile manca. Le query falliranno con un errore di connessione esplicito.
export const sql = neon(
  connectionString || 'postgresql://user:pass@localhost:5432/db?sslmode=require'
);
