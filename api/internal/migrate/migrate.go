package migrate

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

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

		if _, err := db.Exec(sqlText); err != nil {
			return fmt.Errorf("migration %s failed: %w", f, err)
		}
		if _, err := db.Exec("INSERT INTO schema_migrations(filename) VALUES(?)", f); err != nil {
			return err
		}
	}

	return nil
}
