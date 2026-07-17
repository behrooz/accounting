(function (global) {
  "use strict";

  var SESSION_KEY = "aberang-customer-session";
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

  function setSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data || {}));
    if (data && data.phone) {
      localStorage.setItem(PHONE_KEY, data.phone);
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    var session = getSession();
    return !!(session && session.phone);
  }

  function accountHref() {
    return "account.html";
  }

  function wireAccountLinks() {
    $('a[href="#account"], a[href="index.html#account"]').attr("href", accountHref());
    $('a[aria-label="حساب کاربری"]').attr("href", accountHref());
    $(".bottom-nav-item").filter(function () {
      return $(this).text().trim().indexOf("حساب") >= 0;
    }).attr("href", accountHref());
  }

  global.AberangAuth = {
    SESSION_KEY: SESSION_KEY,
    PHONE_KEY: PHONE_KEY,
    apiBase: apiBase,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    accountHref: accountHref,
    wireAccountLinks: wireAccountLinks
  };
})(window);
