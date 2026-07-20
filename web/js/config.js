// Storefront API base URL.
// Override anytime: window.ABERANG_API_BASE_URL = "http://127.0.0.1:8080/api"
(function () {
  if (window.ABERANG_API_BASE_URL) {
    window.ABERANG_API_BASE_URL = String(window.ABERANG_API_BASE_URL).replace(
      /\/$/,
      "",
    );
  } else {
    var host = (window.location && window.location.hostname) || "127.0.0.1";
    if (!host || host === "null") host = "127.0.0.1";
    window.ABERANG_API_BASE_URL = ("http://" + host + ":8080/api").replace(
      /\/$/,
      "",
    );
  }
  window.ABERANG_API_ORIGIN = String(window.ABERANG_API_BASE_URL).replace(
    /\/api\/?$/,
    "",
  );

  if (!window.ABERANG_SITE_ORIGIN) {
    var proto =
      window.location && window.location.protocol === "http:"
        ? "http:"
        : "https:";
    var hostname =
      (window.location && window.location.hostname) || "abrangstyle.ir";
    if (
      !hostname ||
      hostname === "null" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    ) {
      window.ABERANG_SITE_ORIGIN = "https://abrangstyle.ir";
    } else {
      window.ABERANG_SITE_ORIGIN = proto + "//" + hostname;
    }
  } else {
    window.ABERANG_SITE_ORIGIN = String(window.ABERANG_SITE_ORIGIN).replace(
      /\/$/,
      "",
    );
  }

  window.ABERANG_MEDIA_URL = function (path) {
    if (!path) return "";
    var s = String(path).trim();
    if (!s) return "";
    if (
      s.indexOf("data:") === 0 ||
      s.indexOf("http://") === 0 ||
      s.indexOf("https://") === 0 ||
      s.indexOf("blob:") === 0
    ) {
      return s;
    }
    return window.ABERANG_API_ORIGIN + "/" + s.replace(/^\//, "");
  };

  // After receiving eNamad, set id + code from enamad.ir panel to show the seal.
  // Example: { id: "123456", code: "ABCDEF..." }
  if (!window.ABERANG_ENAMAD) {
    window.ABERANG_ENAMAD = { id: "", code: "" };
  }
})();
