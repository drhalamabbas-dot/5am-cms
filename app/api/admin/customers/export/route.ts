/* ملف العملاء (Excel) — للسوبر أدمن وحده، كما اتُّفق: بيانات العملاء أثمن ما في
   النظام، فلا تخرج إلا بيده، وكل تصدير مسجّل (من ومتى وكم عميل). */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { isSuper } from '@/lib/permissions';
import { q, when } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const phoneCell = (v: unknown) => {
  const s = v == null ? '' : String(v).trim();
  return /^[+\d][\d\s-]{5,}$/.test(s) ? `"=""${s}"""` : cell(s);
};

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  if (!isSuper(u)) return NextResponse.json({ error: 'للسوبر أدمن وحده' }, { status: 403 });

  const rows = await q<any>(
    `SELECT c.*, o.name AS owner,
            (SELECT COUNT(*) FROM requests r WHERE r.customer_id = c.id) AS reqs,
            (SELECT COUNT(*) FROM deals d WHERE d.customer_id = c.id AND d.stage IN ('lead','quoted','negotiation')) AS open_deals,
            (SELECT SUM(d.value) FROM deals d WHERE d.customer_id = c.id AND d.stage IN ('lead','quoted','negotiation')) AS open_value,
            (SELECT SUM(d.value) FROM deals d WHERE d.customer_id = c.id AND d.stage = 'won') AS won_value
       FROM customers c LEFT JOIN users o ON o.id = c.owner_id ORDER BY c.id`
  );
  const head = ['رقم', 'الاسم', 'الشركة', 'الموبايل', 'البريد', 'المدينة', 'المصدر', 'المسؤول', 'عدد الطلبات',
    'صفقات مفتوحة', 'قيمة المفتوحة', 'قيمة المربوحة', 'آخر تواصل', 'أُضيف', 'ملاحظات'];
  const SRC: Record<string, string> = { store: 'المتجر', quote: 'عرض السعر', product: 'صفحة منتج', manual: 'أضافه موظف', contact: 'التواصل' };
  const lines = [head.map(cell).join(',')];
  for (const c of rows) {
    lines.push([
      cell(c.id), cell(c.name), cell(c.company), phoneCell(c.phone), cell(c.email), cell(c.city), cell(SRC[c.source] ?? c.source ?? ''),
      cell(c.owner ?? ''), cell(c.reqs), cell(c.open_deals), cell(c.open_value ?? ''), cell(c.won_value ?? ''),
      cell(c.last_contact_at ? when(c.last_contact_at) : ''), cell(when(c.created_at)), cell(c.notes),
    ].join(','));
  }
  await audit(u, 'customer.export', { entity: 'customer', summary: `${rows.length} عميل` });
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="5am-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
