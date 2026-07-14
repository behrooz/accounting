-- Product gallery images (bulk upload, not tied to attributes/variants)
CREATE TABLE IF NOT EXISTS product_images (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  image MEDIUMTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_product_images_product (product_id),
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
