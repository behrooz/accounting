package repo

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/jmoiron/sqlx"
)

type ShippingMethod struct {
	ID               string `db:"id" json:"id"`
	Name             string `db:"name" json:"name"`
	DeliveryNote     string `db:"delivery_note" json:"deliveryNote"`
	Fee              int64  `db:"fee" json:"fee"`
	PayAtDestination bool   `db:"pay_at_destination" json:"payAtDestination"`
	SortOrder        int    `db:"sort_order" json:"sortOrder"`
	IsActive         bool   `db:"is_active" json:"isActive"`
}

func EnsureShippingMethods(db *sqlx.DB) error {
	_, err := db.Exec(`
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
	if err != nil {
		return err
	}
	_, err = db.Exec(`
INSERT IGNORE INTO shipping_methods (id, name, delivery_note, fee, pay_at_destination, sort_order, is_active)
VALUES
  ('pishtaz', 'پست پیشتاز', 'تحویل ۳ تا ۷ روز کاری', 149000, 0, 1, 1),
  ('tipax', 'تیپاکس (کرایه در مقصد)', 'تحویل ۲ تا ۳ روز کاری', 0, 1, 2, 1)`)
	return err
}

func ListShippingMethods(db *sqlx.DB, activeOnly bool) ([]ShippingMethod, error) {
	q := `
SELECT id, name, delivery_note, fee, pay_at_destination, sort_order, is_active
FROM shipping_methods`
	if activeOnly {
		q += " WHERE is_active = 1"
	}
	q += " ORDER BY sort_order ASC, name ASC"

	var rows []ShippingMethod
	if err := db.Select(&rows, q); err != nil {
		return nil, err
	}
	return rows, nil
}

func GetShippingMethod(db *sqlx.DB, id string) (*ShippingMethod, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, sql.ErrNoRows
	}
	var m ShippingMethod
	err := db.Get(&m, `
SELECT id, name, delivery_note, fee, pay_at_destination, sort_order, is_active
FROM shipping_methods
WHERE id = ? LIMIT 1`, id)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func GetActiveShippingMethod(db *sqlx.DB, id string) (*ShippingMethod, error) {
	m, err := GetShippingMethod(db, id)
	if err != nil {
		return nil, err
	}
	if !m.IsActive {
		return nil, sql.ErrNoRows
	}
	return m, nil
}

func ReplaceShippingMethods(db *sqlx.DB, methods []ShippingMethod) error {
	if len(methods) == 0 {
		return errors.New("حداقل یک روش ارسال لازم است")
	}

	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM shipping_methods`); err != nil {
		return err
	}

	seen := map[string]bool{}
	for i, raw := range methods {
		m := normalizeShippingMethod(raw, i)
		if m.ID == "" || m.Name == "" {
			return errors.New("شناسه و نام روش ارسال الزامی است")
		}
		if seen[m.ID] {
			return errors.New("شناسه روش ارسال تکراری است: " + m.ID)
		}
		seen[m.ID] = true

		if _, err := tx.Exec(`
INSERT INTO shipping_methods (id, name, delivery_note, fee, pay_at_destination, sort_order, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
			m.ID, m.Name, m.DeliveryNote, m.Fee, m.PayAtDestination, m.SortOrder, m.IsActive,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func normalizeShippingMethod(m ShippingMethod, index int) ShippingMethod {
	m.ID = strings.TrimSpace(m.ID)
	m.Name = strings.TrimSpace(m.Name)
	m.DeliveryNote = strings.TrimSpace(m.DeliveryNote)
	if m.ID == "" {
		m.ID = NewID()
	}
	if m.Fee < 0 {
		m.Fee = 0
	}
	if m.PayAtDestination {
		m.Fee = 0
	}
	if m.SortOrder <= 0 {
		m.SortOrder = index + 1
	}
	return m
}

func ResolveCheckoutShipping(db *sqlx.DB, methodID string, clientFee int64) (string, int64, error) {
	methodID = strings.TrimSpace(methodID)
	if methodID == "" {
		methodID = "pishtaz"
	}

	m, err := GetActiveShippingMethod(db, methodID)
	if err == nil {
		fee := m.Fee
		if m.PayAtDestination {
			fee = 0
		}
		return m.Name, fee, nil
	}

	// Backward compatibility for legacy storefront payloads.
	label, fee := resolveShippingLegacy(methodID, clientFee)
	return label, fee, nil
}

func resolveShippingLegacy(method string, fee int64) (string, int64) {
	m := strings.TrimSpace(method)
	switch m {
	case "tipax":
		return "تیپاکس (کرایه در مقصد)", 0
	case "pishtaz", "":
		if fee <= 0 {
			fee = 149000
		}
		return "پست پیشتاز", fee
	default:
		if fee < 0 {
			fee = 0
		}
		return m, fee
	}
}
