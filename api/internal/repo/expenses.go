package repo

import (
	"errors"
	"strings"
	"time"

	"accounting-api/internal/models"

	"github.com/jmoiron/sqlx"
)

type ExpenseListFilter struct {
	DateFrom string
	DateTo   string
	Category string
}

func ListExpenses(db *sqlx.DB, f ExpenseListFilter) ([]models.Expense, error) {
	q := `SELECT id, title, category, amount, expense_date, notes
		FROM expenses WHERE 1=1`
	args := make([]any, 0, 3)

	if from := strings.TrimSpace(f.DateFrom); from != "" {
		if len(from) >= 10 {
			from = from[:10]
		}
		q += " AND expense_date >= ?"
		args = append(args, from)
	}
	if to := strings.TrimSpace(f.DateTo); to != "" {
		if len(to) >= 10 {
			to = to[:10]
		}
		q += " AND expense_date <= ?"
		args = append(args, to)
	}
	if cat := strings.TrimSpace(f.Category); cat != "" && cat != "all" {
		q += " AND category = ?"
		args = append(args, cat)
	}
	q += " ORDER BY expense_date DESC, updated_at DESC"

	var rows []struct {
		ID       string    `db:"id"`
		Title    string    `db:"title"`
		Category string    `db:"category"`
		Amount   int64     `db:"amount"`
		Date     time.Time `db:"expense_date"`
		Notes    string    `db:"notes"`
	}
	if err := db.Select(&rows, q, args...); err != nil {
		return nil, err
	}

	out := make([]models.Expense, 0, len(rows))
	for _, r := range rows {
		out = append(out, models.Expense{
			ID:       r.ID,
			Title:    r.Title,
			Category: r.Category,
			Amount:   r.Amount,
			Date:     r.Date.Format("2006-01-02"),
			Notes:    r.Notes,
		})
	}
	return out, nil
}

func UpsertExpense(db *sqlx.DB, e models.Expense) error {
	if strings.TrimSpace(e.ID) == "" {
		return errors.New("id required")
	}
	if strings.TrimSpace(e.Title) == "" {
		return errors.New("title required")
	}
	date := strings.TrimSpace(e.Date)
	if len(date) >= 10 {
		date = date[:10]
	}
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	if e.Amount < 0 {
		e.Amount = 0
	}
	_, err := db.Exec(
		`INSERT INTO expenses(id, title, category, amount, expense_date, notes)
		 VALUES(?,?,?,?,?,?)
		 ON DUPLICATE KEY UPDATE
		   title=VALUES(title),
		   category=VALUES(category),
		   amount=VALUES(amount),
		   expense_date=VALUES(expense_date),
		   notes=VALUES(notes)`,
		e.ID, strings.TrimSpace(e.Title), strings.TrimSpace(e.Category),
		e.Amount, date, e.Notes,
	)
	return err
}

func DeleteExpense(db *sqlx.DB, id string) error {
	res, err := db.Exec("DELETE FROM expenses WHERE id=?", id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errors.New("not found")
	}
	return nil
}

func SumExpenses(db *sqlx.DB, f ExpenseListFilter) (int64, error) {
	q := `SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE 1=1`
	args := make([]any, 0, 3)
	if from := strings.TrimSpace(f.DateFrom); from != "" {
		if len(from) >= 10 {
			from = from[:10]
		}
		q += " AND expense_date >= ?"
		args = append(args, from)
	}
	if to := strings.TrimSpace(f.DateTo); to != "" {
		if len(to) >= 10 {
			to = to[:10]
		}
		q += " AND expense_date <= ?"
		args = append(args, to)
	}
	if cat := strings.TrimSpace(f.Category); cat != "" && cat != "all" {
		q += " AND category = ?"
		args = append(args, cat)
	}
	var total int64
	if err := db.Get(&total, q, args...); err != nil {
		return 0, err
	}
	return total, nil
}
