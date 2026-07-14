-- Product categories
CREATE TABLE IF NOT EXISTS product_categories (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  icon VARCHAR(64) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_product_categories_slug (slug),
  KEY ix_product_categories_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link products to a category (one ALTER only — run as separate statements / Execute Script)
ALTER TABLE products
  ADD COLUMN category_id CHAR(36) NULL AFTER name,
  ADD KEY ix_products_category (category_id),
  ADD CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES product_categories(id)
    ON DELETE SET NULL;

-- Seed categories (fixed UUIDs)
INSERT INTO product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c1000001-0000-4000-8000-000000000001', 'تیشرت', 'tshirt', 'tshirt', 1, 1),
  ('c1000001-0000-4000-8000-000000000002', 'کراپ', 'crop', 'crop', 2, 1),
  ('c1000001-0000-4000-8000-000000000003', 'تاپ نیم تنه بادی', 'top-body', 'top-body', 3, 1),
  ('c1000001-0000-4000-8000-000000000004', 'شلوار', 'pants', 'pants', 4, 1),
  ('c1000001-0000-4000-8000-000000000005', 'ست شلوار تیشرت', 'set-pants-tshirt', 'set-pants-tshirt', 5, 1),
  ('c1000001-0000-4000-8000-000000000006', 'ست شلوار کراپ', 'set-pants-crop', 'set-pants-crop', 6, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);
