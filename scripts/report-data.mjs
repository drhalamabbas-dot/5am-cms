/* يجمع أرقام الموقع الحالية لتقرير الحالة. يُشغَّل قبل كتابة أي تقرير كي
   تأتي الأرقام من القاعدة لا من الذاكرة.   node scripts/report-data.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { connect } from './lib.mjs';

const db = await connect();
const one = async (sql, a = []) => (await db.query(sql, a))[0][0];
const all = async (sql, a = []) => (await db.query(sql, a))[0];

const out = {};
out.pages = await all(
  `SELECT p.slug, p.template, p.published, p.crumb_ar, p.crumb_en, p.parent_slug, p.redirect_to,
          (SELECT COUNT(*) FROM sections s WHERE s.page_id = p.id) AS sections
     FROM pages p ORDER BY p.position, p.id`
);
out.sectionTypes = await all('SELECT type, COUNT(*) n FROM sections GROUP BY type ORDER BY n DESC');
out.products = await all(
  `SELECT p.slug, p.category, p.subcategory, p.published, b.name brand,
          JSON_LENGTH(JSON_EXTRACT(p.data,'$.gallery')) gallery,
          JSON_LENGTH(JSON_EXTRACT(p.data,'$.videos')) videos,
          JSON_LENGTH(JSON_EXTRACT(p.data,'$.specifications')) specs,
          (p.hero_image IS NOT NULL) has_img, (p.name_ar IS NOT NULL AND p.name_ar <> '') has_ar
     FROM products p LEFT JOIN brands b ON b.id = p.brand_id ORDER BY p.category, p.position`
);
out.brands = (await one('SELECT COUNT(*) n FROM brands')).n;
out.media = await all('SELECT kind, COUNT(*) n, ROUND(SUM(bytes)/1048576,1) mb FROM media GROUP BY kind');
out.translations = await all('SELECT IF(`group`="phrase","phrase","ui") g, COUNT(*) n, SUM(ar IS NULL OR ar="") missing FROM translations GROUP BY g');
out.nav = await all('SELECT area, COUNT(*) n, SUM(parent_id IS NULL) top FROM nav_items GROUP BY area');
out.users = (await one('SELECT COUNT(*) n FROM users')).n;
out.revisions = (await one('SELECT COUNT(*) n FROM revisions')).n;
out.settings = (await all('SELECT `key` FROM settings')).map((r) => r.key);

/* أقسام فارغة: أُنشئت من قالب ولم يُكتب عنوانها */
out.emptySections = await all(
  `SELECT p.slug, s.type FROM sections s JOIN pages p ON p.id = s.page_id
    WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.content,'$.title.ar')),'') = ''
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.content,'$.title.en')),'') = ''
      AND s.type NOT IN ('contact','heroSlider','logostrip','quoteForm','ctaband','linecardJump')`
);
await db.end();

/* الكود */
const root = path.join(import.meta.dirname, '..');
const walk = (d, ext, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.next', 'public'].includes(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, ext, acc);
    else if (ext.some((x) => f.endsWith(x))) acc.push(f);
  }
  return acc;
};
const code = walk(root, ['.ts', '.tsx']);
const scripts = fs.readdirSync(path.join(root, 'scripts')).filter((f) => f.endsWith('.mjs'));
const lines = (fs_) => fs_.reduce((s, f) => s + fs.readFileSync(f, 'utf8').split('\n').length, 0);
out.code = {
  tsFiles: code.length, tsLines: lines(code),
  adminScreens: walk(path.join(root, 'app', '(admin)'), ['page.tsx']).length,
  scripts: scripts.length,
  appJsLines: fs.readFileSync(path.join(root, 'public/assets/js/app.js'), 'utf8').split('\n').length,
  adminCssLines: fs.readFileSync(path.join(root, 'public/admin.css'), 'utf8').split('\n').length,
};
out.pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

console.log(JSON.stringify(out, null, 1));
