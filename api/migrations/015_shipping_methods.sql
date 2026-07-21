CREATE TABLE IF NOT EXISTS shipping_methods (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  delivery_note VARCHAR(255) NOT NULL DEFAULT '',
  fee BIGINT NOT NULL DEFAULT 0,
  pay_at_destination TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO shipping_methods (id, name, delivery_note, fee, pay_at_destination, sort_order, is_active)
VALUES
  ('pishtaz', 'پست پیشتاز', 'تحویل ۳ تا ۷ روز کاری', 149000, 0, 1, 1),
  ('tipax', 'تیپاکس (کرایه در مقصد)', 'تحویل ۲ تا ۳ روز کاری', 0, 1, 2, 1);
