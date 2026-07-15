// Storefront API base URL.
// Override anytime: window.ABERANG_API_BASE_URL = "http://127.0.0.1:8080/api"
(function () {
  if (window.ABERANG_API_BASE_URL) {
    window.ABERANG_API_BASE_URL = String(window.ABERANG_API_BASE_URL).replace(/\/$/, "");
    return;
  }
  var host = (window.location && window.location.hostname) || "127.0.0.1";
  if (!host || host === "null") host = "127.0.0.1";
  // Same hostname as the page (avoids localhost vs 127.0.0.1 vs ::1 mismatch).
  window.ABERANG_API_BASE_URL = ("http://" + host + ":8080/api").replace(/\/$/, "");
})();
