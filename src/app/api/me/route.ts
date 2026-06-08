/**
 * API Route: /api/me — utente autenticato corrente (per la UI).
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';

export async function GET() {
  const { data } = await auth.getSession();
  if (!data?.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email, name: data.user.name },
  });
}
