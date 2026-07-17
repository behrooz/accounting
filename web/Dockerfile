FROM nginx:1.27-alpine

RUN apk add --no-cache ca-certificates wget \
  && rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Non-root nginx (listen on 8080)
RUN printf '%s\n' \
  'worker_processes auto;' \
  'error_log /dev/stderr warn;' \
  'pid /tmp/nginx.pid;' \
  'events { worker_connections 1024; }' \
  'http {' \
  '  include /etc/nginx/mime.types;' \
  '  default_type application/octet-stream;' \
  '  sendfile on;' \
  '  keepalive_timeout 65;' \
  '  client_body_temp_path /tmp/client_temp;' \
  '  proxy_temp_path       /tmp/proxy_temp;' \
  '  fastcgi_temp_path     /tmp/fastcgi_temp;' \
  '  uwsgi_temp_path       /tmp/uwsgi_temp;' \
  '  scgi_temp_path        /tmp/scgi_temp;' \
  '  access_log /dev/stdout;' \
  '  include /etc/nginx/conf.d/*.conf;' \
  '}' > /etc/nginx/nginx.conf \
  && chmod +x /docker-entrypoint.sh \
  && mkdir -p /var/cache/nginx /tmp \
  && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /tmp /etc/nginx/conf.d

WORKDIR /usr/share/nginx/html
COPY --chown=nginx:nginx index.html shop.html product.html checkout.html account.html ./
COPY --chown=nginx:nginx css ./css
COPY --chown=nginx:nginx js ./js

ENV ABERANG_API_BASE_URL=https://ns-xp45-default-accounting-api.bugx.ir/api

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
