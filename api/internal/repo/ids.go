package repo

import (
	"crypto/rand"
	"encoding/hex"
)

// NewID returns a random UUID-like id (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	s := hex.EncodeToString(b)
	return s[0:8] + "-" + s[8:12] + "-" + s[12:16] + "-" + s[16:20] + "-" + s[20:32]
}
