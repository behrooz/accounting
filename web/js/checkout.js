(function ($) {
  "use strict";

  var PHONE_KEY = "aberang-last-phone";
  var PROVINCES = [
    "تهران", "البرز", "اصفهان", "فارس", "خراسان رضوی", "آذربایجان شرقی",
    "آذربایجان غربی", "گیلان", "مازندران", "خوزستان", "کرمان", "یزد",
    "قم", "قزوین", "همدان", "کرمانشاه", "کردستان", "لرستان", "مرکزی",
    "سمنان", "زنجان", "اردبیل", "گلستان", "بوشهر", "هرمزگان", "سیستان و بلوچستان",
    "چهارمحال و بختیاری", "کهگیلویه و بویراحمد", "ایلام", "خراسان شمالی", "خراسان جنوبی"
  ];

  function apiBase() {
    return window.ABERANG_API_BASE_URL || "http://localhost:8080/api";
  }

  function formatPrice(n) {
    return Number(n || 0).toLocaleString("fa-IR") + " تومان";
  }

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem("aberang-cart") || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem("aberang-cart", JSON.stringify(items));
  }

  function cartTotal(items) {
    return items.reduce(function (s, i) {
      return s + Number(i.price || 0) * Number(i.qty || 0);
    }, 0);
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function fillProvinces() {
    var $sel = $("#provinceSelect");
    if (!$sel.length) return;
    $sel.html(
      PROVINCES.map(function (p) {
        return '<option value="' + p + '"' + (p === "تهران" ? " selected" : "") + ">" + p + "</option>";
      }).join("")
    );
  }

  function selectedShipping() {
    var $r = $('input[name="shipping"]:checked');
    return {
      method: $r.val() || "pishtaz",
      fee: Number($r.data("fee")) || 0
    };
  }

  function renderOrder(items) {
    var sub = cartTotal(items);
    var ship = selectedShipping();
    $("#orderLines").html(
      items
        .map(function (i) {
          var title = i.name + (i.variantLabel ? " — " + i.variantLabel : "");
          return (
            "<tr><td>" +
            title +
            " <span class=\"qty\">× " +
            Number(i.qty).toLocaleString("fa-IR") +
            "</span></td><td>" +
            formatPrice(i.price * i.qty) +
            "</td></tr>"
          );
        })
        .join("")
    );
    $("#orderSubtotal").text(formatPrice(sub));
    $("#orderGrandTotal").text(formatPrice(sub + ship.fee));
  }

  function renderAddresses(list) {
    var $wrap = $("#savedAddresses");
    if (!list || !list.length) {
      $wrap.prop("hidden", true).empty();
      return;
    }
    $wrap.prop("hidden", false).html(
      '<p class="addr-heading">آدرس‌های ذخیره‌شده</p>' +
        list
          .map(function (a) {
            return (
              '<label class="addr-card' +
              (a.isDefault ? " is-default" : "") +
              '">' +
              '<input type="radio" name="addressId" value="' +
              a.id +
              '"' +
              (a.isDefault ? " checked" : "") +
              " />" +
              "<div>" +
              "<strong>" +
              (a.title || "آدرس") +
              (a.isDefault ? ' <em>پیش‌فرض</em>' : "") +
              "</strong>" +
              "<span>" +
              [a.province, a.city, a.address].filter(Boolean).join("، ") +
              "</span>" +
              '<button type="button" class="addr-default-btn" data-id="' +
              a.id +
              '">انتخاب به‌عنوان پیش‌فرض</button>' +
              "</div></label>"
            );
          })
          .join("") +
        '<button type="button" class="addr-new-btn" id="useNewAddress">وارد کردن آدرس جدید</button>'
    );
  }

  function applyAddress(a) {
    if (!a) return;
    var $f = $("#checkoutPageForm");
    $f.find('[name="fullName"]').val(a.fullName || "");
    $f.find('[name="phone"]').val(a.phone || localStorage.getItem(PHONE_KEY) || "");
    $f.find('[name="province"]').val(a.province || "تهران");
    $f.find('[name="city"]').val(a.city || "");
    $f.find('[name="address"]').val(a.address || "");
    $f.find('[name="postalCode"]').val(a.postalCode || "");
  }

  function loadCustomerByPhone(phone) {
    phone = String(phone || "").trim();
    if (!phone) return;
    localStorage.setItem(PHONE_KEY, phone);
    $.ajax({
      url: apiBase() + "/store/customer",
      method: "GET",
      data: { phone: phone },
      dataType: "json"
    })
      .done(function (cust) {
        if (cust.name) {
          $("#checkoutPageForm").find('[name="fullName"]').val(cust.name);
        }
        renderAddresses(cust.addresses || []);
        var def = (cust.addresses || []).find(function (a) {
          return a.isDefault;
        }) || (cust.addresses || [])[0];
        applyAddress(def);
      })
      .fail(function () {
        renderAddresses([]);
      });
  }

  function initCheckoutPage() {
    if (!$("#checkoutPageForm").length) return;

    if (window.AberangAuth && !AberangAuth.requireLogin("checkout.html")) {
      return;
    }

    fillProvinces();
    var items = getCart();
    if (!items.length) {
      $("#checkoutEmpty").prop("hidden", false);
      $("#checkoutPageForm").prop("hidden", true);
      return;
    }
    $("#checkoutEmpty").prop("hidden", true);
    $("#checkoutPageForm").prop("hidden", false);
    renderOrder(items);

    var session = window.AberangAuth ? AberangAuth.getSession() : null;
    var lastPhone =
      (session && session.phone) || localStorage.getItem(PHONE_KEY) || "";
    if (lastPhone) {
      $("#checkoutPageForm").find('[name="phone"]').val(lastPhone);
      loadCustomerByPhone(lastPhone);
    }
    if (session && session.name) {
      $("#checkoutPageForm").find('[name="fullName"]').val(session.name);
    }

    $(document).on("change", 'input[name="shipping"]', function () {
      renderOrder(getCart());
    });

    $(document).on("change", 'input[name="addressId"]', function () {
      var id = $(this).val();
      var phone = $("#checkoutPageForm").find('[name="phone"]').val();
      $.ajax({
        url: apiBase() + "/store/customer",
        data: { phone: phone },
        dataType: "json"
      }).done(function (cust) {
        var a = (cust.addresses || []).find(function (x) {
          return x.id === id;
        });
        applyAddress(a);
      });
    });

    $(document).on("click", ".addr-default-btn", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = $(this).data("id");
      var phone = String($("#checkoutPageForm").find('[name="phone"]').val() || "").trim();
      if (!phone) return;
      $.ajax({
        url: apiBase() + "/store/addresses/" + encodeURIComponent(id) + "/default",
        method: "PUT",
        contentType: "application/json",
        data: JSON.stringify({ phone: phone }),
        dataType: "json"
      }).done(function (cust) {
        renderAddresses(cust.addresses || []);
        var def = (cust.addresses || []).find(function (a) {
          return a.isDefault;
        });
        applyAddress(def);
      });
    });

    $(document).on("click", "#useNewAddress", function () {
      $('input[name="addressId"]').prop("checked", false);
      $("#checkoutPageForm").find('[name="address"]').val("").trigger("focus");
      $("#checkoutPageForm").find('[name="city"]').val("");
      $("#checkoutPageForm").find('[name="postalCode"]').val("");
    });

    $("#checkoutPageForm")
      .find('[name="phone"]')
      .on("blur", function () {
        loadCustomerByPhone($(this).val());
      });

    $("#checkoutPageForm").on("submit", function (e) {
      e.preventDefault();
      var items = getCart();
      if (!items.length) return;

      var missing = items.filter(function (i) {
        return !i.variantId;
      });
      if (missing.length) {
        $("#checkoutPageError")
          .text("برای بعضی اقلام ترکیب ویژگی مشخص نیست. از صفحه محصول دوباره انتخاب کنید.")
          .prop("hidden", false);
        return;
      }

      var $f = $(this);
      var ship = selectedShipping();
      var payment = $('input[name="payment"]:checked').val() || "saman";
      var selectedAddrId = $('input[name="addressId"]:checked').val() || "";
      var saveAddr = $f.find('[name="saveAddress"]').is(":checked");
      var fullName = String($f.find('[name="fullName"]').val() || "").trim();
      var phone = String($f.find('[name="phone"]').val() || "").trim();
      var province = String($f.find('[name="province"]').val() || "").trim();
      var city = String($f.find('[name="city"]').val() || "").trim();
      var address = String($f.find('[name="address"]').val() || "").trim();
      var postalCode = String($f.find('[name="postalCode"]').val() || "").trim();
      var notes = String($f.find('[name="notes"]').val() || "").trim();

      if (!fullName || !phone || !address || !city || !province) {
        $("#checkoutPageError").text("نام، موبایل، استان، شهر و آدرس الزامی است.").prop("hidden", false);
        return;
      }

      var payload = {
        customer: {
          name: fullName,
          phone: phone,
          address: [province, city, address].join("، ")
        },
        notes: notes,
        shippingMethod: ship.method,
        shippingFee: ship.fee,
        paymentMethod: payment,
        items: items.map(function (i) {
          return {
            productId: i.productId || i.id,
            variantId: i.variantId,
            quantity: i.qty
          };
        })
      };

      if (selectedAddrId && !$("#useNewAddress").data("forced-new")) {
        payload.addressId = selectedAddrId;
      } else {
        payload.address = {
          id: newId(),
          title: "آدرس " + city,
          fullName: fullName,
          phone: phone,
          province: province,
          city: city,
          address: address,
          postalCode: postalCode,
          isDefault: true,
          save: saveAddr
        };
      }

      var $btn = $("#checkoutPlaceBtn");
      var $err = $("#checkoutPageError");
      $btn.prop("disabled", true).text("در حال ثبت...");
      $err.prop("hidden", true);
      localStorage.setItem(PHONE_KEY, phone);

      $.ajax({
        url: apiBase() + "/checkout",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify(payload),
        dataType: "json"
      })
        .done(function (inv) {
          saveCart([]);
          if (typeof window.renderCart === "function") window.renderCart();
          alert(
            "سفارش ثبت شد.\nشماره فاکتور: " +
              (inv && inv.number ? inv.number : "") +
              "\nمبلغ قابل پرداخت: " +
              formatPrice(inv.total) +
              "\nدر داشبورد → فاکتورها / سفارش‌ها قابل مشاهده است."
          );
          window.location.href = "index.html";
        })
        .fail(function (xhr) {
          var msg = "ثبت سفارش ناموفق بود.";
          try {
            msg = (xhr.responseJSON && xhr.responseJSON.error) || msg;
          } catch (err) {}
          $err.text(msg).prop("hidden", false);
        })
        .always(function () {
          $btn.prop("disabled", false).text("ثبت سفارش");
        });
    });
  }

  $(initCheckoutPage);
})(jQuery);
