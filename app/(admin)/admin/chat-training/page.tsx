/* تدريب البوت:
   • الإعدادات (للسوبر أدمن): تشغيل المحادثة، ومصدر الردود — Qwen أو موديلنا أو
     بلا بوت — وموديل Qwen المجاني، ورسالة الترحيب.
   • الأرقام: كم ردًّا جاء من الذاكرة (بلا استهلاك) ومن Qwen ومن موديلنا.
   • المراجعة: كل سؤال أجاب عنه Qwen يُحفظ «جديد»؛ الموظف يقبله أو يصحّحه أو
     يرفضه. المقبول يُعاد استعماله لأسئلة مشابهة، وهو بيانات تدريب موديلنا على
     Colab (زر «بيانات التدريب»). */
import { redirect } from 'next/navigation';
import { requirePerm, requireSuper } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ConfirmButton } from '@/components/ConfirmButton';
import { isSuper } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { clip } from '@/lib/requests';
import { refreshSite } from '@/lib/admin';
import { getChatSettings, providerReady, freeQwenModels, freeModels, modelErrors, DEFAULT_MODEL, DEFAULT_BACKUP, DEFAULT_DEEPSEEK } from '@/lib/chat/provider';
import { TrainGenerator } from '@/components/admin/TrainGenerator';
import { normalize } from '@/lib/chat/text';
import { forgetDocs } from '@/lib/chat/kb';
import { recheckAll, ISSUE_AR } from '@/lib/chat/quality';
import { describeSecret, setSecret, checkOpenRouterKey, checkDeepSeekKey, getSecret } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

type SP = { s?: string; q?: string; ok?: string; e?: string; f?: string };
const SRC: Record<string, string> = { qwen: 'Qwen', own: 'موديلنا', deepseek: 'DeepSeek', backup: 'الموديل الاحتياطي', staff: 'الفريق', claude: 'Claude (من محتوى الموقع)', cache: 'الذاكرة', kb: 'من الموقع بلا موديل' };

