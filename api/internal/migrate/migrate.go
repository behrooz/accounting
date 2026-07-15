package migrate

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"

	"github.com/jmoiron/sqlx"
)

// Apply runs all *.sql files in migrationsDir exactly once, tracked in schema_migrations.
// This is a tiny migration runner to keep dependencies low.
func Apply(db *sqlx.DB, migrationsDir string) error {
	if _, err := db.Exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(255) PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`); err != nil {
		return err
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return err
	}

	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".sql") {
			files = append(files, name)
		}
	}
	sort.Strings(files)

	for _, f := range files {
		var exists int
		if err := db.Get(&exists, "SELECT 1 FROM schema_migrations WHERE filename=? LIMIT 1", f); err == nil && exists == 1 {
			continue
		}

		path := filepath.Join(migrationsDir, f)
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		sqlText := string(b)
		if strings.TrimSpace(sqlText) == "" {
			return fmt.Errorf("empty migration: %s", f)
		}

		for i, stmt := range splitStatements(sqlText) {
			if _, err := db.Exec(stmt); err != nil {
				if isIgnorableMigrationErr(err) {
					continue
				}
				return fmt.Errorf("migration %s statement %d failed: %w", f, i+1, err)
			}
		}
		if _, err := db.Exec("INSERT INTO schema_migrations(filename) VALUES(?)", f); err != nil {
			return err
		}
	}

	return nil
}

// splitStatements splits SQL into individual statements without needing multiStatements=true.
func splitStatements(sqlText string) []string {
	var (
		stmts   []string
		buf     strings.Builder
		inSingle bool
		inBacktick bool
		inLineComment bool
		inBlockComment bool
	)

	runes := []rune(sqlText)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		next := func() rune {
			if i+1 < len(runes) {
				return runes[i+1]
			}
			return 0
		}

		if inLineComment {
			if r == '\n' {
				inLineComment = false
				buf.WriteRune(r)
			}
			continue
		}
		if inBlockComment {
			if r == '*' && next() == '/' {
				inBlockComment = false
				i++
			}
			continue
		}

		if !inSingle && !inBacktick {
			if r == '-' && next() == '-' {
				inLineComment = true
				i++
				continue
			}
			if r == '#' {
				inLineComment = true
				continue
			}
			if r == '/' && next() == '*' {
				inBlockComment = true
				i++
				continue
			}
		}

		if r == '\'' && !inBacktick {
			if inSingle {
				// escaped '' inside string
				if next() == '\'' {
					buf.WriteRune(r)
					buf.WriteRune(next())
					i++
					continue
				}
				inSingle = false
			} else {
				inSingle = true
			}
			buf.WriteRune(r)
			continue
		}

		if r == '`' && !inSingle {
			inBacktick = !inBacktick
			buf.WriteRune(r)
			continue
		}

		if r == ';' && !inSingle && !inBacktick {
			stmt := strings.TrimSpace(buf.String())
			if stmt != "" && !onlyWhitespaceOrSemicolons(stmt) {
				stmts = append(stmts, stmt)
			}
			buf.Reset()
			continue
		}

		buf.WriteRune(r)
	}

	if stmt := strings.TrimSpace(buf.String()); stmt != "" {
		stmts = append(stmts, stmt)
	}
	return stmts
}

func onlyWhitespaceOrSemicolons(s string) bool {
	for _, r := range s {
		if !unicode.IsSpace(r) && r != ';' {
			return false
		}
	}
	return true
}

func isIgnorableMigrationErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate column name") ||
		strings.Contains(msg, "already exists") ||
		strings.Contains(msg, "duplicate key name")
}
