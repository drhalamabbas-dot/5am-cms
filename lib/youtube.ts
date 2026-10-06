/* فيديو يوتيوب: يُكتب في الداش بورد رابطًا كما يُنسخ من المتصفح أو من زرّ
   «مشاركة»، والموقع يحتاج رمز الفيديو وحده (11 حرفًا) ليبني منه المشغّل والغلاف. */

const ID = /^[\w-]{11}$/;

/** رمز الفيديو من أيّ شكل لرابط يوتيوب، أو من الرمز نفسه. فارغ إن لم يُعرف. */
export function ytId(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (ID.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/')[1] ?? '';
      return ID.test(id) ? id : '';
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && ID.test(v)) return v;
      const m = /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname);
      if (m) return m[1];
    }
  } catch { /* ليس رابطًا */ }
  return '';
}

/** صورة الغلاف التي يوفّرها يوتيوب نفسه للفيديو. */
export const ytPoster = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
