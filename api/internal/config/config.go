package config

import (
	"os"
)

type Config struct {
	Env        string
	Port       string
	CorsOrigin string

	MySQLDSN   string
	JWTSecret  string
}

func Load() Config {
	cfg := Config{
		Env:        getenv("APP_ENV", "dev"),
		Port:       getenv("APP_PORT", "8080"),
		CorsOrigin: getenv("APP_CORS_ORIGIN", "http://localhost:3000"),
		MySQLDSN:   getenv("MYSQL_DSN", ""),
		JWTSecret:  getenv("JWT_SECRET", "change-me"),
	}
	return cfg
}

func getenv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
