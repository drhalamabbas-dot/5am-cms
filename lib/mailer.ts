/* =============================================================================
   إرسال البريد من بريد الشركة (SMTP) — مجاني مع استضافة هوستنجر.

   الإعدادات في ملف البيئة: SMTP_HOST (smtp.hostinger.com) وSMTP_PORT (465)
   وSMTP_USER وSMTP_PASS (بريد الشركة وكلمته) وSMTP_FROM (الاسم والبريد الظاهر).
   بلا إعداد: في التطوير يُطبع البريد في نافذة الموقع بدل إرساله، وفي الإنتاج
   يُرفض الإرسال برسالة واضحة.
============================================================================= */
import nodemailer, { type Transporter } from 'nodemailer';

export const mailReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null = null;

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<{ ok: boolean; dev?: boolean; error?: string }> {
  if (!mailReady()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[mail — تطوير، لم يُرسل] إلى ${to}\n${subject}\n${text}\n`);
      return { ok: true, dev: true };
    }
    return { ok: false, error: 'البريد غير مضبوط على الخادم (SMTP).' };
  }
  try {
    const port = Number(process.env.SMTP_PORT) || 465;
    transport ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    return { ok: true };
  } catch (e: any) {
    console.error('[mail] تعذّر الإرسال:', e?.message ?? e);
    return { ok: false, error: 'تعذّر إرسال البريد الآن.' };
  }
}
