'use client';
/* اختيار قالب الصفحة بالمعاينة: كل بطاقة ترسم الصفحة كاملة — هيدر وأقسامًا
   وفوترًا — كما ستبدو بعد الإنشاء. */
import { useState } from 'react';
import { TEMPLATES } from '@/lib/pageTemplates';
import { PageShape } from './SectionShapes';

export function TemplatePicker() {
  const [picked, setPicked] = useState(TEMPLATES[0].id);
  return (
    <>
      <input type="hidden" name="template" value={picked} />
      <div className="tpl">
        {TEMPLATES.map((t) => (
          <button type="button" key={t.id}
                  className={`tpl__card ${picked === t.id ? 'is-on' : ''}`}
                  aria-pressed={picked === t.id}
                  onClick={() => setPicked(t.id)}>
            <span className="tpl__prev"><PageShape sections={t.sections} /></span>
            <b>{t.label}</b>
            <small>{t.hint}</small>
            <small className="tpl__count">
              {t.sections.length ? `${t.sections.length} أقسام جاهزة` : 'بلا أقسام'}
            </small>
          </button>
        ))}
      </div>
    </>
  );
}
