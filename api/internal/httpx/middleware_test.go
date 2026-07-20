package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCorsAllowsAbrangstyleOrigins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Cors("https://ns-xp45-default-accounting-front.bugx.ir"))
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	cases := []string{
		"https://abrangstyle.ir",
		"https://admin.abrangstyle.ir",
		"https://www.abrangstyle.ir",
		"https://shop.abrangstyle.ir",
	}
	for _, origin := range cases {
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		req.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("origin %s: status %d", origin, w.Code)
		}
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Fatalf("origin %s: Allow-Origin = %q, want %q", origin, got, origin)
		}
	}
}

func TestCorsRejectsUnrelatedOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Cors("https://ns-xp45-default-accounting-front.bugx.ir"))
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("unexpected Allow-Origin %q", got)
	}
}
