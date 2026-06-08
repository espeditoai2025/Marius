/**
 * Catch-all handler di Neon Auth: proxy verso il server di autenticazione.
 * Gestisce sign-in/up/out, sessione, ecc. su /api/auth/*
 */
import { auth } from '@/lib/auth/server';

export const { GET, POST } = auth.handler();