export default async function ChatTraining({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePerm('chat.train');
  const sp = await searchParams;
  const status = ['new', 'approved', 'rejected'].includes(sp.s ?? '') ? sp.s! : 'new';
  /* f=issues: فيها ملاحظات الفحص التلقائي · f=clean: سليمة */
  const fIssues = sp.f === 'issues' ? ' AND issues IS NOT NULL' : sp.f === 'clean' ? ' AND issues IS NULL' : '';
  const term = (sp.q ?? '').trim();
  const s = await getChatSettings();
  const ready = await providerReady(s);
  const [orKey, ownKey, dsKey] = isSuper(me) ? await Promise.all([describeSecret('openrouter'), describeSecret('own_model'), describeSecret('deepseek')]) : [null, null, null];
  /* رصيد DeepSeek وموديلاته من حسابه نفسه (لو مفتاحه موجود) */
  const dsInfo = isSuper(me) && dsKey?.from !== 'none' ? await checkDeepSeekKey((await getSecret('deepseek'))!) : null;
  const [rows, counts, issuesRows, usage, models, allFree] = await Promise.all([
    q<any>(`SELECT * FROM chat_cache WHERE status = ?${fIssues} ${term ? 'AND (question LIKE ? OR answer LIKE ?)' : ''} ORDER BY (issues IS NOT NULL) DESC, hits DESC, id DESC LIMIT 100`,
      term ? [status, `%${term}%`, `%${term}%`] : [status]),
    q<any>('SELECT status, COUNT(*) n FROM chat_cache GROUP BY status'),
    q<any>("SELECT COUNT(*) n FROM chat_cache WHERE status = ? AND issues IS NOT NULL", [status]),
    q<any>(`SELECT COALESCE(source, 'fixed') source, COUNT(*) n FROM chat_messages WHERE role = 'bot' AND created_at >= NOW() - INTERVAL 7 DAY GROUP BY source`),
    isSuper(me) ? freeQwenModels() : Promise.resolve([]),
    isSuper(me) ? freeModels() : Promise.resolve([] as string[]),
  ]);
  const n = Object.fromEntries(counts.map((r) => [r.status, r.n]));
  const issuesN = Number(issuesRows[0]?.n ?? 0);
  const u = Object.fromEntries(usage.map((r) => [r.source, Number(r.n)]));
  const answered = (u.cache ?? 0) + (u.qwen ?? 0) + (u.own ?? 0);

  async function saveSettings(form: FormData) {
    'use server';
    const who = await requireSuper();
    const before = await getChatSettings();
    const provider = ['qwen', 'own', 'deepseek', 'off'].includes(String(form.get('provider'))) ? String(form.get('provider')) : 'qwen';
    const ownUrl = clip(form.get('ownUrl'), 300) ?? '';
    const next = {
      enabled: form.get('enabled') === '1',
      provider,
      model: (clip(form.get('model'), 120) ?? '').replace(/[^\w./:-]/g, ''),
      ownUrl: /^https?:\/\/[^\s]+$/.test(ownUrl) ? ownUrl : '',
      ownModel: (clip(form.get('ownModel'), 120) ?? '').replace(/[^\w./:-]/g, ''),
      backupModel: (clip(form.get('backupModel'), 120) ?? '').replace(/[^\w./:-]/g, ''),
      deepseekModel: (clip(form.get('deepseekModel'), 80) ?? '').replace(/[^\w./:-]/g, ''),
      greeting: { ar: clip(form.get('greet_ar'), 400) ?? before.greeting.ar, en: clip(form.get('greet_en'), 400) ?? before.greeting.en },
    };
    await q(`INSERT INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('chat', ?, 'chat', 'Chat', 'المحادثة')
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [JSON.stringify(next)]);
    await audit(who, 'chat.settings', { entity: 'setting', id: 'chat', summary: `${next.enabled ? 'مفعّلة' : 'متوقفة'} · المصدر: ${provider}`, before, after: next });
    refreshSite();
    redirect('/admin/chat-training?ok=settings');
  }

  async function review(form: FormData) {
    'use server';
    const who = await requirePerm('chat.train');
    const id = Number(form.get('id'));
    const to = String(form.get('to'));
    const back = String(form.get('back') || '/admin/chat-training');
    if (to === 'delete') await q('DELETE FROM chat_cache WHERE id = ?', [id]);
    else if (to === 'approve' || to === 'reject') {
      const answer = clip(form.get('answer'), 3000);
      const question = clip(form.get('question'), 1000);
      const st = to === 'reject' ? 'rejected' : 'approved';
      await q(`UPDATE chat_cache SET status = ?, reviewed_by = ?${answer ? ', answer = ?' : ''}${question ? ', question = ?, q_norm = ?' : ''} WHERE id = ?`,
        [st, who.id, ...(answer ? [answer] : []), ...(question ? [question, normalize(question)] : []), id]);
    }
    await audit(who, 'chat.review', { entity: 'chat_cache', id, summary: to });
    redirect(back);
  }

  async function addPair(form: FormData) {
    'use server';
    const who = await requirePerm('chat.train');
    const question = clip(form.get('question'), 1000);
    const answer = clip(form.get('answer'), 3000);
    const lang = form.get('lang') === 'en' ? 'en' : 'ar';
    if (!question || !answer) redirect('/admin/chat-training?s=approved');
    await q("INSERT INTO chat_cache (lang, question, q_norm, answer, source, status, reviewed_by) VALUES (?,?,?,?, 'staff', 'approved', ?)",
      [lang, question, normalize(question), answer, who.id]);
    await audit(who, 'chat.review', { entity: 'chat_cache', summary: `إضافة: ${question.slice(0, 80)}` });
    redirect('/admin/chat-training?s=approved&ok=added');
  }

  /* مفتاح جديد (لما القديم ينتهي أو يتسرّب): يُجرَّب مع OpenRouter قبل حفظه، ولا يُكتب في السجل */
  async function saveKey(form: FormData) {
    'use server';
    const who = await requireSuper();
    const which = form.get('which') === 'own_model' ? 'own_model' : form.get('which') === 'deepseek' ? 'deepseek' : 'openrouter';
    if (form.get('remove')) {
      await setSecret(which, null, who.name ?? who.email);
      await audit(who, 'chat.key', { entity: 'setting', id: which, summary: 'شال المفتاح المحفوظ في اللوحة' });
      redirect('/admin/chat-training?ok=keyoff');
    }
    const v = String(form.get('key') ?? '').trim();
    if (!v || v.length > 300 || /\s/.test(v)) redirect('/admin/chat-training?e=nokey');
    if (which === 'openrouter' && !(await checkOpenRouterKey(v)).ok) redirect('/admin/chat-training?e=badkey');
    if (which === 'deepseek' && !(await checkDeepSeekKey(v)).ok) redirect('/admin/chat-training?e=badkey');
    await setSecret(which, v, who.name ?? who.email);
    await audit(who, 'chat.key', { entity: 'setting', id: which, summary: `مفتاح جديد ينتهي بـ …${v.slice(-4)}` });
    redirect('/admin/chat-training?ok=key');
  }

  async function checkAll() {
    'use server';
    await requirePerm('chat.train');
    const r = await recheckAll();
    redirect(`/admin/chat-training?ok=checked&n=${r.checked}&bad=${r.flagged}`);
  }

  async function reindex() {
    'use server';
    await requirePerm('chat.train');
    forgetDocs();
    redirect('/admin/chat-training?ok=reindex');
  }

  const back = `/admin/chat-training?${new URLSearchParams({ s: status, ...(term ? { q: term } : {}) })}`;
  const modelOptions = [...new Set([s.model || DEFAULT_MODEL, ...models.map((m) => m.id)])];

  return (
    <Shell user={me} here="/admin/chat-training" title="تدريب البوت" trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'المحادثات', href: '/admin/chats' }]}
           sub="راجع ردود البوت: المقبول يُعاد استعماله بلا استهلاك Qwen، وهو بيانات تدريب موديلنا."
           actions={<>
             <a className="btn btn--ghost" href="/api/admin/chat-training/export">بيانات التدريب (JSONL)</a>
             <a className="btn btn--ghost" href="/api/admin/chat-training/notebook">دفتر Colab</a>
           </>}>
      {sp.ok === 'key' ? <p className="msg msg--ok">حُفظ المفتاح الجديد مشفّرًا، والبوت يستعمله من الرسالة الجاية. كل اللي اتعلّمه البوت باقٍ.</p> : null}
      {sp.ok === 'keyoff' ? <p className="msg msg--ok">اتشال المفتاح المحفوظ في اللوحة.</p> : null}
      {sp.e ? <p className="msg msg--bad">{sp.e === 'badkey' ? 'الخدمة رفضت المفتاح ده — اتأكد إنك نسخته كامل ومن الموقع الصح.' : 'اكتب المفتاح.'}</p> : null}
      {sp.ok === 'settings' ? <p className="msg msg--ok">حُفظت إعدادات المحادثة — تسري على الموقع فورًا.</p> : null}
      {sp.ok === 'added' ? <p className="msg msg--ok">أُضيف السؤال وجوابه.</p> : null}
      {sp.ok === 'checked' ? <p className="msg msg--ok">اتفحص {(sp as any).n} إجابة — {(sp as any).bad} فيها ملاحظات (ظاهرة فوق كل واحدة).</p> : null}
      {sp.ok === 'reindex' ? <p className="msg msg--ok">سيقرأ البوت محتوى الموقع من جديد مع السؤال القادم.</p> : null}

      <div className="grid grid--4" style={{ marginBottom: 20 }}>
        <div className="stat"><b>{answered}</b><span>ردّ في 7 أيام</span></div>
        <div className="stat"><b>{answered ? Math.round(((u.cache ?? 0) / answered) * 100) : 0}%</b><span>من الذاكرة — بلا استهلاك</span></div>
        <div className="stat"><b>{u.qwen ?? 0}</b><span>من Qwen</span></div>
        <div className="stat"><b>{u.own ?? 0}</b><span>من موديلنا</span></div>
      </div>

      {isSuper(me) ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head">
            <h2>إعدادات المحادثة</h2>
            <span className={`tag ${!s.enabled ? 'tag--off' : ready.ok ? 'tag--on' : 'tag--todo'}`}>{!s.enabled ? 'متوقفة' : ready.ok ? 'تعمل' : 'تعمل بلا موديل'}</span>
          </div>
          <div className="panel__body">
            {s.enabled && !ready.ok ? <p className="msg msg--bad">{ready.why} البوت يردّ الآن من صفحات الموقع مباشرةً ويعرض التحويل لموظف.</p> : null}
            <form action={saveSettings}>
              <div className="row">
                <div className="field">
                  <label htmlFor="enabled">المحادثة على الموقع</label>
                  <select id="enabled" name="enabled" defaultValue={s.enabled ? '1' : '0'}>
                    <option value="1">مفعّلة — زر المحادثة في كل الصفحات</option>
                    <option value="0">متوقفة — يختفي الزر</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="provider">مصدر الردود</label>
                  <select id="provider" name="provider" defaultValue={s.provider}>
                    <option value="qwen">Qwen (مجاني عبر OpenRouter)</option>
                    <option value="deepseek">DeepSeek (بمفتاحه — 5 مليون token مجانًا للحساب الجديد)</option>
                    <option value="own">موديلنا (اللي اتدرّب على Colab)</option>
                    <option value="off">بلا بوت — الرسائل للفريق مباشرةً</option>
                  </select>
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label htmlFor="model">موديل Qwen</label>
                  <select id="model" name="model" defaultValue={s.model || DEFAULT_MODEL}>
                    {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <p className="field__hint">{models.length ? `${models.length} موديل Qwen مجاني متاح الآن على OpenRouter.` : 'تعذّر جلب القائمة الآن — يبقى الموديل المحفوظ.'}</p>
                </div>
                <div className="field">
                  <label htmlFor="ownUrl">رابط موديلنا</label>
                  <input id="ownUrl" name="ownUrl" type="url" dir="ltr" defaultValue={s.ownUrl} placeholder="https://<اسمك>-5am-model.hf.space" />
                  <input name="ownModel" type="text" dir="ltr" defaultValue={s.ownModel} placeholder="اسم الموديل (اختياري)" style={{ marginTop: 6 }} aria-label="اسم موديلنا" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="deepseekModel">موديل DeepSeek</label>
                <select id="deepseekModel" name="deepseekModel" defaultValue={s.deepseekModel || DEFAULT_DEEPSEEK}>
                  {[...new Set([s.deepseekModel || DEFAULT_DEEPSEEK, ...(dsInfo?.models ?? [])])].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <p className="field__hint">{dsInfo?.ok ? `رصيد DeepSeek: ${dsInfo.balance ?? '—'}` : 'ضع مفتاح DeepSeek من «المفاتيح» تحت لتظهر موديلاته ورصيده.'} لو رصيده خلص، Qwen المجاني يرد بداله تلقائيًا.</p>
              </div>
              <div className="field">
                <label htmlFor="backupModel">الموديل الاحتياطي (لما Qwen المجاني يكون مشغول)</label>
                <select id="backupModel" name="backupModel" defaultValue={s.backupModel || DEFAULT_BACKUP}>
                  <option value="none">بلا احتياطي — يرد من صفحات الموقع</option>
                  {[...new Set([s.backupModel || DEFAULT_BACKUP, ...allFree])].filter((m) => m && m !== 'none').map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <p className="field__hint">ردود الاحتياطي تمرّ بنفس فلتر الأسعار والأرقام، فلو اخترع سعرًا أو رقمًا لا يصل للعميل.</p>
              </div>
              <div className="row">
                <div className="field"><label htmlFor="greet_ar">رسالة الترحيب (عربي)</label><textarea id="greet_ar" name="greet_ar" defaultValue={s.greeting.ar} /></div>
                <div className="field"><label htmlFor="greet_en">رسالة الترحيب (إنجليزي)</label><textarea id="greet_en" name="greet_en" dir="ltr" defaultValue={s.greeting.en} /></div>
              </div>
              <button className="btn" type="submit">احفظ</button>
              <p className="field__hint">
                لما يجهز موديلنا ويتجرّب، غيّر «مصدر الردود» إليه؛ ولو ضعف ردّه رجّع Qwen بنفس السهولة.
              </p>
            </form>
          </div>
        </div>
      ) : null}

      {isSuper(me) && orKey && ownKey && dsKey ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>المفاتيح</h2></div>
          <div className="panel__body">
            {([['openrouter', 'مفتاح OpenRouter (Qwen)', orKey, 'sk-or-v1-…'], ['deepseek', 'مفتاح DeepSeek (platform.deepseek.com ← API keys)', dsKey, 'sk-…'], ['own_model', 'مفتاح موديلنا (LLAMA_API_KEY على Hugging Face)', ownKey, '']] as const).map(([which, label, d, ph]) => (
              <form key={which} action={saveKey} className="keyrow">
                <input type="hidden" name="which" value={which} />
                <div className="keyrow__info">
                  <b>{label}</b>
                  <small>
                    {d.from === 'none' ? 'غير موجود'
                      : `الحالي ينتهي بـ …${d.last4} · ${d.from === 'panel' ? `من اللوحة${d.by ? ` (${d.by}` : ''}${d.at ? `${d.by ? '، ' : ' ('}${new Date(d.at).toLocaleDateString('en-GB')})` : d.by ? ')' : ''}` : 'من ملف الإعدادات'}`}
                  </small>
                </div>
                <input name="key" type="password" dir="ltr" autoComplete="off" placeholder={d.from === 'none' ? `الصق المفتاح ${ph}` : 'الصق المفتاح الجديد'} aria-label={label} />
                <button className="btn btn--sm" type="submit">احفظ</button>
                {d.from === 'panel' ? <button className="btn btn--sm btn--ghost" type="submit" name="remove" value="1" formNoValidate>شيل المحفوظ</button> : null}
              </form>
            ))}
            <p className="field__hint">
              المفتاح يُحفظ مشفّرًا ولا يظهر كاملًا لأي حد بعد كده، ومفتاح OpenRouter يُجرَّب قبل الحفظ. تغيير المفتاح لا يمسح شيئًا مما تعلّمه البوت:
              الردود المحفوظة والمقبولة في قاعدة بيانات الموقع. مفتاح OpenRouter الحالي ينتهي في التاريخ المكتوب على صفحة Keys عندهم — اعمل واحدًا جديدًا قبله والصقه هنا.
            </p>
          </div>
        </div>
      ) : null}

      {isSuper(me) && modelErrors().length ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>آخر مرات الموديل ما ردّش</h2><small>منذ آخر تشغيل للموقع</small></div>
          <table>
            <tbody>
              {modelErrors().map((e, i) => (
                <tr key={i}><td><small dir="ltr">{new Date(e.at).toLocaleString('en-GB')}</small></td><td><small dir="ltr">{e.model}</small></td><td><small dir="ltr">{e.error}</small></td></tr>
              ))}
            </tbody>
          </table>
          <div className="panel__body"><p className="field__hint" style={{ margin: 0 }}>
            «429 / rate-limited» = الموديل المجاني مزدحم أو الحد اليومي خلص (50 رسالة يوميًا للحساب المجاني؛ ~1000 بعد شحن 10 دولار مرة واحدة). البوت وقتها يجرّب الاحتياطي ثم صفحات الموقع، فالعميل لا يقف.
          </p></div>
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head"><h2>تدريب موديلنا: بيانات من Qwen</h2></div>
        <div className="panel__body">
          <TrainGenerator />
          <p className="field__hint">
            الخطوات: ١) ولّد أسئلة (Qwen يجاوب من محتوى الموقع) ← ٢) راجعها تحت واقبل الصح وصحّح الغلط ← ٣) لما توصل حوالي 300 مقبولة:
            «بيانات التدريب (JSONL)» + «دفتر Colab» فوق، وشغّل الدفتر على Colab ← ٤) حط رابط الموديل في «رابط موديلنا» وغيّر «مصدر الردود».
            مقبولة الآن: <b>{n.approved ?? 0}</b>.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['new', 'approved', 'rejected'] as const).map((k) => (
            <a key={k} className={`btn btn--sm ${status === k ? '' : 'btn--ghost'}`} href={`/admin/chat-training?s=${k}`}>
              {{ new: 'للمراجعة', approved: 'مقبولة', rejected: 'مرفوضة' }[k]} ({n[k] ?? 0})
            </a>
          ))}
          <span style={{ flex: 1 }} />
          <form method="get" style={{ display: 'flex', gap: 6 }}>
            <input type="hidden" name="s" value={status} />
            <input type="search" name="q" defaultValue={term} placeholder="ابحث في الأسئلة والردود…" aria-label="ابحث" style={{ width: 220 }} />
            <button className="btn btn--sm btn--ghost" type="submit">ابحث</button>
          </form>
          <a className={`btn btn--sm ${sp.f === 'issues' ? '' : 'btn--ghost'}`} href={`/admin/chat-training?s=${status}${sp.f === 'issues' ? '' : '&f=issues'}`}>فيها ملاحظات ({issuesN})</a>
          <form action={checkAll}><button className="btn btn--sm btn--ghost" type="submit" title="يعيد الفحص التلقائي لكل الإجابات">افحص الكل</button></form>
          <form action={reindex}><button className="btn btn--sm btn--ghost" type="submit" title="بعد تعديل كبير في الموقع">اقرأ الموقع من جديد</button></form>
        </div>
      </div>

      {rows.map((r) => (
        <form key={r.id} action={review} className="panel qa" style={{ marginBottom: 12 }}>
          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
          <div className="panel__body">
            <div className="qa__meta">
              <small>{SRC[r.source] ?? r.source} · {r.lang === 'en' ? 'إنجليزي' : 'عربي'} · استُعمل {r.hits} مرة · {when(r.created_at)}</small>
              {r.issues ? <span className="qa__issues">{String(r.issues).split(',').map((k: string) => <span key={k} className="tag tag--off">⚠ {ISSUE_AR[k] ?? k}</span>)}</span>
                : <span className="tag tag--on">✓ سليم في الفحص التلقائي</span>}
            </div>
            <label>السؤال<input name="question" type="text" defaultValue={r.question} dir={r.lang === 'en' ? 'ltr' : 'rtl'} /></label>
            <label>الرد<textarea name="answer" defaultValue={r.answer} dir={r.lang === 'en' ? 'ltr' : 'rtl'} rows={4} /></label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn--sm" name="to" value="approve" type="submit">{status === 'approved' ? 'احفظ التعديل' : 'اقبل (بعد تعديلك)'}</button>
              {status !== 'rejected' ? <button className="btn btn--sm btn--ghost" name="to" value="reject" type="submit">ارفض — رد غلط</button> : null}
              <ConfirmButton className="btn btn--sm btn--ghost" name="to" value="delete" message="حذف السؤال وجوابه نهائيًا؟">احذف</ConfirmButton>
            </div>
          </div>
        </form>
      ))}
      {!rows.length ? <div className="panel" style={{ marginBottom: 16 }}><div className="panel__body"><p style={{ margin: 0 }}>لا شيء هنا{term ? ' بهذا البحث' : ''}.</p></div></div> : null}

      <div className="panel">
        <div className="panel__head"><h2>أضف سؤالًا وجوابه بنفسك</h2></div>
        <div className="panel__body">
          <form action={addPair}>
            <div className="row">
              <div className="field"><label htmlFor="nq">السؤال كما يكتبه العميل</label><input id="nq" name="question" type="text" required placeholder="بتعملوا صيانة للمولدات؟" /></div>
              <div className="field"><label htmlFor="nlang">اللغة</label><select id="nlang" name="lang"><option value="ar">عربي</option><option value="en">إنجليزي</option></select></div>
            </div>
            <div className="field"><label htmlFor="na">الجواب الصحيح</label><textarea id="na" name="answer" required /></div>
            <button className="btn btn--sm" type="submit">أضف</button>
            <p className="field__hint">يُستعمل فورًا للأسئلة المشابهة، ويدخل بيانات تدريب موديلنا.</p>
          </form>
        </div>
      </div>
    </Shell>
  );
}
