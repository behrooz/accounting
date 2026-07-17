package repo

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

var phoneRE = regexp.MustCompile(`^09\d{9}$`)

type StoreOTP struct {
	Phone     string    `db:"phone"`
	CodeHash  string    `db:"code_hash"`
	Attempts  int       `db:"attempts"`
	ExpiresAt time.Time `db:"expires_at"`
	SentAt    time.Time `db:"sent_at"`
}

func NormalizeIranPhone(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "-", "")
	s = strings.Map(func(r rune) rune {
		switch {
		case r >= '۰' && r <= '۹':
			return '0' + (r - '۰')
		case r >= '٠' && r <= '٩':
			return '0' + (r - '٠')
		default:
			return r
		}
	}, s)
	s = strings.TrimPrefix(s, "+98")
	s = strings.TrimPrefix(s, "98")
	if strings.HasPrefix(s, "9") && len(s) == 10 {
		s = "0" + s
	}
	if !phoneRE.MatchString(s) {
		return "", errors.New("شماره موبایل معتبر نیست")
	}
	return s, nil
}

func hashOTP(phone, code string) string {
	sum := sha256.Sum256([]byte(phone + ":" + code))
	return hex.EncodeToString(sum[:])
}

func GenerateOTPCode(digits int) (string, error) {
	if digits <= 0 {
		digits = 5
	}
	max := 1
	for i := 0; i < digits; i++ {
		max *= 10
	}
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	n := int(b[0])<<24 | int(b[1])<<16 | int(b[2])<<8 | int(b[3])
	if n < 0 {
		n = -n
	}
	code := n % max
	return fmt.Sprintf("%0*d", digits, code), nil
}

func EnsureStoreOTPTable(db *sqlx.DB) error {
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS store_otps (
  phone VARCHAR(20) PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  sent_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
	return err
}

func SaveStoreOTP(db *sqlx.DB, phone, code string, ttl time.Duration) error {
	phone, err := NormalizeIranPhone(phone)
	if err != nil {
		return err
	}
	now := time.Now()
	var existing StoreOTP
	err = db.Get(&existing, `SELECT phone, code_hash, attempts, expires_at, sent_at FROM store_otps WHERE phone=? LIMIT 1`, phone)
	if err == nil && now.Sub(existing.SentAt) < 60*time.Second {
		wait := int((60*time.Second - now.Sub(existing.SentAt)).Seconds()) + 1
		return fmt.Errorf("لطفاً %d ثانیه دیگر دوباره تلاش کنید", wait)
	}
	expires := now.Add(ttl)
	_, err = db.Exec(
		`INSERT INTO store_otps(phone, code_hash, attempts, expires_at, sent_at)
		 VALUES(?,?,0,?,?)
		 ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash), attempts=0, expires_at=VALUES(expires_at), sent_at=VALUES(sent_at)`,
		phone, hashOTP(phone, code), expires, now,
	)
	return err
}

func VerifyStoreOTP(db *sqlx.DB, phone, code string) error {
	phone, err := NormalizeIranPhone(phone)
	if err != nil {
		return err
	}
	code = strings.TrimSpace(code)
	if !regexp.MustCompile(`^\d{4,8}$`).MatchString(code) {
		return errors.New("کد تأیید معتبر نیست")
	}

	var row StoreOTP
	err = db.Get(&row, `SELECT phone, code_hash, attempts, expires_at, sent_at FROM store_otps WHERE phone=? LIMIT 1`, phone)
	if err != nil {
		return errors.New("کدی برای این شماره ارسال نشده است")
	}
	if time.Now().After(row.ExpiresAt) {
		_, _ = db.Exec(`DELETE FROM store_otps WHERE phone=?`, phone)
		return errors.New("کد منقضی شده است. دوباره ارسال کنید")
	}
	if row.Attempts >= 5 {
		return errors.New("تعداد تلاش بیش از حد مجاز است. دوباره کد بگیرید")
	}
	if row.CodeHash != hashOTP(phone, code) {
		_, _ = db.Exec(`UPDATE store_otps SET attempts = attempts + 1 WHERE phone=?`, phone)
		return errors.New("کد تأیید نادرست است")
	}
	_, _ = db.Exec(`DELETE FROM store_otps WHERE phone=?`, phone)
	return nil
}
