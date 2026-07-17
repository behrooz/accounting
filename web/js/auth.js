(function (global) {
  "use strict";

  var SESSION_KEY = "aberang-customer-session";
  var TOKEN_KEY = "aberang-customer-token";
  var PHONE_KEY = "aberang-last-phone";

  function apiBase() {
    return global.ABERANG_API_BASE_URL || "http://localhost:8080/api";
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setSession(data, token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data || {}));
    if (data && data.phone) {
      localStorage.setItem(PHONE_KEY, data.phone);
    }
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function isLoggedIn() {
    var session = getSession();
    return !!(getToken() && session && session.phone);
  }

  function authHeaders() {
    var token = getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }

  function loginUrl(next) {
    var href = "account.html";
    if (next) {
      href += "?next=" + encodeURIComponent(next);
    }
    return href;
  }

  function accountHref() {
    return "account.html";
  }

  function requireLogin(nextPage) {
    if (isLoggedIn()) return true;
    global.location.replace(loginUrl(nextPage || "checkout.html"));
    return false;
  }

  function wireAccountLinks() {
    $('a[href="#account"], a[href="index.html#account"]').attr("href", accountHref());
    $('a[aria-label="حساب کاربری"]').attr("href", accountHref());
    $(".bottom-nav-item")
      .filter(function () {
        return $(this).text().trim().indexOf("حساب") >= 0;
      })
      .attr("href", accountHref());
  }

  global.AberangAuth = {
    SESSION_KEY: SESSION_KEY,
    TOKEN_KEY: TOKEN_KEY,
    PHONE_KEY: PHONE_KEY,
    apiBase: apiBase,
    getSession: getSession,
    getToken: getToken,
    setSession: setSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    authHeaders: authHeaders,
    loginUrl: loginUrl,
    accountHref: accountHref,
    requireLogin: requireLogin,
    wireAccountLinks: wireAccountLinks
  };
})(window);
