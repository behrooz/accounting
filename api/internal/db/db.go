package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
)

func Open(dsn string) (*sqlx.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("MYSQL_DSN is required")
	}
	db, err := sqlx.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	return db, nil
}

// EnsureDatabase connects without a schema and creates the DB from the DSN if missing.
func EnsureDatabase(ctx context.Context, dsn string) error {
	if dsn == "" {
		return fmt.Errorf("MYSQL_DSN is required")
	}

	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return fmt.Errorf("parse MYSQL_DSN: %w", err)
	}
	if cfg.DBName == "" {
		return fmt.Errorf("MYSQL_DSN must include a database name")
	}

	dbName := cfg.DBName
	cfg.DBName = ""
	bootstrap, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	defer bootstrap.Close()

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := bootstrap.PingContext(ctx); err != nil {
		return err
	}

	// Identifier quoting: only allow simple names (already came from our DSN).
	q := fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
		sanitizeIdent(dbName),
	)
	if _, err := bootstrap.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("create database %q: %w", dbName, err)
	}
	return nil
}

func sanitizeIdent(name string) string {
	out := make([]byte, 0, len(name))
	for i := 0; i < len(name); i++ {
		c := name[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' {
			out = append(out, c)
		}
	}
	return string(out)
}

func Ping(ctx context.Context, db *sqlx.DB) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return db.DB.PingContext(ctx)
}

func WithTx(ctx context.Context, db *sqlx.DB, fn func(*sqlx.Tx) error) error {
	tx, err := db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
