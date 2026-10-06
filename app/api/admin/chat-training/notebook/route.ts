/* دفتر Colab لتدريب موديلنا (scripts/colab/train-5am-model.ipynb) — يُنزَّل ثم
   يُفتح من colab.research.google.com ← Upload. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await currentUser();
  if (!u || !can(u, 'chat.train')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: u ? 403 : 401 });
  const buf = await fs.readFile(path.join(process.cwd(), 'scripts', 'colab', 'train-5am-model.ipynb'));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/x-ipynb+json',
      'Content-Disposition': 'attachment; filename="train-5am-model.ipynb"',
      'Cache-Control': 'no-store',
    },
  });
}
