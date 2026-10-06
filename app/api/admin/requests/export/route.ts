/* تصدير الطلبات ملفًّا يفتحه Excel مباشرةً (CSV بترميز UTF-8 وعلامته، فيظهر
   العربي سليمًا). لصاحب صلاحية «تصدير الطلبات» وحده، وكل تصدير في السجل:
   بيانات العملاء شخصية ولا تخرج من اللوحة بلا أثر. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { q, when } from '@/lib/db';
import { audit } from '@/lib/audit';
import { STATUSES, STATUS_AR, KIND_AR, SOURCE_AR, OPEN } from '@/lib/requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* خلية CSV آمنة: علامات الاقتباس مضاعفة، وما يبدأ بـ = + - @ يُسبق بفاصلة
   عليا كي لا ينفّذه Excel معادلةً */
const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
/* رقم الموبايل نصًّا: Excel يحذف صفر 010… إن قرأه رقمًا. الصيغة ="…" تُبقيه كما
   هو، وهي آمنة هنا لأن القيمة أرقام ومسافات و+ و- فقط */
const phoneCell = (v: unknown) => {
  const s = v == null ? '' : String(v).trim();
  return /^[+\d][\d\s-]{5,}$/.test(s) ? `"=""${s}"""` : cell(s);
};

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  if (!can(u, 'requests.export')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const s = sp.get('s') ?? 'all';
  const term = (sp.get('q') ?? '').trim();
  const where: string[] = [];
  const args: unknown[] = [];
  if (s === 'open') { where.push(`r.status IN (${OPEN.map(() => '?').join(',')})`); args.push(...OPEN); }
  else if (STATUSES.some(([k]) => k === s)) { where.push('r.status = ?'); args.push(s); }
  if (term) {
    where.push('(r.name LIKE ? OR r.phone LIKE ? OR r.email LIKE ? OR r.company LIKE ? OR r.message LIKE ?)');
    args.push(...Array(5).fill(`%${term}%`));
  }
  const rows = await q<any>(
    `SELECT r.*, u.name AS owner FROM requests r LEFT JOIN users u ON u.id = r.assigned_to
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.id DESC LIMIT 20000`, args
  );

  const head = ['رقم', 'التاريخ', 'النوع', 'المصدر', 'الحالة', 'المسؤول', 'الاسم', 'الشركة', 'الموبايل', 'البريد', 'المكان', 'المنتجات', 'الرسالة', 'الصفحة'];
  const lines = [head.map(cell).join(',')];
  for (const r of rows) {
    let items: any[] = [];
    try { items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items ?? []; } catch { /* فارغة */ }
    lines.push([
      cell(r.id), cell(when(r.created_at)), cell(KIND_AR[r.kind] ?? r.kind), cell(SOURCE_AR[r.source] ?? r.source ?? ''),
      cell(STATUS_AR[r.status] ?? r.status), cell(r.owner ?? ''), cell(r.name), cell(r.company), phoneCell(r.phone),
      cell(r.email), cell(r.city),
      cell((Array.isArray(items) ? items : []).map((i) => `${i.name ?? i.ref}${i.sku ? ` [${i.sku}]` : ''} × ${i.qty}`).join(' | ')),
      cell(r.message), cell(r.page),
    ].join(','));
  }
  await audit(u, 'request.export', { entity: 'request', summary: `${rows.length} طلب (${s === 'all' ? 'الكل' : s === 'open' ? 'المفتوحة' : STATUS_AR[s] ?? s}${term ? `، بحث «${term}»` : ''})` });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="5am-requests-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
