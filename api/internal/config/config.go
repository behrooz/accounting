package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	Env        string
	Port       string
	CorsOrigin string

	MySQLDSN  string
	JWTSecret string
}

func Load() Config {
	_ = loadDotEnv(".env")

	cfg := Config{
		Env:        getenv("APP_ENV", "dev"),
		Port:       getenv("APP_PORT", "8080"),
		CorsOrigin: getenv("APP_CORS_ORIGIN", "*"),
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

// loadDotEnv reads KEY=VALUE pairs from a local .env without overriding
// variables already present in the process environment.
func loadDotEnv(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}
		eq := strings.IndexByte(line, '=')
		if eq <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		val := strings.TrimSpace(line[eq+1:])
		if key == "" {
			continue
		}
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
		}
	}
	return sc.Err()
}
