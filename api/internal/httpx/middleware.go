package httpx

import (
	"net/http"
	"net/url"
	"strings"

	"accounting-api/internal/auth"
	"github.com/gin-gonic/gin"
)

const CtxUserKey = "user"

type SessionUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func AuthRequired(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if h == "" || !strings.HasPrefix(strings.ToLower(h), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		token := strings.TrimSpace(h[len("Bearer "):])
		claims, err := auth.Parse(jwtSecret, token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set(CtxUserKey, SessionUser{ID: claims.UserID, Username: claims.Username, Role: claims.Role})
		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		u, ok := c.Get(CtxUserKey)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		user := u.(SessionUser)
		if !allowed[user.Role] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

func Cors(originsCSV string) gin.HandlerFunc {
	allowed := map[string]bool{}
	allowAny := false
	for _, o := range strings.Split(originsCSV, ",") {
		o = strings.TrimSpace(o)
		if o == "" {
			continue
		}
		if o == "*" {
			allowAny = true
			continue
		}
		allowed[o] = true
	}
	// Empty / unset list → allow any (local storefront + dashboard)
	if len(allowed) == 0 {
		allowAny = true
	}

	return func(c *gin.Context) {
		origin := strings.TrimSpace(c.GetHeader("Origin"))

		allow := ""
		switch {
		case origin != "" && (allowAny || allowed[origin] || isLocalDevOrigin(origin)):
			// Always echo Origin — browsers reject "*" when credentials are used.
			allow = origin
		case origin == "" && allowAny:
			allow = "*"
		case origin != "" && len(allowed) == 1 && !allowAny:
			for o := range allowed {
				allow = o
				break
			}
		}

		if allow != "" {
			c.Header("Access-Control-Allow-Origin", allow)
			c.Header("Vary", "Origin")
			if allow != "*" {
				c.Header("Access-Control-Allow-Credentials", "true")
			}
		}
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func isLocalDevOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(u.Hostname())
	switch host {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}
