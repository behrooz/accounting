package repo

import (
	"database/sql"
	"encoding/json"

	"accounting-api/internal/models"

	"github.com/jmoiron/sqlx"
)

type productRow struct {
	ID         string         `db:"id"`
	Name       string         `db:"name"`
	CategoryID sql.NullString `db:"category_id"`
}

type attrRow struct {
	ID        string `db:"id"`
	ProductID string `db:"product_id"`
	Name      string `db:"name"`
	SortOrder int    `db:"sort_order"`
	CreatedAt string `db:"created_at"`
	UpdatedAt string `db:"updated_at"`
}

type optRow struct {
	ID          string `db:"id"`
	AttributeID string `db:"attribute_id"`
	Label       string `db:"label"`
	SortOrder   int    `db:"sort_order"`
	CreatedAt   string `db:"created_at"`
	UpdatedAt   string `db:"updated_at"`
}

type varRow struct {
	ID              string         `db:"id"`
	ProductID       string         `db:"product_id"`
	SKU             string         `db:"sku"`
	Price           int64          `db:"price"`
	SalePrice       int64          `db:"sale_price"`
	Quantity        int            `db:"quantity"`
	AttributeValues string         `db:"attribute_values"`
	Image           sql.NullString `db:"image"`
	CreatedAt       string         `db:"created_at"`
	UpdatedAt       string         `db:"updated_at"`
}

func ListProducts(db *sqlx.DB) ([]models.Product, error) {
	var ps []productRow
	if err := db.Select(&ps, "SELECT id, name, category_id FROM products ORDER BY updated_at DESC"); err != nil {
		return nil, err
	}
	out := make([]models.Product, 0, len(ps))
	for _, p := range ps {
		full, err := GetProduct(db, p.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, *full)
	}
	return out, nil
}

func GetProduct(db *sqlx.DB, id string) (*models.Product, error) {
	var p productRow
	if err := db.Get(&p, "SELECT id, name, category_id FROM products WHERE id=? LIMIT 1", id); err != nil {
		return nil, err
	}

	var attrs []attrRow
	if err := db.Select(&attrs, "SELECT * FROM product_attributes WHERE product_id=? ORDER BY sort_order ASC", id); err != nil {
		return nil, err
	}

	attrIDs := make([]string, 0, len(attrs))
	for _, a := range attrs {
		attrIDs = append(attrIDs, a.ID)
	}

	optsByAttr := map[string][]models.AttributeOption{}
	if len(attrIDs) > 0 {
		query, args, err := sqlx.In("SELECT * FROM attribute_options WHERE attribute_id IN (?) ORDER BY sort_order ASC", attrIDs)
		if err != nil {
			return nil, err
		}
		query = db.Rebind(query)
		var opts []optRow
		if err := db.Select(&opts, query, args...); err != nil {
			return nil, err
		}
		for _, o := range opts {
			optsByAttr[o.AttributeID] = append(optsByAttr[o.AttributeID], models.AttributeOption{ID: o.ID, Label: o.Label})
		}
	}

	var variantsRows []varRow
	if err := db.Select(&variantsRows, "SELECT * FROM product_variants WHERE product_id=? ORDER BY created_at ASC", id); err != nil {
		return nil, err
	}
	var variants []models.ProductVariant
	for _, v := range variantsRows {
		m := map[string]string{}
		_ = json.Unmarshal([]byte(v.AttributeValues), &m)
		var img *string
		if v.Image.Valid {
			s := v.Image.String
			img = &s
		}
		variants = append(variants, models.ProductVariant{
			ID:              v.ID,
			SKU:             v.SKU,
			Price:           v.Price,
			SalePrice:       v.SalePrice,
			Quantity:        v.Quantity,
			AttributeValues: m,
			Image:           img,
		})
	}

	fullAttrs := make([]models.ProductAttribute, 0, len(attrs))
	for _, a := range attrs {
		fullAttrs = append(fullAttrs, models.ProductAttribute{
			ID:      a.ID,
			Name:    a.Name,
			Options: optsByAttr[a.ID],
		})
	}

	return &models.Product{
		ID:         p.ID,
		Name:       p.Name,
		CategoryID: nullStringPtr(p.CategoryID),
		Attributes: fullAttrs,
		Variants:   variants,
	}, nil
}

func nullStringPtr(ns sql.NullString) *string {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	s := ns.String
	return &s
}

func UpsertProduct(db *sqlx.DB, p models.Product) error {
	return WithTx(db, func(tx *sqlx.Tx) error {
		_, err := tx.Exec(
			`INSERT INTO products(id, name, category_id) VALUES(?,?,?)
			 ON DUPLICATE KEY UPDATE name=VALUES(name), category_id=VALUES(category_id)`,
			p.ID, p.Name, p.CategoryID,
		)
		if err != nil {
			return err
		}

		// Replace attributes/options/variants for simplicity (matches localStorage overwrite behavior)
		if _, err := tx.Exec("DELETE FROM product_attributes WHERE product_id=?", p.ID); err != nil {
			return err
		}
		if _, err := tx.Exec("DELETE FROM product_variants WHERE product_id=?", p.ID); err != nil {
			return err
		}

		for i, a := range p.Attributes {
			_, err := tx.Exec(`INSERT INTO product_attributes(id, product_id, name, sort_order) VALUES(?,?,?,?)`, a.ID, p.ID, a.Name, i)
			if err != nil {
				return err
			}
			for j, o := range a.Options {
				_, err := tx.Exec(`INSERT INTO attribute_options(id, attribute_id, label, sort_order) VALUES(?,?,?,?)`, o.ID, a.ID, o.Label, j)
				if err != nil {
					return err
				}
			}
		}

		for _, v := range p.Variants {
			b, _ := json.Marshal(v.AttributeValues)
			_, err := tx.Exec(
				`INSERT INTO product_variants(id, product_id, sku, price, sale_price, quantity, attribute_values, image) VALUES(?,?,?,?,?,?,?,?)`,
				v.ID, p.ID, v.SKU, v.Price, v.SalePrice, v.Quantity, string(b), v.Image,
			)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func DeleteProduct(db *sqlx.DB, id string) error {
	_, err := db.Exec(`DELETE FROM products WHERE id=?`, id)
	return err
}

// WithTx wrapper to avoid import cycle with internal/db. (kept minimal here)
func WithTx(db *sqlx.DB, fn func(*sqlx.Tx) error) error {
	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
