package repo

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

// EnsureStorefrontSchema adds columns/tables needed by storefront checkout
// even when an older deployment skipped or partially failed migrations.
func EnsureStorefrontSchema(db *sqlx.DB) error {
	if err := ensureCustomerAddressesTable(db); err != nil {
		return err
	}
	cols := []struct {
		name string
		ddl  string
	}{
		{"source", "VARCHAR(32) NOT NULL DEFAULT 'dashboard'"},
		{"shipping_method", "VARCHAR(64) NOT NULL DEFAULT ''"},
		{"shipping_fee", "BIGINT NOT NULL DEFAULT 0"},
		{"payment_method", "VARCHAR(64) NOT NULL DEFAULT ''"},
	}
	for _, c := range cols {
		ok, err := columnExists(db, "invoices", c.name)
		if err != nil {
			return err
		}
		if ok {
			continue
		}
		stmt := fmt.Sprintf("ALTER TABLE invoices ADD COLUMN %s %s", c.name, c.ddl)
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("add invoices.%s: %w", c.name, err)
		}
	}
	return nil
}

func columnExists(db *sqlx.DB, table, column string) (bool, error) {
	var n int
	err := db.Get(&n, `
		SELECT COUNT(*) FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = ?
		  AND COLUMN_NAME = ?`, table, column)
	return n > 0, err
}

func ensureCustomerAddressesTable(db *sqlx.DB) error {
	_, err := db.Exec(`
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
	return err
}
