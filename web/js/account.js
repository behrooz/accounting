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
            (addr.isDefault ? ' <em>پیش‌فرض</em>' : "") +
            "</strong>" +
            (addr.fullName ? "<p>" + addr.fullName + "</p>" : "") +
            (addr.phone
              ? '<p dir="ltr">' + addr.phone + "</p>"
              : "") +
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

  function initAccountPage() {
    if (!$("body").hasClass("page-account")) return;

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
