/* الفوتر — منقول عن footerOnePage() في assets/js/site.js.
   عمود التواصل مرفوع منه بناءً على طلب سابق؛ والأعمدة تأتي من قاعدة البيانات. */
import type { T } from '@/lib/i18n';
import { Icon } from './Icon';
import type { FooterColumn } from '@/lib/nav';
import type { Company } from '@/lib/content';
import { ASSET_V } from '@/lib/version';


function Social({ company }: { company: Company }) {
  const social = (company.social ?? {}) as Record<string, string>;
  const real = ([['linkedin', 'LinkedIn'], ['facebook', 'Facebook'], ['youtube', 'YouTube']] as const)
    .filter(([k]) => social[k] && social[k] !== '#');
  if (!real.length) return null;
  return (
    <div className="social">
      {real.map(([k, name]) => (
        <a href={social[k]} aria-label={name} target="_blank" rel="noopener" key={k}>
          <Icon name={k} />
        </a>
      ))}
    </div>
  );
}

export function Footer({ columns, company, t }: { columns: FooterColumn[]; company: Company; t: T }) {
  return (
    <footer className="ftr">
      <div className="wrap ftr__in ftr__in--lean">
        <div>
          <div className="ftr__logo">
            <img src={`assets/img/brands/5am-logo-white.png?v=${ASSET_V}`} alt="5A&M" />
          </div>
          <p className="ftr__about">
            {t.t('ftr.about', 'Your trusted partner in power generation and environmental solutions across Egypt and beyond.')}
          </p>
          <Social company={company} />
        </div>

        {columns.map((c, i) => (
          <div key={i}>
            <h2 className="ftr__h">{t.tx(c.title)}</h2>
            <ul>
              {c.links.map((l, k) => (
                <li key={k}><a href={t.href(l.href)}>{t.tx(l.label)}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="ftr__bar mt-32">
        <div className="wrap">
          <span>© {new Date().getFullYear()} {company.legalName}. {t.t('ftr.rights', 'All rights reserved.')}</span>
          <span>{t.t('ftr.tagline', 'Powering a better tomorrow.')}</span>
        </div>
      </div>
    </footer>
  );
}
