/* =============================================================================
   Data Augmentation — توليد أزواج تدريب متنوعة من بيانات المنتجات الحقيقية.

   الأنواع:
   1) صياغات مختلفة لنفس السؤال (paraphrases)
   2) أخطاء إملائية شائعة (typos)
   3) مقارنات بين منتجين
   4) سيناريوهات بيع (احتياج عميل → ترشيح)
   5) اعتراضات عملاء (سعر غالي، منافس أرخص)
   6) أسئلة صيانة وقطع غيار
   7) أسئلة عامة عن الشركة
   8) أسئلة متابعة (follow-up)
   9) طلبات عروض أسعار
   10) أسئلة عن التوصيل والضمان

   node scripts/augment-training.mjs
============================================================================= */
import { connect, log } from './lib.mjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const db = await connect();

const [products] = await db.query(
  `SELECT p.*, b.name AS brand_name FROM products p
   LEFT JOIN brands b ON b.id = p.brand_id
   WHERE p.published = 1 ORDER BY p.id`
);

const [company] = await db.query("SELECT value FROM settings WHERE `key` = 'company'");
const co = company[0] ? (typeof company[0].value === 'string' ? JSON.parse(company[0].value) : company[0].value) : {};

const pairs = [];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

function sys(lang) {
  return `You are the sales assistant of 5A&M (Egypt): diesel generators, power solutions, environmental equipment (Elgin sweepers, Vactor, Guzzler) and genuine spare parts. Your job is to help the customer find the right product and guide them to a quotation. Reply in ${lang === 'ar' ? 'Egyptian colloquial Arabic' : 'English'}. Never state prices. Always recommend tapping the "Talk to a person" button for quotes.`;
}

function add(q, a, lang, type) {
  pairs.push({
    messages: [
      { role: 'system', content: sys(lang) },
      { role: 'user', content: q },
      { role: 'assistant', content: a },
    ],
    metadata: { source: 'augmented', lang, type },
  });
}

