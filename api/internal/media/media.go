package media

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/jmoiron/sqlx"
)

const ProductDir = "assets/product"

// EnsureDirs creates assets/product on disk.
func EnsureDirs() error {
	return os.MkdirAll(ProductDir, 0o755)
}

func newFileName(ext string) string {
	ext = strings.TrimPrefix(strings.ToLower(ext), ".")
	if ext == "" || ext == "jpeg" {
		ext = "jpg"
	}
	var b [16]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf(
		"%x-%x-%x-%x-%x.%s",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16], ext,
	)
}

// RelPath returns DB-stored relative path, e.g. assets/product/uuid.jpg
func RelPath(filename string) string {
	filename = filepath.Base(filename)
	return filepath.ToSlash(filepath.Join(ProductDir, filename))
}

// IsDataURL reports whether s is a base64 image data URL.
func IsDataURL(s string) bool {
	return strings.HasPrefix(s, "data:image/")
}

// IsStoredPath reports whether s looks like our on-disk product image path or bare filename.
func IsStoredPath(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" || IsDataURL(s) || strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
		return false
	}
	return true
}

// SaveBytes writes raw image bytes under assets/product and returns relative path.
func SaveBytes(data []byte, ext string) (string, error) {
	if err := EnsureDirs(); err != nil {
		return "", err
	}
	if len(data) == 0 {
		return "", fmt.Errorf("empty image")
	}
	name := newFileName(ext)
	rel := RelPath(name)
	abs := filepath.FromSlash(rel)
	if err := os.WriteFile(abs, data, 0o644); err != nil {
		return "", err
	}
	return rel, nil
}

// SaveUpload saves an uploaded file stream.
func SaveUpload(r io.Reader, contentType, originalName string) (string, error) {
	data, err := io.ReadAll(io.LimitReader(r, 12<<20)) // 12MB
	if err != nil {
		return "", err
	}
	ext := extFromContentType(contentType)
	if ext == "" {
		ext = strings.TrimPrefix(filepath.Ext(originalName), ".")
	}
	if ext == "" {
		ext = "jpg"
	}
	return SaveBytes(data, ext)
}

// SaveDataURL decodes a data:image/...;base64,... URL to disk.
func SaveDataURL(dataURL string) (string, error) {
	comma := strings.IndexByte(dataURL, ',')
	if comma < 0 {
		return "", fmt.Errorf("invalid data url")
	}
	meta := dataURL[:comma]
	payload := dataURL[comma+1:]
	ext := "jpg"
	if i := strings.Index(meta, "image/"); i >= 0 {
		rest := meta[i+len("image/"):]
		if j := strings.IndexByte(rest, ';'); j >= 0 {
			rest = rest[:j]
		}
		if rest != "" {
			ext = rest
		}
	}
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		// try raw url-encoding-ish / URLEncoding
		raw, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return "", err
		}
	}
	return SaveBytes(raw, ext)
}

// NormalizeImageRef ensures a string is a stored path (converts data URLs).
func NormalizeImageRef(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", nil
	}
	if IsDataURL(s) {
		return SaveDataURL(s)
	}
	// already a path or external URL — keep as-is (strip leading slash for our assets)
	s = strings.TrimPrefix(s, "/")
	if strings.HasPrefix(s, ProductDir+"/") || !strings.Contains(s, "/") {
		if !strings.Contains(s, "/") {
			s = RelPath(s)
		}
		return filepath.ToSlash(s), nil
	}
	return s, nil
}

// DeleteFile removes a product image file if it lives under assets/product.
func DeleteFile(rel string) {
	rel = strings.TrimPrefix(strings.TrimSpace(rel), "/")
	if !strings.HasPrefix(rel, ProductDir+"/") {
		return
	}
	_ = os.Remove(filepath.FromSlash(rel))
}

func extFromContentType(ct string) string {
	ct = strings.TrimSpace(strings.Split(ct, ";")[0])
	if ct == "" {
		return ""
	}
	exts, _ := mime.ExtensionsByType(ct)
	if len(exts) > 0 {
		return strings.TrimPrefix(exts[0], ".")
	}
	switch ct {
	case "image/jpeg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	default:
		return ""
	}
}

// DetectContentType peeks bytes for sniffer (optional).
func DetectContentType(data []byte) string {
	return http.DetectContentType(data)
}

// MigrateBase64Images converts existing data-URL rows to files and shrinks columns.
func MigrateBase64Images(db *sqlx.DB) error {
	if err := EnsureDirs(); err != nil {
		return err
	}

	type row struct {
		ID    string `db:"id"`
		Image string `db:"image"`
	}

	var imgs []row
	if err := db.Select(&imgs, `SELECT id, image FROM product_images WHERE image LIKE 'data:image/%'`); err != nil {
		return err
	}
	for _, r := range imgs {
		path, err := SaveDataURL(r.Image)
		if err != nil {
			return fmt.Errorf("product_images %s: %w", r.ID, err)
		}
		if _, err := db.Exec(`UPDATE product_images SET image=? WHERE id=?`, path, r.ID); err != nil {
			return err
		}
	}

	var vars []row
	if err := db.Select(&vars, `SELECT id, image FROM product_variants WHERE image LIKE 'data:image/%'`); err != nil {
		return err
	}
	for _, r := range vars {
		path, err := SaveDataURL(r.Image)
		if err != nil {
			return fmt.Errorf("product_variants %s: %w", r.ID, err)
		}
		if _, err := db.Exec(`UPDATE product_variants SET image=? WHERE id=?`, path, r.ID); err != nil {
			return err
		}
	}
	return nil
}
