package repo

import (
	"database/sql"

	"github.com/jmoiron/sqlx"
)

type ShopSettings struct {
	Name    string `db:"name" json:"name"`
	Phone   string `db:"phone" json:"phone"`
	Address string `db:"address" json:"address"`
}

func EnsureShopSettings(db *sqlx.DB) error {
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS shop_settings (
  id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  name VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(64) NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
	if err != nil {
		return err
	}
	_, err = db.Exec(`
INSERT IGNORE INTO shop_settings (id, name, phone, address)
VALUES (1, 'فروشگاه آبرنگ', '', '')`)
	return err
}

func GetShopSettings(db *sqlx.DB) (ShopSettings, error) {
	var s ShopSettings
	err := db.Get(&s, `SELECT name, phone, address FROM shop_settings WHERE id=1 LIMIT 1`)
	if err == sql.ErrNoRows {
		_ = EnsureShopSettings(db)
		err = db.Get(&s, `SELECT name, phone, address FROM shop_settings WHERE id=1 LIMIT 1`)
	}
	return s, err
}

func UpsertShopSettings(db *sqlx.DB, s ShopSettings) error {
	_, err := db.Exec(`
INSERT INTO shop_settings (id, name, phone, address)
VALUES (1, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  name=VALUES(name),
  phone=VALUES(phone),
  address=VALUES(address)`,
		s.Name, s.Phone, s.Address)
	return err
}
