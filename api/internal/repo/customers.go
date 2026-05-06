package repo

import (
	"errors"

	"accounting-api/internal/models"
	"github.com/jmoiron/sqlx"
)

func ListCustomers(db *sqlx.DB) ([]models.Customer, error) {
	var cs []models.Customer
	err := db.Select(&cs, "SELECT id, name, phone, address, notes FROM customers ORDER BY updated_at DESC")
	return cs, err
}

func UpsertCustomer(db *sqlx.DB, c models.Customer) error {
	_, err := db.Exec(
		`INSERT INTO customers(id, name, phone, address, notes) VALUES(?,?,?,?,?)
		 ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), address=VALUES(address), notes=VALUES(notes)`,
		c.ID, c.Name, c.Phone, c.Address, c.Notes,
	)
	return err
}

func DeleteCustomer(db *sqlx.DB, id string) error {
	res, err := db.Exec("DELETE FROM customers WHERE id=?", id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errors.New("not found")
	}
	return nil
}
