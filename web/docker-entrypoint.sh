#!/bin/sh
set -eu

API_BASE="${ABERANG_API_BASE_URL:-https://ns-xp45-default-accounting-api.bugx.ir/api}"
# strip trailing slash
API_BASE=$(printf '%s' "$API_BASE" | sed 's:/*$::')

cat > /usr/share/nginx/html/js/runtime-config.js <<EOF
// Generated at container start — do not edit.
window.ABERANG_API_BASE_URL = "${API_BASE}";
EOF

exec nginx -g "daemon off;"
