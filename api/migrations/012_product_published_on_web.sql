-- Whether a product is visible on the public storefront (web).
ALTER TABLE products
  ADD COLUMN published_on_web TINYINT(1) NOT NULL DEFAULT 1 AFTER category_id;

ALTER TABLE products
  ADD KEY ix_products_published_updated (published_on_web, updated_at DESC, id DESC);
