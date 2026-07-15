-- Multiple delivery addresses per customer; one may be default.
CREATE TABLE IF NOT EXISTS customer_addresses (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  title VARCHAR(64) NOT NULL DEFAULT '',
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(64) NOT NULL DEFAULT '',
  province VARCHAR(128) NOT NULL DEFAULT '',
  city VARCHAR(128) NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  postal_code VARCHAR(32) NOT NULL DEFAULT '',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_addr_customer (customer_id),
  KEY ix_addr_default (customer_id, is_default),
  CONSTRAINT fk_addr_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE invoices
  ADD COLUMN shipping_method VARCHAR(64) NOT NULL DEFAULT '' AFTER source,
  ADD COLUMN shipping_fee BIGINT NOT NULL DEFAULT 0 AFTER shipping_method,
  ADD COLUMN payment_method VARCHAR(64) NOT NULL DEFAULT '' AFTER shipping_fee;
