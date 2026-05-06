package repo

import (
	"errors"
	"strings"

	"accounting-api/internal/models"
	"github.com/jmoiron/sqlx"
)

func EnsureDefaultAdmin(db *sqlx.DB, adminID string, fullName string, username string, passwordHash string) error {
	var n int
	if err := db.Get(&n, "SELECT COUNT(*) FROM users"); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	_, err := db.Exec(
		`INSERT INTO users(id, full_name, username, password_hash, role, is_active) VALUES(?,?,?,?, 'admin', 1)`,
		adminID, fullName, username, passwordHash,
	)
	return err
}

func GetUserByUsername(db *sqlx.DB, username string) (*models.User, error) {
	var u models.User
	err := db.Get(&u, "SELECT * FROM users WHERE username = ? LIMIT 1", strings.TrimSpace(username))
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func ListUsers(db *sqlx.DB) ([]models.User, error) {
	var users []models.User
	err := db.Select(&users, "SELECT * FROM users ORDER BY created_at DESC")
	return users, err
}

func CreateUser(db *sqlx.DB, u models.User) error {
	_, err := db.Exec(`INSERT INTO users(id, full_name, username, password_hash, role, is_active) VALUES(?,?,?,?,?,?)`,
		u.ID, u.FullName, u.Username, u.PasswordHash, u.Role, u.IsActive,
	)
	return err
}

func UpdateUser(db *sqlx.DB, u models.User) error {
	res, err := db.Exec(`UPDATE users SET full_name=?, username=?, password_hash=?, role=?, is_active=? WHERE id=?`,
		u.FullName, u.Username, u.PasswordHash, u.Role, u.IsActive, u.ID,
	)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errors.New("not found")
	}
	return nil
}

func DeleteUser(db *sqlx.DB, id string) error {
	res, err := db.Exec(`DELETE FROM users WHERE id=?`, id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errors.New("not found")
	}
	return nil
}
