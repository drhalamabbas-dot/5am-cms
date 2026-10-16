/* =============================================================================
   بيانات تدريب من قاعدة البيانات مباشرةً — بلا أيّ نداء لموديل.

   لماذا: المواصفات والمزايا والاستخدامات في القاعدة حقائق مؤكّدة كتبها صاحب
   الموقع. فالإجابة المبنيّة منها لا يمكن أن تكون مخترَعة — وهذا هو العيب
   الوحيد الذي نحاربه في موديلنا. وهي كذلك مجانية وبلا حدّ يومي، بخلاف
   التوليد عبر موديل خارجي.

   ما تعلّمه هذه الأزواج: الحقائق نفسها، وشكل الإجابة (ترشيح + سبب + رابط +
   خطوة تالية)، ومتى يُقال «مش موجود عندنا».

   وما لا تعلّمه: التنوّع الطبيعي في الصياغة — فهي قوالب. لذا تُخلط مع ما
   يكتبه الموديل المعلّم (lib/chat/trainer.ts) لا أن تحلّ محلّه.

   الصياغات متعدّدة لكل نوع كي لا يحفظ الموديل قالبًا واحدًا.
============================================================================= */
import crypto from 'node:crypto';
import { q } from '../db';
import { getProducts, getCompany } from '../content';

type Pair = { q: string; a: string; lang: 'ar' | 'en' };

/* ---------------------------------------------------------------- الترجمة
   المواصفات والمزايا مخزّنة بالإنجليزية، وترجمتها العربية في جدول translations
   (هي نفسها التي تظهر للزائر على صفحة المنتج). فالإجابة العربية تُبنى بها، لا
   بالإنجليزية — وإلا علّمنا الموديل أن يردّ على العربي بإنجليزي. */
const phraseKey = (en: string) => 'phrase:' + crypto.createHash('sha1').update(en).digest('hex');

let dict: { at: number; map: Map<string, string> } | null = null;

async function arabic(): Promise<Map<string, string>> {
  if (dict && Date.now() - dict.at < 5 * 60_000) return dict.map;
  const rows = await q<any>("SELECT `key`, ar FROM translations WHERE `group` = 'phrase' AND ar IS NOT NULL AND ar <> ''");
  dict = { at: Date.now(), map: new Map(rows.map((r) => [r.key, r.ar as string])) };
  return dict.map;
}

/** النصّ بالعربية إن وُجدت ترجمته، وإلا كما هو. */
function tr(map: Map<string, string>, en: unknown, lang: 'ar' | 'en'): string {
  const s = String(en ?? '').trim();
  if (lang === 'en' || !s) return s;
  return map.get(phraseKey(s)) ?? s;
}

/** هل تُرجمت أغلب هذه النصوص؟ فإن لم تُترجم لا يُبنى منها زوج عربي: إجابة
 *  عربية بمحتوى إنجليزي تعلّم الموديل أن يردّ بغير لغة السائل. */
function translated(map: Map<string, string>, items: unknown[], lang: 'ar' | 'en'): boolean {
  if (lang === 'en') return true;
  const texts = items.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (!texts.length) return false;
  const have = texts.filter((t) => map.has(phraseKey(t))).length;
  return have / texts.length >= 0.6;
}

/** يختار صياغة حسب رقم ثابت، فالناتج هو نفسه في كل تشغيل */
const pick = <T,>(list: T[], i: number): T => list[i % list.length];

const nameOf = (p: any, lang: 'ar' | 'en') =>
  (lang === 'ar' ? p.name_ar || p.name_en : p.name_en || p.name_ar) ?? p.ref;
const descOf = (p: any, lang: 'ar' | 'en') =>
  (lang === 'ar' ? p.description_ar || p.description_en : p.description_en || p.description_ar) ?? '';
const link = (p: any, lang: 'ar' | 'en') => `/model.html?p=${encodeURIComponent(p.slug)}&lang=${lang}`;

