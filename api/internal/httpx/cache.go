package httpx

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CachePublic sets Cache-Control for read-only storefront responses.
// Browsers and reverse proxies can serve cached copies during traffic spikes.
func CachePublic(maxAgeSeconds int) gin.HandlerFunc {
	if maxAgeSeconds < 0 {
		maxAgeSeconds = 0
	}
	header := fmt.Sprintf("public, max-age=%d, stale-while-revalidate=60", maxAgeSeconds)
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet {
			c.Header("Cache-Control", header)
		}
		c.Next()
	}
}
