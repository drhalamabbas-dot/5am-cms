-- =============================================================================
--  5A&M — قاعدة بيانات الموقع والداش بورد
--
--  المبدأ: الحقول الثابتة (اسم، رابط، ترتيب) أعمدة عادية عشان يبقى فيها ترابط
--  وفهرسة. والمحتوى المتغيّر (محتوى السيكشن، مواصفات المنتج) عمود JSON، لأن كل
--  نوع سيكشن ليه شكل مختلف. وده بيخلّي النقل من الموقع الحالي بلا أي فقدان.
--
--  كل نص ليه نسخة عربي وإنجليزي. داخل الـ JSON بتتخزن بالشكل {"en":..,"ar":..}
--  وهو نفس شكلها في الكود الحالي، فالنقل بيبقى حرفي.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------- الإعدادات
-- بيانات الشركة، التواصل، العناوين، وأي إعداد عام. مفتاح وقيمة.
CREATE TABLE IF NOT EXISTS settings (
  `key`       VARCHAR(100) NOT NULL PRIMARY KEY,
  `value`     JSON NOT NULL,
  `group`     VARCHAR(50)  NOT NULL DEFAULT 'general',
  label_en    VARCHAR(190) NULL,
  label_ar    VARCHAR(190) NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_settings_group (`group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------ الصفحات
CREATE TABLE IF NOT EXISTS pages (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug            VARCHAR(120) NOT NULL UNIQUE,   -- aftersales, projects, about …
  template        VARCHAR(40)  NOT NULL DEFAULT 'sections',
  position        INT NOT NULL DEFAULT 0,
  published       TINYINT(1) NOT NULL DEFAULT 1,

  crumb_en        VARCHAR(190) NULL,              -- اسم الصفحة في مسار التنقل
  crumb_ar        VARCHAR(190) NULL,
  parent_slug     VARCHAR(120) NULL,              -- صفحة أعلى في المسار

  -- بيانات محركات البحث
  title_en        VARCHAR(255) NULL,
  title_ar        VARCHAR(255) NULL,
  description_en  TEXT NULL,
  description_ar  TEXT NULL,
  og_image        VARCHAR(255) NULL,
  noindex         TINYINT(1) NOT NULL DEFAULT 0,

  hero            JSON NULL,                      -- {img, kicker:{en,ar}, title:{..}, lede:{..}}
  related         JSON NULL,                      -- صفحات «وصول مباشر للخدمات» أسفل الصفحة
  quote_solution  VARCHAR(40) NULL,               -- الخدمة التي يبدأ بها نموذج عرض السعر
  redirect_to     VARCHAR(190) NULL,              -- للصفحات القديمة اللي بتحوّل
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pages_published (published, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------ السكاشن
-- content فيه محتوى السيكشن كامل بنفس شكله في الكود الحالي، فمفيش أي فقدان
-- مهما اختلف نوع السيكشن (story, cards, list, gallery, compare, vmv …).
CREATE TABLE IF NOT EXISTS sections (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  page_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(40)  NOT NULL,              -- story, cards, list, cta …
  anchor      VARCHAR(120) NULL,                  -- id بتاع السيكشن في الرابط
  position    INT NOT NULL DEFAULT 0,
  published   TINYINT(1) NOT NULL DEFAULT 1,
  content     JSON NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sections_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  INDEX idx_sections_page (page_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- الماركات
CREATE TABLE IF NOT EXISTS brands (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(60) NOT NULL UNIQUE,        -- elgin, vactor, guzzler …
  name        VARCHAR(120) NOT NULL,
  logo        VARCHAR(255) NULL,
  sub_en      VARCHAR(190) NULL,
  sub_ar      VARCHAR(190) NULL,
  `group`     VARCHAR(40)  NULL,                  -- environmental, power, house
  site        VARCHAR(255) NULL,
  position    INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- المنتجات
CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ref             VARCHAR(80)  NOT NULL UNIQUE,   -- id القديم، عشان الروابط الداخلية تفضل شغالة
  slug            VARCHAR(160) NOT NULL UNIQUE,
  brand_id        INT UNSIGNED NULL,
  category        VARCHAR(60)  NULL,              -- environmental, power, parts
  subcategory     VARCHAR(120) NULL,
  position        INT NOT NULL DEFAULT 0,
  published       TINYINT(1) NOT NULL DEFAULT 1,

  name_en         VARCHAR(255) NULL,
  name_ar         VARCHAR(255) NULL,
  type_en         VARCHAR(255) NULL,
  type_ar         VARCHAR(255) NULL,
  description_en  TEXT NULL,
  description_ar  TEXT NULL,
  hero_image      VARCHAR(255) NULL,

  -- gallery, specifications, features, applications, downloads, videos, meta, related
  data            JSON NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  INDEX idx_products_cat (category, position),
  INDEX idx_products_published (published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------- المنيو العلوي والفوتر
CREATE TABLE IF NOT EXISTS nav_items (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  area        ENUM('header','footer') NOT NULL,
  parent_id   INT UNSIGNED NULL,                  -- للقوائم المنسدلة وأعمدة الفوتر
  position    INT NOT NULL DEFAULT 0,
  label_en    VARCHAR(190) NOT NULL,
  label_ar    VARCHAR(190) NOT NULL,
  href        VARCHAR(255) NULL,
  desc_en     VARCHAR(255) NULL,                  -- الوصف الصغير تحت العنصر
  desc_ar     VARCHAR(255) NULL,
  extra       JSON NULL,                          -- مثل بيانات البرومو في المنيو
  published   TINYINT(1) NOT NULL DEFAULT 1,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_nav_parent FOREIGN KEY (parent_id) REFERENCES nav_items(id) ON DELETE CASCADE,
  INDEX idx_nav_area (area, parent_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------ مكتبة الصور
CREATE TABLE IF NOT EXISTS media (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  path        VARCHAR(255) NOT NULL UNIQUE,       -- assets/img/photos/field-service.jpg
  kind        VARCHAR(20)  NOT NULL DEFAULT 'image',  -- image, video, document
  width       INT NULL,
  height      INT NULL,
  bytes       BIGINT NULL,
  alt_en      VARCHAR(255) NULL,
  alt_ar      VARCHAR(255) NULL,
  folder      VARCHAR(120) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_folder (folder),
  INDEX idx_media_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------- نصوص الواجهة (أزرار، عناوين عامة)
-- النصوص اللي مش جزء من صفحة معيّنة: "اعرف المزيد"، "اطلب عرض سعر" … إلخ.
-- ملاحظة: ترتيب المفتاح ثنائي (utf8mb4_bin) عن عمد. الترتيب الافتراضي لا يفرّق
-- بين حالة الأحرف، فكان يدمج «Genset trailer» و«Genset Trailer» في صف واحد
-- ويضيّع إحدى الترجمتين.
CREATE TABLE IF NOT EXISTS translations (
  `key`       VARCHAR(190) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  en          TEXT NULL,
  ar          TEXT NULL,
  `group`     VARCHAR(60) NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tr_group (`group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------- مستخدمي الداش بورد
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(190) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  name           VARCHAR(190) NULL,
  role           ENUM('admin','editor') NOT NULL DEFAULT 'admin',
  last_login_at  TIMESTAMP NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------- سجل التعديلات
-- نسخة من المحتوى قبل كل تعديل، عشان لو حصل غلط نرجع خطوة لورا.
CREATE TABLE IF NOT EXISTS revisions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity      VARCHAR(40) NOT NULL,               -- page, section, product …
  entity_id   INT UNSIGNED NOT NULL,
  snapshot    JSON NOT NULL,
  user_id     INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rev_entity (entity, entity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
