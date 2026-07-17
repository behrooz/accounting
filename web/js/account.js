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

  function formatPrice(n) {
    return Number(n || 0).toLocaleString("fa-IR") + " تومان";
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return String(iso).slice(0, 10);
  }

  function statusLabel(status) {
    return status === "confirmed" ? "تأیید‌شده" : "پیش‌نویس";
  }

  function apiError(xhr, fallback) {
    try {
      return (xhr.responseJSON && xhr.responseJSON.error) || fallback;
    } catch (e) {
      return fallback;
    }
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

  function renderOrders(orders) {
    var $list = $("#ordersList");
    if (!orders || !orders.length) {
      $list.html('<p class="account-empty">هنوز سفارشی ثبت نکرده‌اید.</p>');
      return;
    }

    $list.html(
      orders
        .map(function (order) {
          var itemsCount = (order.items || []).length;
          var source =
            order.source === "storefront"
              ? "سفارش فروشگاه"
              : order.source || "فاکتور";
          return (
            '<article class="account-order-card">' +
            '<div class="account-order-head">' +
            "<strong>" +
            (order.number || "—") +
            "</strong>" +
            '<span class="account-badge">' +
            statusLabel(order.status) +
            "</span>" +
            "</div>" +
            '<p class="account-order-meta">تاریخ: ' +
            formatDate(order.date) +
            " · " +
            source +
            "</p>" +
            '<p class="account-order-meta">تعداد اقلام: ' +
            itemsCount.toLocaleString("fa-IR") +
            "</p>" +
            (order.shippingMethod
              ? '<p class="account-order-meta">ارسال: ' + order.shippingMethod + "</p>"
              : "") +
            '<p class="account-order-total">' +
            formatPrice(order.total) +
            "</p>" +
            "</article>"
          );
        })
        .join("")
    );
  }

  function renderAddresses(addresses) {
    var $list = $("#addressesList");
    if (!addresses || !addresses.length) {
      $list.html(
        '<p class="account-empty">آدرسی ذخیره نشده است. هنگام ثبت سفارش می‌توانید آدرس جدید اضافه کنید.</p>'
      );
      return;
    }

    $list.html(
      addresses
        .map(function (addr) {
          var line = [addr.province, addr.city, addr.address]
            .filter(Boolean)
            .join("، ");
          return (
            '<article class="account-address-card' +
            (addr.isDefault ? " is-default" : "") +
            '">' +
            "<strong>" +
            (addr.title || "آدرس") +
            (addr.isDefault ? " <em>پیش‌فرض</em>" : "") +
            "</strong>" +
            (addr.fullName ? "<p>" + addr.fullName + "</p>" : "") +
            (addr.phone ? '<p dir="ltr">' + addr.phone + "</p>" : "") +
            "<p>" +
            line +
            (addr.postalCode ? " · کدپستی " + addr.postalCode : "") +
            "</p>" +
            "</article>"
          );
        })
        .join("")
    );
  }

  function loadAccountDashboard(phone) {
    phone = normalizePhone(phone);
    if (!phone) return;

    $("#ordersList").html('<p class="account-loading">در حال بارگذاری سفارش‌ها...</p>');
    $("#addressesList").html('<p class="account-loading">در حال بارگذاری آدرس‌ها...</p>');

    $.when(
      $.ajax({
        url: AberangAuth.apiBase() + "/store/customer",
        method: "GET",
        data: { phone: phone },
        dataType: "json"
      }),
      $.ajax({
        url: AberangAuth.apiBase() + "/store/orders",
        method: "GET",
        data: { phone: phone },
        dataType: "json"
      })
    )
      .done(function (customerResp, ordersResp) {
        var customer = customerResp[0];
        var orders = ordersResp[0];
        AberangAuth.setSession({
          id: customer.id || "",
          phone: customer.phone || phone,
          name: customer.name || ""
        });
        showLoggedInView(AberangAuth.getSession());
        renderOrders(Array.isArray(orders) ? orders : []);
        renderAddresses(customer.addresses || []);
      })
      .fail(function () {
        AberangAuth.clearSession();
        showGuestView();
        alert("نشست شما منقضی شده. دوباره وارد شوید.");
      });
  }

  function finishLogin(customer) {
    AberangAuth.setSession({
      id: customer.id || "",
      phone: customer.phone || "",
      name: customer.name || ""
    });
    loadAccountDashboard(customer.phone);
  }

  function sendCode(opts) {
    return $.ajax({
      url: AberangAuth.apiBase() + "/store/auth/send-code",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ phone: opts.phone, mode: opts.mode }),
      dataType: "json"
    });
  }

  function verifyCode(opts) {
    return $.ajax({
      url: AberangAuth.apiBase() + "/store/auth/verify-code",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        phone: opts.phone,
        code: opts.code,
        mode: opts.mode,
        name: opts.name || ""
      }),
      dataType: "json"
    });
  }

  function initAccountPage() {
    if (!$("body").hasClass("page-account")) return;

    var loginState = { phone: "", mode: "login" };
    var registerState = { phone: "", mode: "register", name: "" };

    var session = AberangAuth.getSession();
    if (session && session.phone) {
      showLoggedInView(session);
      loadAccountDashboard(session.phone);
    } else {
      showGuestView();
    }

    var lastPhone = localStorage.getItem(AberangAuth.PHONE_KEY) || "";
    if (lastPhone) {
      $("#loginPhone, #registerPhone").val(lastPhone);
    }

    function showLoginCodeStep(msg) {
      $("#loginPhoneForm").prop("hidden", true);
      $("#loginCodeForm").prop("hidden", false);
      $("#loginError").prop("hidden", true);
      $("#loginOk").text(msg || "کد تأیید ارسال شد.").prop("hidden", false);
      $("#loginCode").val("").trigger("focus");
    }

    function showLoginPhoneStep() {
      $("#loginPhoneForm").prop("hidden", false);
      $("#loginCodeForm").prop("hidden", true);
      $("#loginOk, #loginError, #loginCodeError").prop("hidden", true);
    }

    function showRegisterCodeStep(msg) {
      $("#registerPhoneForm").prop("hidden", true);
      $("#registerCodeForm").prop("hidden", false);
      $("#registerError").prop("hidden", true);
      $("#registerOk").text(msg || "کد تأیید ارسال شد.").prop("hidden", false);
      $("#registerCode").val("").trigger("focus");
    }

    function showRegisterPhoneStep() {
      $("#registerPhoneForm").prop("hidden", false);
      $("#registerCodeForm").prop("hidden", true);
      $("#registerOk, #registerError, #registerCodeError").prop("hidden", true);
    }

    $("#loginPhoneForm").on("submit", function (e) {
      e.preventDefault();
      var phone = normalizePhone($("#loginPhone").val());
      var $err = $("#loginError");
      var $ok = $("#loginOk");
      $ok.prop("hidden", true);
      if (!isValidPhone(phone)) {
        $err.text("شماره موبایل معتبر نیست (مثال: 09123456789).").prop("hidden", false);
        return;
      }
      $err.prop("hidden", true);
      var $btn = $("#loginSendBtn");
      $btn.prop("disabled", true).text("در حال ارسال...");
      sendCode({ phone: phone, mode: "login" })
        .done(function (res) {
          loginState.phone = res.phone || phone;
          var msg = "کد تأیید به " + loginState.phone + " ارسال شد.";
          if (res.debugCode) msg += " (کد آزمایشی: " + res.debugCode + ")";
          showLoginCodeStep(msg);
        })
        .fail(function (xhr) {
          $err.text(apiError(xhr, "ارسال کد ناموفق بود.")).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("ارسال کد تأیید");
        });
    });

    $("#loginCodeForm").on("submit", function (e) {
      e.preventDefault();
      var code = String($("#loginCode").val() || "").trim();
      var $err = $("#loginCodeError");
      if (!/^\d{4,8}$/.test(code)) {
        $err.text("کد تأیید را درست وارد کنید.").prop("hidden", false);
        return;
      }
      $err.prop("hidden", true);
      var $btn = $("#loginVerifyBtn");
      $btn.prop("disabled", true).text("در حال بررسی...");
      verifyCode({ phone: loginState.phone, code: code, mode: "login" })
        .done(function (customer) {
          finishLogin(customer);
        })
        .fail(function (xhr) {
          $err.text(apiError(xhr, "کد نادرست است.")).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("تأیید و ورود");
        });
    });

    $("#loginResendBtn").on("click", function () {
      if (!loginState.phone) return;
      var $btn = $(this);
      $btn.prop("disabled", true).text("در حال ارسال...");
      sendCode({ phone: loginState.phone, mode: "login" })
        .done(function (res) {
          var msg = "کد جدید ارسال شد.";
          if (res.debugCode) msg += " (کد آزمایشی: " + res.debugCode + ")";
          $("#loginOk").text(msg).prop("hidden", false);
          $("#loginCodeError").prop("hidden", true);
        })
        .fail(function (xhr) {
          $("#loginCodeError").text(apiError(xhr, "ارسال مجدد ناموفق بود.")).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("ارسال مجدد کد");
        });
    });

    $("#loginChangePhoneBtn").on("click", showLoginPhoneStep);

    $("#registerPhoneForm").on("submit", function (e) {
      e.preventDefault();
      var phone = normalizePhone($("#registerPhone").val());
      var name = String($("#registerName").val() || "").trim();
      var $err = $("#registerError");
      var $ok = $("#registerOk");
      $ok.prop("hidden", true);
      if (!isValidPhone(phone)) {
        $err.text("شماره موبایل معتبر نیست (مثال: 09123456789).").prop("hidden", false);
        return;
      }
      $err.prop("hidden", true);
      var $btn = $("#registerSendBtn");
      $btn.prop("disabled", true).text("در حال ارسال...");
      sendCode({ phone: phone, mode: "register" })
        .done(function (res) {
          registerState.phone = res.phone || phone;
          registerState.name = name;
          var msg = "کد تأیید به " + registerState.phone + " ارسال شد.";
          if (res.debugCode) msg += " (کد آزمایشی: " + res.debugCode + ")";
          showRegisterCodeStep(msg);
        })
        .fail(function (xhr) {
          $err.text(apiError(xhr, "ارسال کد ناموفق بود.")).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("ارسال کد تأیید");
        });
    });

    $("#registerCodeForm").on("submit", function (e) {
      e.preventDefault();
      var code = String($("#registerCode").val() || "").trim();
      var $err = $("#registerCodeError");
      if (!/^\d{4,8}$/.test(code)) {
        $err.text("کد تأیید را درست وارد کنید.").prop("hidden", false);
        return;
      }
      $err.prop("hidden", true);
      var $btn = $("#registerVerifyBtn");
      $btn.prop("disabled", true).text("در حال بررسی...");
      verifyCode({
        phone: registerState.phone,
        code: code,
        mode: "register",
        name: registerState.name
      })
        .done(function (customer) {
          finishLogin(customer);
        })
        .fail(function (xhr) {
          $err.text(apiError(xhr, "کد نادرست است.")).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("تأیید و عضویت");
        });
    });

    $("#registerResendBtn").on("click", function () {
      if (!registerState.phone) return;
      var $btn = $(this);
      $btn.prop("disabled", true).text("در حال ارسال...");
      sendCode({ phone: registerState.phone, mode: "register" })
        .done(function (res) {
          var msg = "کد جدید ارسال شد.";
          if (res.debugCode) msg += " (کد آزمایشی: " + res.debugCode + ")";
          $("#registerOk").text(msg).prop("hidden", false);
          $("#registerCodeError").prop("hidden", true);
        })
        .fail(function (xhr) {
          $("#registerCodeError").text(apiError(xhr, "ارسال مجدد ناموفق بود.")).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("ارسال مجدد کد");
        });
    });

    $("#registerChangePhoneBtn").on("click", showRegisterPhoneStep);

    $("#logoutBtn").on("click", function () {
      AberangAuth.clearSession();
      showGuestView();
      showLoginPhoneStep();
      showRegisterPhoneStep();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  $(function () {
    if (window.AberangAuth) {
      AberangAuth.wireAccountLinks();
    }
    initAccountPage();
  });
})(jQuery);