for (const p of products) {
  const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data ?? {});
  const nameAr = p.name_ar || p.name_en;
  const nameEn = p.name_en || p.name_ar;
  const descAr = p.description_ar || p.description_en || '';
  const descEn = p.description_en || p.description_ar || '';
  const specs = (data.specifications ?? []).filter(s => s?.k && s?.v);
  const feats = (data.features ?? []).filter(Boolean);
  const apps = (data.applications ?? []).filter(Boolean);
  const brand = p.brand_name || '';
  const slug = p.slug;

  /* ──────────────────── 1) صياغات مختلفة (عربي) */
  if (nameAr) {
    const qs = [
      `ممكن تقولي حاجة عن ${nameAr}؟`,
      `عندكم ${nameAr}؟`,
      `محتاج معلومات عن ${nameAr}`,
      `${nameAr} ده كويس؟`,
      `ايه رأيكم في ${nameAr}؟`,
      `هل ${nameAr} متوفر عندكم؟`,
      `سمعت عن ${nameAr}، عايز أعرف أكتر`,
      `قولي تفاصيل ${nameAr}`,
      `${nameAr} يعني ايه بالظبط؟`,
    ];
    for (const q of qs) {
      const a = `${nameAr}${brand ? ` من ${brand}` : ''}: ${descAr}\n[صفحة ${nameAr}](/model.html?p=${slug}&lang=ar)\nتحب نجهّزلك عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`;
      add(q, a, 'ar', 'paraphrase');
    }
  }

  /* ──────────────────── 1b) صياغات مختلفة (إنجليزي) */
  if (nameEn) {
    const qs = [
      `Can you tell me about the ${nameEn}?`,
      `Do you have the ${nameEn}?`,
      `I need info on the ${nameEn}`,
      `Is the ${nameEn} any good?`,
      `What's your take on the ${nameEn}?`,
      `Is the ${nameEn} available?`,
      `I heard about the ${nameEn}, tell me more`,
      `Give me details on the ${nameEn}`,
    ];
    for (const q of qs) {
      const a = `${nameEn}${brand ? ` by ${brand}` : ''}: ${descEn}\n[${nameEn} page](/model.html?p=${slug}&lang=en)\nWant a quotation? Tap the "Talk to a person" button below.`;
      add(q, a, 'en', 'paraphrase');
    }
  }

  /* ──────────────────── 2) أخطاء إملائية شائعة */
  if (nameAr) {
    const typos = [
      nameAr.replace('ة', 'ه'),
      nameAr.replace('ي', 'ى'),
      nameAr.replace('أ', 'ا'),
      nameAr.replace('إ', 'ا'),
      nameAr.replace(' ', ''),
    ].filter(t => t !== nameAr);
    for (const t of typos.slice(0, 3)) {
      add(`عايز ${t}`, `أيوه، تقصد **${nameAr}**${brand ? ` من ${brand}` : ''}.\n${descAr}\n[صفحة ${nameAr}](/model.html?p=${slug}&lang=ar)\nتحب عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`, 'ar', 'typo');
    }
  }

  /* ──────────────────── 4) سيناريوهات بيع */
  if (apps.length >= 1) {
    for (const app of apps.slice(0, 3)) {
      add(
        `محتاج حل لـ ${app}`,
        `لـ ${app}، نرشّح لك **${nameAr}**${brand ? ` من ${brand}` : ''}.\n${descAr}\nأهم المزايا:\n${feats.slice(0, 3).map(f => `- ${f}`).join('\n')}\n[صفحة ${nameAr}](/model.html?p=${slug}&lang=ar)\nتحب نجهّزلك عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`,
        'ar', 'sales_scenario'
      );
      add(
        `I need a solution for ${app}`,
        `For ${app}, we recommend the **${nameEn}**${brand ? ` by ${brand}` : ''}.\n${descEn}\nKey advantages:\n${feats.slice(0, 3).map(f => `- ${f}`).join('\n')}\n[${nameEn} page](/model.html?p=${slug}&lang=en)\nWant a quotation? Tap the "Talk to a person" button below.`,
        'en', 'sales_scenario'
      );
    }
  }

  /* ──────────────────── 5) اعتراضات عملاء */
  if (nameAr && feats.length >= 2) {
    add(
      `${nameAr} غالي أوي`,
      `فاهم إن الميزانية مهمة. بس ${nameAr} بيوفّر على المدى الطويل:\n${feats.slice(0, 3).map(f => `- ${f}`).join('\n')}\nوكمان عندنا خدمة ما بعد البيع وقطع غيار أصلية.\nتحب نعمللك عرض سعر تقارن بيه؟ اضغط زرّ «كلّم موظف» تحت.`,
      'ar', 'objection'
    );
    add(
      `${nameEn} is too expensive`,
      `I understand budget matters. But the ${nameEn} saves in the long run:\n${feats.slice(0, 3).map(f => `- ${f}`).join('\n')}\nPlus we provide after-sales service and genuine spare parts.\nWant a quotation to compare? Tap the "Talk to a person" button below.`,
      'en', 'objection'
    );
    add(
      `في بديل أرخص من ${nameAr}؟`,
      `${nameAr} مصمم للشغل الثقيل والاعتمادية العالية. الفرق في:\n${feats.slice(0, 2).map(f => `- ${f}`).join('\n')}\n- قطع غيار أصلية متوفرة + خدمة صيانة ميدانية\nتحب تاخد عرض سعر وتقارن؟ اضغط زرّ «كلّم موظف» تحت.`,
      'ar', 'objection'
    );
  }

  /* ──────────────────── 6) أسئلة صيانة */
  if (nameAr) {
    add(
      `${nameAr} محتاج صيانة`,
      `عندنا خدمة صيانة ميدانية لـ ${nameAr} بقطع غيار أصلية${brand ? ` من ${brand}` : ''}.\nممكن تقولي:\n- الموديل بالظبط\n- نوع المشكلة\n- المكان\nوفريق الصيانة هيتواصل معاك. اضغط زرّ «كلّم موظف» تحت.`,
      'ar', 'maintenance'
    );
    add(
      `عندكم قطع غيار لـ ${nameAr}؟`,
      `أيوه، عندنا قطع غيار أصلية${brand ? ` ${brand}` : ''} لـ ${nameAr}.\nفلاتر، أحزمة، زيوت، وكل القطع الاستهلاكية.\n[صفحة ${nameAr}](/model.html?p=${slug}&lang=ar)\nتحب تطلب قطعة معينة؟ اضغط زرّ «كلّم موظف» تحت.`,
      'ar', 'spare_parts'
    );
    add(
      `I need maintenance for the ${nameEn}`,
      `We provide field maintenance for the ${nameEn} with genuine${brand ? ` ${brand}` : ''} parts.\nCould you tell me:\n- The exact model\n- The issue\n- Your location\nOur service team will reach out. Tap the "Talk to a person" button below.`,
      'en', 'maintenance'
    );
  }

  /* ──────────────────── 9) طلبات عروض أسعار */
  if (nameAr) {
    const quoteQs = [
      `عايز عرض سعر لـ ${nameAr}`,
      `ابعتولي سعر ${nameAr}`,
      `بكام ${nameAr}؟`,
      `ممكن quotation لـ ${nameAr}؟`,
      `كام سعر ${nameAr}؟`,
    ];
    for (const q of quoteQs) {
      add(
        q,
        `الأسعار بتتحدد حسب المواصفات المطلوبة وبتطلع في عرض سعر رسمي من فريق المبيعات.\nعشان نجهّزلك عرض سعر دقيق لـ **${nameAr}**، محتاج أعرف:\n- الاستخدام (${apps.slice(0, 2).join('، ') || 'النوع'})\n- الكمية\n- المكان\naضغط زرّ «كلّم موظف» تحت وفريق المبيعات هيتواصل معاك.`,
        'ar', 'quote_request'
      );
    }
    add(
      `How much is the ${nameEn}?`,
      `Prices depend on the exact specification and come in a formal quotation from our sales team.\nTo prepare an accurate quote for the **${nameEn}**, I'd need:\n- Application (${apps.slice(0, 2).join(', ') || 'type of use'})\n- Quantity\n- Location\nTap the "Talk to a person" button below and our team will reach out.`,
      'en', 'quote_request'
    );
  }

  /* ──────────────────── 10) أسئلة التوصيل والضمان */
  if (nameAr) {
    add(
      `${nameAr} عليه ضمان؟`,
      `كل منتجات 5A&M عليها ضمان${brand ? ` ${brand}` : ''} الرسمي + خدمة ما بعد البيع.\nمدة الضمان والتفاصيل بتكون في عرض السعر.\nتحب نجهّزلك عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`,
      'ar', 'warranty'
    );
    add(
      `بتوصلوا لحد فين؟`,
      `5A&M بتوصّل لكل محافظات مصر — المعدات الثقيلة بالنقل المتخصص.\nالتوصيل والتركيب والتشغيل بتكون ضمن عرض السعر.\nتحب نجهّزلك عرض؟ اضغط زرّ «كلّم موظف» تحت.`,
      'ar', 'delivery'
    );
    add(
      `Does the ${nameEn} come with warranty?`,
      `All 5A&M products come with${brand ? ` ${brand}` : ''} official warranty + after-sales support.\nWarranty duration and details are included in the quotation.\nWant a quote? Tap the "Talk to a person" button below.`,
      'en', 'warranty'
    );
  }
}

