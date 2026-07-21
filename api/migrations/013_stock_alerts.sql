-- Back-in-stock SMS alert subscriptions (storefront)
CREATE TABLE IF NOT EXISTS stock_alert_subscriptions (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NOT NULL DEFAULT '',
  phone VARCHAR(20) NOT NULL,
  status ENUM('pending','notified','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME NULL,
  UNIQUE KEY ux_stock_alert (product_id, variant_id, phone),
  KEY ix_stock_alert_product_status (product_id, status),
  KEY ix_stock_alert_phone (phone),
  CONSTRAINT fk_stock_alert_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
