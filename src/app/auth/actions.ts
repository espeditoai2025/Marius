'use server';

/**
 * Server actions per autenticazione email/password (Neon Auth).
 */
import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export type AuthState = { error?: string };

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Inserisci email e password.' };

  const { error } = await auth.signIn.email({ email, password });
  if (error) return { error: error.message || 'Credenziali non valide.' };

  redirect('/workspace');
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Inserisci email e password.' };
  if (password.length < 8) return { error: 'La password deve avere almeno 8 caratteri.' };

  const { error } = await auth.signUp.email({ email, name: name || email, password });
  if (error) return { error: error.message || 'Registrazione fallita.' };

  redirect('/workspace');
}