/* الخاتمة: نفس ما نريد أن يقوله البوت — خطوة تالية بلا سعر */
const CLOSE_AR = [
  'تحب نجهّزلك عرض سعر؟ اكتب «موظف» أو املأ طلب عرض السعر من الموقع.',
  'لو حابب التفاصيل كاملة أو عرض سعر، اكتب «موظف».',
  'عايز عرض سعر على المواصفات دي؟ اكتب «موظف» وفريق المبيعات هيتواصل معاك.',
];
const CLOSE_EN = [
  'Want a quotation? Type “agent” or use the quote request on the site.',
  'For full details or a quotation, type “agent”.',
];

export async function factPairs(): Promise<Pair[]> {
  const out: Pair[] = [];
  const AR = await arabic();
  const products = await getProducts();
  const published = products.filter((p: any) => p.published !== 0 && !(p.store_hidden && p.category === 'parts'));

  published.forEach((p: any, i: number) => {
    const d = (p as any).data ?? {};
    for (const lang of ['ar', 'en'] as const) {
      const n = nameOf(p, lang);
      if (!n) continue;
      const ar = lang === 'ar';
      const url = link(p, lang);
      const close = ar ? pick(CLOSE_AR, i) : pick(CLOSE_EN, i);
      const more = ar ? `[صفحة ${n}](${url})` : `[${n} page](${url})`;

      /* 1) ما هو هذا المنتج */
      const desc = descOf(p, lang);
      if (desc) {
        const qs = ar
          ? [`ايه هو ${n}؟`, `${n} ده ايه؟`, `احكيلي عن ${n}`]
          : [`What is the ${n}?`, `Tell me about the ${n}`];
        out.push({
          lang, q: pick(qs, i),
          a: [`${n}${p.brand_name ? ` — ${p.brand_name}` : ''}: ${desc}`, more, close].join('\n'),
        });
      }

      /* 2) المواصفات — جدول كامل من القاعدة */
      const specs: any[] = (d.specifications ?? []).filter((s: any) => s?.k && s?.v);
      if (specs.length >= 3 && translated(AR, specs.flatMap((s: any) => [s.k, s.v]), lang)) {
        const qs = ar
          ? [`ايه مواصفات ${n}؟`, `عايز المواصفات الفنية لـ ${n}`, `${n} مواصفاته ايه؟`]
          : [`What are the specifications of the ${n}?`, `Technical specs for the ${n}?`];
        out.push({
          lang, q: pick(qs, i),
          a: [
            ar ? `دي المواصفات الأساسية لـ ${n}:` : `Key specifications of the ${n}:`,
            ...specs.slice(0, 10).map((s: any) => `- ${tr(AR, s.k, lang)}: ${tr(AR, s.v, lang)}`),
            more, close,
          ].join('\n'),
        });
      }

      /* 3) المزايا */
      const feats: string[] = (d.features ?? []).filter(Boolean);
      if (feats.length >= 2 && translated(AR, feats, lang)) {
        const qs = ar
          ? [`ايه مزايا ${n}؟`, `ليه اختار ${n}؟`, `${n} مميز بإيه؟`]
          : [`What are the advantages of the ${n}?`, `Why choose the ${n}?`];
        out.push({
          lang, q: pick(qs, i),
          a: [
            ar ? `أهم اللي يميّز ${n}:` : `What sets the ${n} apart:`,
            ...feats.slice(0, 6).map((f) => `- ${tr(AR, f, lang)}`),
            more, close,
          ].join('\n'),
        });
      }

      /* 4) الاستخدامات */
      const apps: string[] = (d.applications ?? []).filter(Boolean);
      if (apps.length >= 2 && translated(AR, apps, lang)) {
        const qs = ar
          ? [`${n} بيستخدم في ايه؟`, `${n} يناسب ايه؟`, `امتى اختار ${n}؟`]
          : [`What is the ${n} used for?`, `When should I choose the ${n}?`];
        out.push({
          lang, q: pick(qs, i),
          a: [
            ar ? `${n} مناسب لـ:` : `The ${n} fits:`,
            ...apps.slice(0, 6).map((x) => `- ${tr(AR, x, lang)}`),
            more, close,
          ].join('\n'),
        });
      }

      /* 5) الكتالوجات */
      const dls: any[] = (d.downloads ?? []).filter((x: any) => x?.href && x?.label);
      if (dls.length) {
        const qs = ar
          ? [`عندكم كتالوج لـ ${n}؟`, `ممكن بروشور ${n}؟`]
          : [`Do you have a brochure for the ${n}?`, `Is there a datasheet for the ${n}?`];
        out.push({
          lang, q: pick(qs, i),
          a: [
            ar ? `أيوه، ملفات ${n} متاحة للتحميل:` : `Yes, files for the ${n}:`,
            ...dls.map((x: any) => `- [${tr(AR, x.label, lang)}](/${String(x.href).replace(/^\//, '')})`),
            more,
          ].join('\n'),
        });
      }
    }
  });

  /* 6) ماذا لديكم من ماركة كذا */
  const byBrand = new Map<string, any[]>();
  for (const p of published) {
    const b = (p as any).brand_name;
    if (b) byBrand.set(b, [...(byBrand.get(b) ?? []), p]);
  }
  [...byBrand.entries()].forEach(([brand, list], i) => {
    for (const lang of ['ar', 'en'] as const) {
      const ar = lang === 'ar';
      out.push({
        lang,
        q: ar ? pick([`عندكم ايه من ${brand}؟`, `ايه موديلات ${brand} المتاحة؟`], i) : `What ${brand} models do you have?`,
        a: [
          ar ? `من ${brand} عندنا:` : `Our ${brand} range:`,
          ...list.slice(0, 8).map((p: any) => `- [${nameOf(p, lang)}](${link(p, lang)})`),
          ar ? pick(CLOSE_AR, i) : pick(CLOSE_EN, i),
        ].join('\n'),
      });
    }
  });

  /* 7) التواصل — من بيانات الشركة نفسها */
  const c: any = await getCompany();
  if (c?.phone) {
    out.push({ lang: 'ar', q: 'ايه رقم التليفون؟', a: `رقمنا: ${c.phone}${c.email ? `\nوالبريد: ${c.email}` : ''}\n[صفحة التواصل](/contact.html?lang=ar)` });
    out.push({ lang: 'en', q: 'What is your phone number?', a: `Our number: ${c.phone}${c.email ? `\nEmail: ${c.email}` : ''}\n[Contact page](/contact.html?lang=en)` });
  }
  if (c?.hq?.ar || c?.address) {
    out.push({ lang: 'ar', q: 'فين مكانكم؟', a: `${c.hq?.ar || c.address}\n[صفحة التواصل](/contact.html?lang=ar)` });
  }

  /* 8) صفحات الموقع */
  const pages = await q<any>(
    `SELECT slug, crumb_ar, crumb_en, description_ar, description_en FROM pages
      WHERE published = 1 AND redirect_to IS NULL AND template NOT IN ('product') ORDER BY position`
  );
  pages.forEach((pg: any, i: number) => {
    for (const lang of ['ar', 'en'] as const) {
      const ar = lang === 'ar';
      const title = (ar ? pg.crumb_ar || pg.crumb_en : pg.crumb_en || pg.crumb_ar) ?? pg.slug;
      /* بلا احتياط للغة الأخرى: وصف إنجليزي تحت سؤال عربي يعلّم الموديل أن
         يردّ بغير لغة السائل — وهو ما نحاربه. الصفحة بلا وصف بلغتها تُتخطّى. */
      const body = String((ar ? pg.description_ar : pg.description_en) ?? '').trim();
      if (!title || !body) continue;
      const url = `/${pg.slug === 'index' ? '' : `${pg.slug}.html`}?lang=${lang}`;
      out.push({
        lang,
        q: ar ? pick([`ايه ${title} عندكم؟`, `احكيلي عن ${title}`, `عايز اعرف عن ${title}`], i) : `Tell me about your ${title}`,
        a: [body, ar ? `[${title}](${url})` : `[${title}](${url})`, ar ? pick(CLOSE_AR, i) : pick(CLOSE_EN, i)].join('\n'),
      });
    }
  });

  return out;
}
