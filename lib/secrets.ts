/* =============================================================================
   مفاتيح الخدمات الخارجية التي يغيّرها السوبر أدمن من اللوحة (مفتاح OpenRouter،
   ومفتاح موديلنا) بدل فتح ملف الإعدادات على الخادم.

   تُحفظ في القاعدة مشفّرة (AES-256-GCM بمفتاح مشتق من AUTH_SECRET)، فنسخة
   احتياطية من القاعدة وحدها لا تكشفها. ولا تُعرض كاملة أبدًا: آخر 4 أحرف فقط.
   المفتاح المحفوظ من اللوحة يتقدّم على الموجود في ملف الإعدادات.
============================================================================= */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { q, q1 } from './db';

export type SecretName = 'openrouter' | 'own_model' | 'deepseek';
const ENV: Record<SecretName, string> = { openrouter: 'OPENROUTER_API_KEY', own_model: 'OWN_MODEL_KEY', deepseek: 'DEEPSEEK_API_KEY' };

const key = () => createHash('sha256').update(`${process.env.AUTH_SECRET ?? ''}|5am-secrets`).digest();

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
function decrypt(box: string): string | null {
  try {
    const [iv, tag, enc] = box.split('.').map((s) => Buffer.from(s, 'base64'));
    const d = createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return null; }
}

type Stored = Partial<Record<SecretName, { box: string; last4: string; at: string; by: string | null }>>;
async function all(): Promise<Stored> {
  const r = await q1<any>("SELECT `value` FROM settings WHERE `key` = 'secrets'");
  if (!r) return {};
  return typeof r.value === 'string' ? JSON.parse(r.value) : r.value ?? {};
}

/** المفتاح الفعلي: من اللوحة أولًا، ثم من ملف الإعدادات */
export async function getSecret(name: SecretName): Promise<string | null> {
  const s = (await all())[name];
  const v = s ? decrypt(s.box) : null;
  return v || process.env[ENV[name]]?.trim() || null;
}

/** للعرض في اللوحة فقط: من أين، وآخر 4 أحرف، ومتى ومن غيّره */
export async function describeSecret(name: SecretName): Promise<{ from: 'panel' | 'env' | 'none'; last4: string; at?: string; by?: string | null }> {
  const s = (await all())[name];
  if (s && decrypt(s.box)) return { from: 'panel', last4: s.last4, at: s.at, by: s.by };
  const env = process.env[ENV[name]]?.trim();
  return env ? { from: 'env', last4: env.slice(-4) } : { from: 'none', last4: '' };
}

export async function setSecret(name: SecretName, value: string | null, by: string | null) {
  const cur = await all();
  if (value) cur[name] = { box: encrypt(value), last4: value.slice(-4), at: new Date().toISOString(), by };
  else delete cur[name];
  await q(`INSERT INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('secrets', ?, 'secrets', 'API keys', 'مفاتيح الخدمات')
           ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [JSON.stringify(cur)]);
}

/** يسأل OpenRouter عن المفتاح نفسه: صالح؟ ومجاني؟ وكم استُهلك؟ */
export async function checkOpenRouterKey(k: string): Promise<{ ok: boolean; free?: boolean; usage?: number; limit?: number | null; error?: string }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10_000);
    const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${k}` }, signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok || !d?.data) return { ok: false, error: d?.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, free: Boolean(d.data.is_free_tier), usage: Number(d.data.usage) || 0, limit: d.data.limit ?? null };
  } catch { return { ok: false, error: 'تعذّر الوصول إلى OpenRouter' }; }
}

/** يسأل DeepSeek عن المفتاح: صالح؟ والرصيد (المجاني الممنوح والمشحون)؟ والموديلات المتاحة */
export async function checkDeepSeekKey(k: string): Promise<{ ok: boolean; balance?: string; models?: string[]; error?: string }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10_000);
    const H = { Authorization: `Bearer ${k}` };
    const [b, m] = await Promise.all([
      fetch('https://api.deepseek.com/user/balance', { headers: H, signal: ctl.signal, cache: 'no-store' }),
      fetch('https://api.deepseek.com/models', { headers: H, signal: ctl.signal, cache: 'no-store' }),
    ]);
    clearTimeout(t);
    const bd: any = await b.json().catch(() => ({}));
    const md: any = await m.json().catch(() => ({}));
    if (!b.ok && !m.ok) return { ok: false, error: bd?.error?.message ?? md?.error?.message ?? `HTTP ${b.status}` };
    const info = (bd?.balance_infos ?? [])[0];
    const balance = info ? `${info.total_balance} ${info.currency}${Number(info.granted_balance) ? ` (منها ${info.granted_balance} مجاني)` : ''}${bd.is_available === false ? ' — الرصيد لا يكفي' : ''}` : undefined;
    return { ok: true, balance, models: (md?.data ?? []).map((x: any) => String(x.id)) };
  } catch { return { ok: false, error: 'تعذّر الوصول إلى DeepSeek' }; }
}