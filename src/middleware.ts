/**
 * middleware.ts — Protegge le pagine dell'app: utente non autenticato → /auth/sign-in.
 * Le route API si proteggono singolarmente leggendo la sessione (getUserId).
 */
import { auth } from '@/lib/auth/server';

export default auth.middleware({ loginUrl: '/auth/sign-in' });

export const config = {
  matcher: ['/', '/workspace/:path*'],
};