/* ──────────────────── 3) مقارنات بين منتجين */
for (let i = 0; i < products.length; i++) {
  for (let j = i + 1; j < products.length; j++) {
    const a = products[i], b = products[j];
    if (a.brand_id !== b.brand_id && a.brand_id && b.brand_id) continue; // same brand comparisons only
    const na = a.name_ar || a.name_en, nb = b.name_ar || b.name_en;
    const ne = a.name_en || a.name_ar, nbe = b.name_en || b.name_ar;
    if (!na || !nb) continue;
    const da = typeof a.data === 'string' ? JSON.parse(a.data) : (a.data ?? {});
    const db2 = typeof b.data === 'string' ? JSON.parse(b.data) : (b.data ?? {});
    const fa = (da.features ?? []).slice(0, 2), fb = (db2.features ?? []).slice(0, 2);
    const aa = (da.applications ?? []).slice(0, 2), ab = (db2.applications ?? []).slice(0, 2);

    add(
      `ايه الفرق بين ${na} و ${nb}؟`,
      `**${na}:**\n${fa.map(f => `- ${f}`).join('\n') || '- ' + (a.description_ar || a.description_en || '')}\nمناسب لـ: ${aa.join('، ') || 'استخدامات متعددة'}\n\n**${nb}:**\n${fb.map(f => `- ${f}`).join('\n') || '- ' + (b.description_ar || b.description_en || '')}\nمناسب لـ: ${ab.join('، ') || 'استخدامات متعددة'}\n\nالاختيار بيعتمد على طبيعة الشغل. تحب نساعدك تختار؟ اضغط زرّ «كلّم موظف» تحت.`,
      'ar', 'comparison'
    );
    add(
      `What's the difference between ${ne} and ${nbe}?`,
      `**${ne}:**\n${fa.map(f => `- ${f}`).join('\n') || '- ' + (a.description_en || a.description_ar || '')}\nBest for: ${aa.join(', ') || 'various applications'}\n\n**${nbe}:**\n${fb.map(f => `- ${f}`).join('\n') || '- ' + (b.description_en || b.description_ar || '')}\nBest for: ${ab.join(', ') || 'various applications'}\n\nThe choice depends on your specific needs. Want help deciding? Tap the "Talk to a person" button below.`,
      'en', 'comparison'
    );
  }
}

