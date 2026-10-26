/* =============================================================================
   تصدير بيانات التدريب — ردود الكاش + حقائق المنتجات بصيغة JSONL
   جاهزة للـ fine-tuning (OpenAI/Qwen chat format).

   node scripts/export-training.mjs
============================================================================= */
import { connect, log } from './lib.mjs';
import fs from 'fs';
import path from 'path';

const db = await connect();

const out = [];

/* 1) ردود الكاش — ردود الموديلات (المعلمين) */
const [cache] = await db.query(
  "SELECT question, answer, source, lang, status, hits FROM chat_cache WHERE status <> 'rejected' ORDER BY id"
);
log.ok(`${cache.length} رد من الكاش`);

for (const r of cache) {
  out.push({
    messages: [
      { role: 'system', content: systemPrompt(r.lang) },
      { role: 'user', content: r.question },
      { role: 'assistant', content: r.answer },
    ],
    metadata: {
      source: r.source,
      lang: r.lang,
      status: r.status,
      hits: r.hits,
      type: 'cache',
    },
  });
}

/* 2) حقائق المنتجات — من القاعدة مباشرةً */
const [products] = await db.query(
  `SELECT p.ref, p.slug, p.name_ar, p.name_en, p.description_ar, p.description_en,
          p.data, b.name AS brand_name
     FROM products p LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.published = 1 ORDER BY p.id`
);

let factCount = 0;
for (const p of products) {
  const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data ?? {});

  for (const lang of ['ar', 'en']) {
    const name = lang === 'ar' ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar);
    const desc = lang === 'ar' ? (p.description_ar || p.description_en) : (p.description_en || p.description_ar);
    if (!name) continue;

    const specs = (data.specifications ?? []).filter(s => s?.k && s?.v);
    const feats = (data.features ?? []).filter(Boolean);
    const apps = (data.applications ?? []).filter(Boolean);

    /* سؤال عام عن المنتج */
    if (desc) {
      const q = lang === 'ar' ? `ايه هو ${name}؟` : `What is the ${name}?`;
      const a = lang === 'ar'
        ? `${name}${p.brand_name ? ` من ${p.brand_name}` : ''}: ${desc}\nتحب نجهّزلك عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`
        : `${name}${p.brand_name ? ` by ${p.brand_name}` : ''}: ${desc}\nWant a quotation? Tap the "Talk to a person" button below.`;
      out.push({
        messages: [
          { role: 'system', content: systemPrompt(lang) },
          { role: 'user', content: q },
          { role: 'assistant', content: a },
        ],
        metadata: { source: 'facts', lang, type: 'product_info', product: name },
      });
      factCount++;
    }

    /* المواصفات */
    if (specs.length >= 3) {
      const q = lang === 'ar' ? `ايه مواصفات ${name}؟` : `What are the specs of the ${name}?`;
      const specList = specs.slice(0, 10).map(s => `- ${s.k}: ${s.v}`).join('\n');
      const a = lang === 'ar'
        ? `المواصفات الأساسية لـ ${name}:\n${specList}\nتحب عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`
        : `Key specifications of the ${name}:\n${specList}\nWant a quotation? Tap the "Talk to a person" button below.`;
      out.push({
        messages: [
          { role: 'system', content: systemPrompt(lang) },
          { role: 'user', content: q },
          { role: 'assistant', content: a },
        ],
        metadata: { source: 'facts', lang, type: 'product_specs', product: name },
      });
      factCount++;
    }

    /* المزايا */
    if (feats.length >= 2) {
      const q = lang === 'ar' ? `ليه اختار ${name}؟` : `Why choose the ${name}?`;
      const featList = feats.slice(0, 6).map(f => `- ${f}`).join('\n');
      const a = lang === 'ar'
        ? `أهم مزايا ${name}:\n${featList}\nتحب نجهّزلك عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`
        : `What sets the ${name} apart:\n${featList}\nWant a quotation? Tap the "Talk to a person" button below.`;
      out.push({
        messages: [
          { role: 'system', content: systemPrompt(lang) },
          { role: 'user', content: q },
          { role: 'assistant', content: a },
        ],
        metadata: { source: 'facts', lang, type: 'product_features', product: name },
      });
      factCount++;
    }

    /* الاستخدامات */
    if (apps.length >= 2) {
      const q = lang === 'ar' ? `${name} بيستخدم في ايه؟` : `What is the ${name} used for?`;
      const appList = apps.slice(0, 6).map(a => `- ${a}`).join('\n');
      const a = lang === 'ar'
        ? `${name} مناسب لـ:\n${appList}\nتحب عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`
        : `The ${name} fits:\n${appList}\nWant a quotation? Tap the "Talk to a person" button below.`;
      out.push({
        messages: [
          { role: 'system', content: systemPrompt(lang) },
          { role: 'user', content: q },
          { role: 'assistant', content: a },
        ],
        metadata: { source: 'facts', lang, type: 'product_apps', product: name },
      });
      factCount++;
    }
  }
}
log.ok(`${factCount} زوج من حقائق المنتجات`);

/* 3) محادثات حقيقية — كل محادثة كسلسلة كاملة */
const [convs] = await db.query(
  `SELECT c.id, c.lang FROM chat_conversations c
    WHERE (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) >= 3
    ORDER BY c.id`
);
let convCount = 0;
for (const c of convs) {
  const [msgs] = await db.query(
    `SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user','bot','agent') ORDER BY id`, [c.id]
  );
  if (msgs.length < 3) continue;
  const messages = [
    { role: 'system', content: systemPrompt(c.lang || 'ar') },
    ...msgs.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: (m.text || '').slice(0, 1500),
    })),
  ];
  out.push({
    messages,
    metadata: { source: 'conversation', lang: c.lang || 'ar', type: 'multi_turn', conv_id: c.id },
  });
  convCount++;
}
log.ok(`${convCount} محادثة كاملة`);

/* كتابة الملف */
const outDir = 'training-data';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const jsonlPath = path.join(outDir, 'training.jsonl');
const lines = out.map(r => JSON.stringify(r));
fs.writeFileSync(jsonlPath, lines.join('\n'), 'utf8');

/* ملخص */
const statsPath = path.join(outDir, 'stats.json');
const stats = {
  total: out.length,
  from_cache: cache.length,
  from_facts: factCount,
  from_conversations: convCount,
  by_lang: { ar: out.filter(r => r.metadata.lang === 'ar').length, en: out.filter(r => r.metadata.lang === 'en').length },
  by_source: {},
  exported_at: new Date().toISOString(),
};
for (const r of out) {
  const s = r.metadata.source;
  stats.by_source[s] = (stats.by_source[s] || 0) + 1;
}
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');

log.ok(`\nتم التصدير: ${out.length} زوج تدريب`);
log.ok(`الملف: ${jsonlPath}`);
log.ok(`الإحصائيات: ${statsPath}`);
console.log(JSON.stringify(stats, null, 2));

await db.end();

/* ------------------------------------------------------------ system prompt مختصر */
function systemPrompt(lang) {
  return `You are the sales assistant of 5A&M (Egypt): diesel generators, power solutions, environmental equipment (Elgin sweepers, Vactor, Guzzler) and genuine spare parts. Your job is to help the customer find the right product and guide them to a quotation. Reply in ${lang === 'ar' ? 'Egyptian colloquial Arabic' : 'English'}. Never state prices. Always recommend tapping the "Talk to a person" button for quotes.`;
}
