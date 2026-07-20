#!/bin/sh
set -eu

API_BASE="${ABERANG_API_BASE_URL:-https://ns-xp45-default-accounting-api.bugx.ir/api}"
SITE_ORIGIN="${ABERANG_SITE_ORIGIN:-https://abrangstyle.ir}"
# strip trailing slash
API_BASE=$(printf '%s' "$API_BASE" | sed 's:/*$::')
SITE_ORIGIN=$(printf '%s' "$SITE_ORIGIN" | sed 's:/*$::')

cat > /usr/share/nginx/html/js/runtime-config.js <<EOF
// Generated at container start — do not edit.
window.ABERANG_API_BASE_URL = "${API_BASE}";
window.ABERANG_SITE_ORIGIN = "${SITE_ORIGIN}";
EOF

# Prefer live product sitemap from API; fall back to static file on failure.
if wget -qO /usr/share/nginx/html/sitemap.xml \
  "${API_BASE}/store/sitemap.xml?origin=${SITE_ORIGIN}" 2>/dev/null; then
  :
else
  # keep packaged static sitemap.xml if fetch fails
  true
fi

exec nginx -g "daemon off;"
