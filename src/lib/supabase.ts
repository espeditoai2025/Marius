import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
// Supporta sia SUPABASE_ANON_KEY che NEXT_PUBLIC_SUPABASE_ANON_KEY (usata spesso dalle integrazioni automatiche)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Supabase] Attenzione: Credenziali mancanti o incomplete nelle variabili d\'ambiente.');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
