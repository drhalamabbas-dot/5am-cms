'use client';
/* زر يفتح نافذة المحادثة (ChatWidget يستمع للحدث) — من صفحة حساب العميل */
export function OpenChat({ label }: { label: string }) {
  return <button type="button" className="btn btn--sm" onClick={() => window.dispatchEvent(new Event('5am-chat-open'))}>{label}</button>;
}
