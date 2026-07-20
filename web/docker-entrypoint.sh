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

# Refresh sitemap in the background so nginx (and probes) start immediately.
# Busybox wget: -T timeout seconds. Never block container startup on API reachability.
(
  tmp="/tmp/sitemap-refresh.xml"
  if wget -q -T 5 -O "$tmp" \
    "${API_BASE}/store/sitemap.xml?origin=${SITE_ORIGIN}" 2>/dev/null; then
    mv "$tmp" /usr/share/nginx/html/sitemap.xml
  else
    rm -f "$tmp"
  fi
) >/dev/null 2>&1 &

exec nginx -g "daemon off;"
