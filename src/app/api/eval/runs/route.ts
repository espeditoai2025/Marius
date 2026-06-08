/**
 * API Route: /api/eval/runs — storico delle run di valutazione (per il trend).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEvalRuns } from '@/lib/store';
import { requireWorkspace } from '@/lib/auth/guard';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  const guard = await requireWorkspace(workspaceId);
  if ('res' in guard) return guard.res;

  const runs = await getEvalRuns(workspaceId!);
  return NextResponse.json({ runs });
}
