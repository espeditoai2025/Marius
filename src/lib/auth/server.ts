/**
 * auth/server.ts — Istanza server di Neon Auth (Better Auth gestito).
 * Espone metodi server (signIn/signUp/getSession/signOut), handler API e middleware.
 */
import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl =
  process.env.NEON_AUTH_BASE_URL ||
  process.env.marius_NEON_AUTH_BASE_URL ||
  '';

const secret = process.env.NEON_AUTH_COOKIE_SECRET || '';

if (!baseUrl || !secret) {
  console.warn('[Auth] NEON_AUTH_BASE_URL o NEON_AUTH_COOKIE_SECRET mancanti. Configura le variabili d\'ambiente.');
}

export const auth = createNeonAuth({
  baseUrl: baseUrl || 'https://placeholder.neonauth.invalid/neondb/auth',
  cookies: {
    // Il secret deve essere ≥ 32 caratteri: il placeholder evita il crash all'import.
    secret: secret || 'placeholder-neon-auth-cookie-secret-change-me-please',
  },
});

/** Ritorna l'id dell'utente autenticato, o null. Da usare nelle route API. */
export async function getUserId(): Promise<string | null> {
  try {
    const { data } = await auth.getSession();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}
