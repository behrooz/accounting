#!/usr/bin/env python3
"""Static storefront + /api reverse-proxy (avoids browser CORS).

Usage (from web/):
  python3 serve.py
  # open http://127.0.0.1:5500
"""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
import urllib.error
import urllib.request

PORT = int(os.environ.get("WEB_PORT", "5500"))
API = os.environ.get("API_ORIGIN", "http://127.0.0.1:8080").rstrip("/")


class Handler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        if self.path.startswith("/api"):
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        super().do_OPTIONS()

    def do_GET(self):
        if self.path.startswith("/api"):
            self._proxy()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api"):
            self._proxy()
            return
        self.send_error(405)

    def do_PUT(self):
        if self.path.startswith("/api"):
            self._proxy()
            return
        self.send_error(405)

    def do_PATCH(self):
        if self.path.startswith("/api"):
            self._proxy()
            return
        self.send_error(405)

    def do_DELETE(self):
        if self.path.startswith("/api"):
            self._proxy()
            return
        self.send_error(405)

    def _cors(self):
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def _proxy(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None
        url = API + self.path
        req = urllib.request.Request(url, data=body, method=self.command)
        for key in ("Content-Type", "Authorization"):
            val = self.headers.get(key)
            if val:
                req.add_header(key, val)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    kl = k.lower()
                    if kl in ("transfer-encoding", "connection", "content-encoding"):
                        continue
                    self.send_header(k, v)
                self._cors()
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "application/json"))
            self._cors()
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self._cors()
            self.end_headers()
            self.wfile.write(msg)


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")
    print(f"Storefront http://127.0.0.1:{PORT}  (proxy {API}/api → API)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
