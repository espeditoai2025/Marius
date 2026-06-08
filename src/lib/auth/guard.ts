/**
 * guard.ts — Helper di autorizzazione per le route API.
 * `requireWorkspace` verifica che l'utente sia autenticato E proprietario del workspace.
 */
import { NextResponse } from 'next/server';
import { getUserId } from './server';
import { userOwnsWorkspace } from '@/lib/store';

type Guard = { userId: string } | { res: NextResponse };

export async function requireUser(): Promise<Guard> {
  const userId = await getUserId();
  if (!userId) return { res: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) };
  return { userId };
}

export async function requireWorkspace(workspaceId: string | null | undefined): Promise<Guard> {
  const userId = await getUserId();
  if (!userId) return { res: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) };
  if (!workspaceId) return { res: NextResponse.json({ error: 'workspaceId mancante' }, { status: 400 }) };
  if (!(await userOwnsWorkspace(workspaceId, userId))) {
    return { res: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) };
  }
  return { userId };
}
