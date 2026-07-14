package repo

import (
	"accounting-api/internal/models"

	"github.com/jmoiron/sqlx"
)

func ListCategories(db *sqlx.DB) ([]models.ProductCategory, error) {
	var rows []models.ProductCategory
	err := db.Select(&rows, `
		SELECT id, name, slug, icon, sort_order, is_active
		FROM product_categories
		WHERE is_active = 1
		ORDER BY sort_order ASC, name ASC`)
	return rows, err
}

func ListAllCategories(db *sqlx.DB) ([]models.ProductCategory, error) {
	var rows []models.ProductCategory
	err := db.Select(&rows, `
		SELECT id, name, slug, icon, sort_order, is_active
		FROM product_categories
		ORDER BY sort_order ASC, name ASC`)
	return rows, err
}

func GetCategory(db *sqlx.DB, id string) (*models.ProductCategory, error) {
	var row models.ProductCategory
	if err := db.Get(&row, `
		SELECT id, name, slug, icon, sort_order, is_active
		FROM product_categories WHERE id=? LIMIT 1`, id); err != nil {
		return nil, err
	}
	return &row, nil
}

func UpsertCategory(db *sqlx.DB, c models.ProductCategory) error {
	_, err := db.Exec(`
		INSERT INTO product_categories(id, name, slug, icon, sort_order, is_active)
		VALUES(?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE
		  name=VALUES(name),
		  slug=VALUES(slug),
		  icon=VALUES(icon),
		  sort_order=VALUES(sort_order),
		  is_active=VALUES(is_active)`,
		c.ID, c.Name, c.Slug, c.Icon, c.SortOrder, c.IsActive,
	)
	return err
}

func DeleteCategory(db *sqlx.DB, id string) error {
	_, err := db.Exec(`DELETE FROM product_categories WHERE id=?`, id)
	return err
}
