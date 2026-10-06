'use client';
/* =============================================================================
   سويتشات الصلاحيات لموظف واحد، مجمّعة حسب القسم (lib/permissions.ts).

   «دور جاهز» يضبط السويتشات دفعة واحدة، ثم يُعدَّل أيّ سويتش وحده. القيمة تُرسل
   في حقل مخفي perms (JSON)، فالخادم يفحصها ويحفظها.
============================================================================= */
import { useState } from 'react';
import { PERMISSION_GROUPS, PRESETS, ALL_PERMISSIONS } from '@/lib/permissions';

export function PermSwitches({ initial, preset: initialPreset, disabled }: {
  initial: string[]; preset?: string | null; disabled?: boolean;
}) {
  const expand = (p: string[]) => (p.includes('*') ? [...ALL_PERMISSIONS] : p);
  const [on, setOn] = useState<string[]>(expand(initial));
  const [preset, setPreset] = useState(initialPreset ?? '');

  const toggle = (k: string) => { setPreset(''); setOn((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k])); };
  const group = (keys: string[], v: boolean) => { setPreset(''); setOn((c) => (v ? [...new Set([...c, ...keys])] : c.filter((x) => !keys.includes(x)))); };
  const applyPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key);
    if (p) setOn(expand(p.perms));
  };
  /* كل الصلاحيات مفتوحة = «*»، فتشمل ما يُضاف لاحقًا من صلاحيات */
  const value = on.length === ALL_PERMISSIONS.length ? ['*'] : on;

  return (
    <div className="perms">
      <input type="hidden" name="perms" value={JSON.stringify(value)} />
      <input type="hidden" name="preset" value={preset} />
      <div className="perms__presets">
        <span>دور جاهز:</span>
        {PRESETS.map((p) => (
          <button type="button" key={p.key} disabled={disabled}
                  className={`btn btn--sm ${preset === p.key ? '' : 'btn--ghost'}`} onClick={() => applyPreset(p.key)}>
            {p.label}
          </button>
        ))}
        <button type="button" disabled={disabled} className="btn btn--sm btn--ghost" onClick={() => { setPreset(''); setOn([]); }}>بلا صلاحيات</button>
      </div>
      <div className="perms__groups">
        {PERMISSION_GROUPS.map((g) => {
          const keys = g.items.map(([k]) => k);
          const n = keys.filter((k) => on.includes(k)).length;
          return (
            <fieldset key={g.title} className="perms__group" disabled={disabled}>
              <legend>
                {g.title} <small>({n}/{keys.length})</small>
                <button type="button" className="perms__all" onClick={() => group(keys, n < keys.length)}>
                  {n < keys.length ? 'افتح الكل' : 'اقفل الكل'}
                </button>
              </legend>
              {g.items.map(([k, label, hint]) => (
                <label key={k} className={`perms__row${on.includes(k) ? ' is-on' : ''}`}>
                  <span className="perms__txt"><b>{label}</b>{hint ? <small>{hint}</small> : null}</span>
                  <input type="checkbox" role="switch" checked={on.includes(k)} onChange={() => toggle(k)} />
                  <i className="perms__sw" aria-hidden="true" />
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

/** كلمة مرور قوية تُولَّد في المتصفح وتظهر للسوبر أدمن ليعطيها للموظف */
export function PasswordField({ name = 'password', label = 'كلمة المرور', required = true, hint = '10 أحرف على الأقل. انسخها وأعطها للموظف — لا تظهر بعد الحفظ.' }: {
  name?: string; label?: string; required?: boolean; hint?: string;
}) {
  const [v, setV] = useState('');
  const [show, setShow] = useState(false);
  const gen = () => {
    const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const a = new Uint32Array(14); crypto.getRandomValues(a);
    setV([...a].map((x) => abc[x % abc.length]).join('')); setShow(true);
  };
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id={name} name={name} type={show ? 'text' : 'password'} dir="ltr" value={v} minLength={10}
               required={required} autoComplete="new-password" onChange={(e) => setV(e.target.value)} />
        <button type="button" className="btn btn--ghost btn--sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setShow((s) => !s)}>{show ? 'إخفاء' : 'إظهار'}</button>
        <button type="button" className="btn btn--ghost btn--sm" style={{ whiteSpace: 'nowrap' }} onClick={gen}>ولّد كلمة قوية</button>
      </div>
      <p className="field__hint">{hint}</p>
    </div>
  );
}
