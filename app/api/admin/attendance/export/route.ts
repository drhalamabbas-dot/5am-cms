/* تصدير حضور الشهر (Excel) — للسوبر أدمن وحده، وكل تصدير في السجل. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { isSuper } from '@/lib/permissions';
import { q, when } from '@/lib/db';
import { audit } from '@/lib/audit';
import { cairoNow, duration, ATT_STATUS } from '@/lib/attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  if (!isSuper(u)) return NextResponse.json({ error: 'للسوبر أدمن وحده' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.get('m') ?? '') ? sp.get('m')! : cairoNow().day.slice(0, 7);
  const uid = Number(sp.get('u')) || 0;
  const rows = await q<any>(
    `SELECT a.*, u.name, u.email FROM attendance a JOIN users u ON u.id = a.user_id
      WHERE a.day BETWEEN ? AND LAST_DAY(?) ${uid ? 'AND a.user_id = ?' : ''} ORDER BY u.name, a.day`,
    uid ? [`${month}-01`, `${month}-01`, uid] : [`${month}-01`, `${month}-01`]
  );
  const t = (v: unknown) => (v ? when(v).split(' · ')[1] : '');
  const lines = [['الموظف', 'اليوم', 'حضور', 'انصراف', 'المدة', 'بعد الحضور عن المكتب (م)', 'بعد الانصراف (م)', 'الحالة', 'ملاحظة'].map(cell).join(',')];
  for (const r of rows) {
    lines.push([r.name || r.email, when(r.day).split(' · ')[0], t(r.check_in), t(r.check_out), duration(r.check_in, r.check_out),
      r.in_dist ?? '', r.out_dist ?? '', ATT_STATUS[r.status]?.[0] ?? r.status, r.note ?? ''].map(cell).join(','));
  }
  await audit(u, 'attendance.export', { entity: 'attendance', summary: `${month}: ${rows.length} يوم` });
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="5am-attendance-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
