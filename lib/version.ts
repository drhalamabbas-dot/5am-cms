/* رقم يُضاف إلى روابط الملفات الثابتة كي يحصل الزائر على آخر نسخة بعد كل نشر،
   بدل أن يظل متصفحه عارضًا نسخة قديمة من التصميم.

   الملفات تُخزَّن في المتصفح عامًا كاملًا (next.config.ts)، فرقم ثابت كان يعني
   أن تعديل CSS أو JS لا يصل إلى من زار الموقع قبله. الرقم هنا بصمة محتوى
   ملفات التصميم والسكربت نفسها: يتغيّر وحده حين تتغيّر، ويبقى كما هو حين لا.

   للخادم وحده (يقرأ القرص) — لا يُستورد في مكوّن يعمل في المتصفح. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function fingerprint(): string {
  if (process.env.NEXT_PUBLIC_ASSET_V) return process.env.NEXT_PUBLIC_ASSET_V;
  try {
    const pub = path.join(process.cwd(), 'public');
    const h = crypto.createHash('sha1');
    for (const dir of ['assets/css', 'assets/js']) {
      for (const f of fs.readdirSync(path.join(pub, dir)).sort()) {
        h.update(f).update(fs.readFileSync(path.join(pub, dir, f)));
      }
    }
    h.update(fs.readFileSync(path.join(pub, 'admin.css')));
    return h.digest('hex').slice(0, 10);
  } catch {
    return '20261001';
  }
}

export const ASSET_V = fingerprint();