/* ──────────────────── 7) أسئلة عامة عن الشركة */
const generalAr = [
  ['انتم بتعملوا ايه؟', `5A&M شركة مصرية متخصصة في:\n- **مولدات الديزل** (Perkins, Cummins, Hyundai, Volvo)\n- **معدات بيئية** (مكانس Elgin، شفاطات Guzzler، وحدات Vactor)\n- **قطع غيار أصلية** وخدمة ما بعد البيع\nتحب تعرف أكتر عن منتج معين؟`],
  ['فين مكانكم؟', `${co.hq?.ar || co.address || 'مصر'}\n${co.phone ? `رقمنا: ${co.phone}` : ''}\n[صفحة التواصل](/contact.html?lang=ar)`],
  ['مواعيد الشغل ايه؟', `تقدر تتواصل معانا في أي وقت من هنا أو من صفحة التواصل.\n${co.phone ? `رقمنا: ${co.phone}` : ''}\n[صفحة التواصل](/contact.html?lang=ar)`],
  ['انتم وكلاء مين؟', `5A&M وكيل حصري في مصر لـ:\n- **Federal Signal** (Elgin, Vactor, Guzzler)\n- محركات وقطع غيار أصلية من أكبر الماركات العالمية\nتحب تعرف أكتر؟`],
  ['عندكم خدمة ما بعد البيع؟', `أيوه، عندنا:\n- صيانة ميدانية بفنيين مدربين\n- قطع غيار أصلية\n- دعم فني\n- ضمان رسمي\nتحب تتواصل مع فريق الصيانة؟ اضغط زرّ «كلّم موظف» تحت.`],
  ['بتشتغلوا في ايه بالظبط؟', `5A&M متخصصة في حلول الطاقة والمعدات البيئية:\n- مولدات كهرباء ديزل لكل الأحجام\n- مكانس شوارع Elgin\n- شفاطات صناعية Guzzler\n- وحدات صرف Vactor\n- قطع غيار أصلية وصيانة\nإيه اللي تحتاجه بالظبط؟`],
  ['ليه أختاركم أنتم؟', `5A&M الاختيار الصح لأن:\n- وكيل حصري ← قطع غيار أصلية ومضمونة\n- خدمة ما بعد البيع ← صيانة ميدانية وفنيين مدربين\n- خبرة في السوق المصري\n- حلول متكاملة من التوريد للتركيب والتشغيل\nتحب نجهّزلك عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.`],
];
for (const [q, a] of generalAr) add(q, a, 'ar', 'general');

