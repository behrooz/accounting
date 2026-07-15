package repo

import (
	"database/sql"
	"errors"
	"strings"

	"accounting-api/internal/models"

	"github.com/jmoiron/sqlx"
)

type addressRow struct {
	ID         string `db:"id"`
	CustomerID string `db:"customer_id"`
	Title      string `db:"title"`
	FullName   string `db:"full_name"`
	Phone      string `db:"phone"`
	Province   string `db:"province"`
	City       string `db:"city"`
	Address    string `db:"address"`
	PostalCode string `db:"postal_code"`
	IsDefault  int    `db:"is_default"`
}

func rowToAddress(r addressRow) models.CustomerAddress {
	return models.CustomerAddress{
		ID:         r.ID,
		CustomerID: r.CustomerID,
		Title:      r.Title,
		FullName:   r.FullName,
		Phone:      r.Phone,
		Province:   r.Province,
		City:       r.City,
		Address:    r.Address,
		PostalCode: r.PostalCode,
		IsDefault:  r.IsDefault != 0,
	}
}

func ListAddresses(db *sqlx.DB, customerID string) ([]models.CustomerAddress, error) {
	var rows []addressRow
	if err := db.Select(&rows, `
		SELECT id, customer_id, title, full_name, phone, province, city, address, postal_code, is_default
		FROM customer_addresses WHERE customer_id=?
		ORDER BY is_default DESC, updated_at DESC`, customerID); err != nil {
		return nil, err
	}
	out := make([]models.CustomerAddress, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToAddress(r))
	}
	return out, nil
}

func GetAddress(db *sqlx.DB, id string) (*models.CustomerAddress, error) {
	var r addressRow
	if err := db.Get(&r, `
		SELECT id, customer_id, title, full_name, phone, province, city, address, postal_code, is_default
		FROM customer_addresses WHERE id=? LIMIT 1`, id); err != nil {
		return nil, err
	}
	a := rowToAddress(r)
	return &a, nil
}

func FormatAddressLine(a models.CustomerAddress) string {
	parts := []string{}
	if a.Province != "" {
		parts = append(parts, a.Province)
	}
	if a.City != "" {
		parts = append(parts, a.City)
	}
	if a.Address != "" {
		parts = append(parts, a.Address)
	}
	if a.PostalCode != "" {
		parts = append(parts, "کدپستی "+a.PostalCode)
	}
	return strings.Join(parts, "، ")
}

func UpsertAddress(db *sqlx.DB, a models.CustomerAddress) error {
	if a.ID == "" || a.CustomerID == "" {
		return errors.New("id and customerId required")
	}
	if strings.TrimSpace(a.Address) == "" {
		return errors.New("address required")
	}
	return WithTx(db, func(tx *sqlx.Tx) error {
		def := 0
		if a.IsDefault {
			def = 1
			if _, err := tx.Exec(`UPDATE customer_addresses SET is_default=0 WHERE customer_id=?`, a.CustomerID); err != nil {
				return err
			}
		}
		_, err := tx.Exec(`
			INSERT INTO customer_addresses(
				id, customer_id, title, full_name, phone, province, city, address, postal_code, is_default
			) VALUES (?,?,?,?,?,?,?,?,?,?)
			ON DUPLICATE KEY UPDATE
				title=VALUES(title),
				full_name=VALUES(full_name),
				phone=VALUES(phone),
				province=VALUES(province),
				city=VALUES(city),
				address=VALUES(address),
				postal_code=VALUES(postal_code),
				is_default=VALUES(is_default)`,
			a.ID, a.CustomerID, a.Title, a.FullName, a.Phone, a.Province, a.City, a.Address, a.PostalCode, def,
		)
		if err != nil {
			return err
		}
		if a.IsDefault {
			line := FormatAddressLine(a)
			_, _ = tx.Exec(`UPDATE customers SET address=? WHERE id=?`, line, a.CustomerID)
		}
		return nil
	})
}

func SetDefaultAddress(db *sqlx.DB, customerID, addressID string) error {
	return WithTx(db, func(tx *sqlx.Tx) error {
		var r addressRow
		if err := tx.Get(&r, `
			SELECT id, customer_id, title, full_name, phone, province, city, address, postal_code, is_default
			FROM customer_addresses WHERE id=? AND customer_id=? LIMIT 1`, addressID, customerID); err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE customer_addresses SET is_default=0 WHERE customer_id=?`, customerID); err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE customer_addresses SET is_default=1 WHERE id=?`, addressID); err != nil {
			return err
		}
		a := rowToAddress(r)
		a.IsDefault = true
		_, err := tx.Exec(`UPDATE customers SET address=? WHERE id=?`, FormatAddressLine(a), customerID)
		return err
	})
}

func DeleteAddress(db *sqlx.DB, id string) error {
	res, err := db.Exec(`DELETE FROM customer_addresses WHERE id=?`, id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errors.New("not found")
	}
	return nil
}

// EnsureCustomerByPhone finds or creates a shop customer profile.
func EnsureCustomerByPhone(db *sqlx.DB, name, phone, notes string) (*models.Customer, error) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil, errors.New("phone required")
	}
	c, err := FindCustomerByPhone(db, phone)
	if err == nil && c != nil {
		if name != "" && c.Name != name {
			c.Name = name
			_ = UpsertCustomer(db, *c)
		}
		addrs, _ := ListAddresses(db, c.ID)
		c.Addresses = addrs
		return c, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	c = &models.Customer{
		ID:        NewID(),
		Name:      strings.TrimSpace(name),
		Phone:     phone,
		Address:   "",
		Notes:     notes,
		Addresses: []models.CustomerAddress{},
	}
	if c.Name == "" {
		c.Name = phone
	}
	if err := UpsertCustomer(db, *c); err != nil {
		return nil, err
	}
	return c, nil
}

func AttachAddresses(db *sqlx.DB, customers []models.Customer) error {
	for i := range customers {
		addrs, err := ListAddresses(db, customers[i].ID)
		if err != nil {
			return err
		}
		customers[i].Addresses = addrs
	}
	return nil
}
