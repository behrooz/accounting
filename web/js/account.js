(function ($) {
  "use strict";

  function normalizePhone(value) {
    var digits = String(value || "")
      .replace(/[^\d+]/g, "")
      .replace(/^\+98/, "0")
      .replace(/^98/, "0");
    if (digits.length === 10 && digits.charAt(0) === "9") {
      digits = "0" + digits;
    }
    return digits;
  }

  function isValidPhone(phone) {
    return /^09\d{9}$/.test(phone);
  }

  function showGuestView() {
    $("#accountGuest").prop("hidden", false);
    $("#accountLoggedIn").prop("hidden", true);
  }

  function showLoggedInView(session) {
    $("#accountGuest").prop("hidden", true);
    $("#accountLoggedIn").prop("hidden", false);
    $("#accountUserPhone").text(session.phone || "");
    $("#accountUserName").text(session.name || "کاربر");
  }

  function finishLogin(customer) {
    AberangAuth.setSession({
      id: customer.id || "",
      phone: customer.phone || "",
      name: customer.name || ""
    });
    var redirect = new URLSearchParams(window.location.search).get("next");
    window.location.href = redirect || "index.html";
  }

  function initAccountPage() {
    if (!$("body").hasClass("page-account")) return;

    var session = AberangAuth.getSession();
    if (session && session.phone) {
      showLoggedInView(session);
    } else {
      showGuestView();
    }

    var lastPhone = localStorage.getItem(AberangAuth.PHONE_KEY) || "";
    if (lastPhone) {
      $("#loginPhone, #registerPhone").val(lastPhone);
    }

    $("#loginForm").on("submit", function (e) {
      e.preventDefault();
      var phone = normalizePhone($("#loginPhone").val());
      var $err = $("#loginError");
      if (!isValidPhone(phone)) {
        $err.text("شماره موبایل معتبر نیست (مثال: 09123456789).").prop("hidden", false);
        return;
      }
      $err.prop("hidden", true);
      var $btn = $("#loginSubmit");
      $btn.prop("disabled", true).text("در حال بررسی...");
      $.ajax({
        url: AberangAuth.apiBase() + "/store/customer",
        method: "GET",
        data: { phone: phone },
        dataType: "json"
      })
        .done(function (customer) {
          finishLogin(customer);
        })
        .fail(function (xhr) {
          if (xhr.status === 404) {
            $err.text("این شماره ثبت نشده است. از بخش عضویت استفاده کنید.").prop("hidden", false);
          } else {
            $err.text("خطا در ورود. دوباره تلاش کنید.").prop("hidden", false);
          }
        })
        .always(function () {
          $btn.prop("disabled", false).text("ورود با رمز عبور یکبار مصرف");
        });
    });

    $("#registerForm").on("submit", function (e) {
      e.preventDefault();
      var phone = normalizePhone($("#registerPhone").val());
      var $err = $("#registerError");
      if (!isValidPhone(phone)) {
        $err.text("شماره موبایل معتبر نیست (مثال: 09123456789).").prop("hidden", false);
        return;
      }
      $err.prop("hidden", true);
      var $btn = $("#registerSubmit");
      $btn.prop("disabled", true).text("در حال ثبت...");
      $.ajax({
        url: AberangAuth.apiBase() + "/store/register",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({ phone: phone }),
        dataType: "json"
      })
        .done(function (customer) {
          finishLogin(customer);
        })
        .fail(function (xhr) {
          var msg = "ثبت‌نام ناموفق بود.";
          try {
            msg = (xhr.responseJSON && xhr.responseJSON.error) || msg;
          } catch (err) {}
          $err.text(msg).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("عضویت");
        });
    });

    $("#logoutBtn").on("click", function () {
      AberangAuth.clearSession();
      showGuestView();
    });
  }

  $(function () {
    if (window.AberangAuth) {
      AberangAuth.wireAccountLinks();
    }
    initAccountPage();
  });
})(jQuery);