const generalEn = [
  ['What does 5A&M do?', `5A&M is an Egyptian company specializing in:\n- **Diesel generator sets** (Perkins, Cummins, Hyundai, Volvo)\n- **Environmental equipment** (Elgin sweepers, Guzzler vacuums, Vactor units)\n- **Genuine spare parts** and after-sales service\nWant to know more about a specific product?`],
  ['Where are you located?', `${co.hq?.en || co.address || 'Egypt'}\n${co.phone ? `Phone: ${co.phone}` : ''}\n[Contact page](/contact.html?lang=en)`],
  ['Are you an authorized dealer?', `5A&M is the exclusive dealer in Egypt for:\n- **Federal Signal** (Elgin, Vactor, Guzzler)\n- Genuine parts from top global brands\nWant to know more?`],
  ['Do you offer after-sales service?', `Yes, we provide:\n- Field maintenance with trained technicians\n- Genuine spare parts\n- Technical support\n- Official warranty\nWant to reach our service team? Tap the "Talk to a person" button below.`],
  ['Why should I choose 5A&M?', `5A&M is the right choice because:\n- Exclusive dealer → genuine, guaranteed parts\n- After-sales → field service and trained technicians\n- Experience in the Egyptian market\n- Turnkey solutions from supply to installation\nWant a quotation? Tap the "Talk to a person" button below.`],
];
for (const [q, a] of generalEn) add(q, a, 'en', 'general');

/* ──────────────────── 8) أسئلة متابعة (multi-turn) */
for (const p of products.slice(0, 10)) {
  const na = p.name_ar || p.name_en;
  const ne = p.name_en || p.name_ar;
  const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data ?? {});
  const specs = (data.specifications ?? []).filter(s => s?.k && s?.v);
  const feats = (data.features ?? []).filter(Boolean);

  if (specs.length >= 2 && na) {
    pairs.push({
      messages: [
        { role: 'system', content: sys('ar') },
        { role: 'user', content: `عايز ${na}` },
        { role: 'assistant', content: `اختيار ممتاز! ${na}${p.brand_name ? ` من ${p.brand_name}` : ''}.\nتحب أعرفك المواصفات ولا نجهّزلك عرض سعر على طول؟` },
        { role: 'user', content: 'المواصفات الأول' },
        { role: 'assistant', content: `المواصفات الأساسية لـ ${na}:\n${specs.slice(0, 6).map(s => `- ${s.k}: ${s.v}`).join('\n')}\n${feats.length ? `\nأهم المزايا:\n${feats.slice(0, 3).map(f => `- ${f}`).join('\n')}` : ''}\nتحب نجهّزلك عرض سعر؟ اضغط زرّ «كلّم موظف» تحت.` },
      ],
      metadata: { source: 'augmented', lang: 'ar', type: 'multi_turn' },
    });
  }

  if (specs.length >= 2 && ne) {
    pairs.push({
      messages: [
        { role: 'system', content: sys('en') },
        { role: 'user', content: `I'm interested in the ${ne}` },
        { role: 'assistant', content: `Great choice! The ${ne}${p.brand_name ? ` by ${p.brand_name}` : ''}.\nWould you like the full specs or shall we prepare a quotation right away?` },
        { role: 'user', content: 'Specs first please' },
        { role: 'assistant', content: `Key specifications of the ${ne}:\n${specs.slice(0, 6).map(s => `- ${s.k}: ${s.v}`).join('\n')}\n${feats.length ? `\nKey advantages:\n${feats.slice(0, 3).map(f => `- ${f}`).join('\n')}` : ''}\nWant a quotation? Tap the "Talk to a person" button below.` },
      ],
      metadata: { source: 'augmented', lang: 'en', type: 'multi_turn' },
    });
  }
}

/* ──────────────────── حفظ */
const outDir = 'training-data';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const augPath = path.join(outDir, 'augmented.jsonl');
fs.writeFileSync(augPath, pairs.map(p => JSON.stringify(p)).join('\n'), 'utf8');

/* إحصائيات */
const byType = {};
for (const p of pairs) {
  byType[p.metadata.type] = (byType[p.metadata.type] || 0) + 1;
}

log.ok(`تم توليد ${pairs.length} زوج تدريب إضافي`);
console.log('\nبالنوع:');
for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t}: ${c}`);
}
console.log(`\nالملف: ${augPath}`);

await db.end();
