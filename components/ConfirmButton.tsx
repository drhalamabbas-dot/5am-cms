'use client';
/* زرّ إرسال يسأل قبل أن ينفّذ. للحذف وما يشبهه: ضغطة بالخطأ لا تمحو شيئًا. */
import type { ReactNode } from 'react';

export function ConfirmButton({
  message, children, className, title, name, value,
}: { message: string; children: ReactNode; className?: string; title?: string; name?: string; value?: string }) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      name={name}
      value={value}
      onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
    >
      {children}
    </button>
  );
}
