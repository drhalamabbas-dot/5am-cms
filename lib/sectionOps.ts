/* =============================================================================
   ترتيب الأقسام وإخفاؤها وحذفها.

   تُستدعى من مكانين: محرّر الصفحة في اللوحة، وشريط التحرير فوق كل قسم على
   الموقع نفسه. منطق واحد للمكانين كي لا يختلف ما يحدث باختلاف الزرّ.

   كلها في معاملة: النسخة في السجل والتعديل ينجحان معًا أو لا يحدث شيء.
============================================================================= */
import { tx } from './db';
import { snapshot } from './admin';

/**
 * يحرّك القسم خطوة لأعلى (-1) أو لأسفل (1). المواضع كلها تُعاد كتابتها
 * بالترتيب، فتُحفظ أقسام الصفحة كلها قبلها في نسخة واحدة يرجع إليها الترتيب.
 */
export async function moveSection(pageId: number, id: number, dir: number, userId: number) {
  await tx(async (db) => {
    const list = await db.q<any>(
      'SELECT * FROM sections WHERE page_id = ? ORDER BY position, id FOR UPDATE', [pageId]
    );
    const i = list.findIndex((s) => s.id === id);
    const j = i + Math.sign(dir);
    if (i < 0 || j < 0 || j >= list.length) return;
    await db.q(
      'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
      ['page', pageId, JSON.stringify({ bundle: { sections: list }, note: 'order' }), userId]
    );
    [list[i], list[j]] = [list[j], list[i]];
    for (let k = 0; k < list.length; k++) {
      await db.q('UPDATE sections SET position = ? WHERE id = ?', [k, list[k].id]);
    }
  });
}

/** يخفي القسم عن الزائر أو يظهره. المخفي يبقى بمحتواه، ويراه صاحب الموقع. */
export async function toggleSection(pageId: number, id: number, userId: number) {
  await tx(async (db) => {
    const row = await db.q1('SELECT id FROM sections WHERE id = ? AND page_id = ? FOR UPDATE', [id, pageId]);
    if (!row) return;
    await snapshot('section', id, userId, db);
    await db.q('UPDATE sections SET published = 1 - published WHERE id = ?', [id]);
  });
}

/** يحذف القسم. نسخته تبقى في السجل، فيُعاد من «التراجع عن تعديل» بمكانه نفسه. */
export async function deleteSection(pageId: number, id: number, userId: number) {
  await tx(async (db) => {
    const row = await db.q1('SELECT id FROM sections WHERE id = ? AND page_id = ? FOR UPDATE', [id, pageId]);
    if (!row) return;
    await snapshot('section', id, userId, db);
    await db.q('DELETE FROM sections WHERE id = ?', [id]);
  });
}
