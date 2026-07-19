package media

import (
	"bytes"
	"crypto/sha256"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveUploadPreservesOriginalImageBytesAndType(t *testing.T) {
	original := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	}
	originalHash := sha256.Sum256(original)
	previousDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	tempDir := t.TempDir()
	if err := os.Chdir(tempDir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(previousDir) })

	storedPath, err := SaveUpload(
		bytes.NewReader(original),
		"image/png",
		"original-image.png",
	)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.EqualFold(filepath.Ext(storedPath), ".png") {
		t.Fatalf("expected PNG extension, got %q", storedPath)
	}
	stored, err := os.ReadFile(filepath.FromSlash(storedPath))
	if err != nil {
		t.Fatal(err)
	}
	if storedHash := sha256.Sum256(stored); storedHash != originalHash {
		t.Fatal("uploaded image bytes changed")
	}
}
