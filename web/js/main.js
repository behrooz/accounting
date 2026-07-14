(function ($) {
  "use strict";

  var CART_KEY = "aberang-cart";

  function formatPrice(n) {
    return Number(n || 0).toLocaleString("fa-IR") + " تومان";
  }

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    renderCart();
  }

  function addToCart(product, color) {
    var items = getCart();
    var key = product.id + "::" + (color || "");
    var existing = items.find(function (i) {
      return i.key === key;
    });
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({
        key: key,
        id: product.id,
        name: product.name,
        price: product.salePrice || product.price,
        image: product.image,
        color: color || "",
        qty: 1
      });
    }
    saveCart(items);
    openCart();
  }

  function removeFromCart(key) {
    saveCart(
      getCart().filter(function (i) {
        return i.key !== key;
      })
    );
  }

  function cartCount() {
    return getCart().reduce(function (sum, i) {
      return sum + i.qty;
    }, 0);
  }

  function cartTotal() {
    return getCart().reduce(function (sum, i) {
      return sum + i.price * i.qty;
    }, 0);
  }

  function setQty(key, qty) {
    var items = getCart();
    var next = [];
    items.forEach(function (item) {
      if (item.key !== key) {
        next.push(item);
        return;
      }
      if (qty > 0) {
        item.qty = qty;
        next.push(item);
      }
    });
    saveCart(next);
  }

  function renderCart() {
    var $items = $("#cartItems");
    var items = getCart();
    var countFa = cartCount().toLocaleString("fa-IR");
    $("#cartCount, #dockCartCount").text(countFa);
    $("#cartTotal").text(formatPrice(cartTotal()));

    if (!$items.length) return;

    if (!items.length) {
      $items.html('<p class="empty-state">سبد خرید خالی است.</p>');
      return;
    }

    $items.html(
      items
        .map(function (item) {
          var title = item.name + (item.color ? " — " + item.color : "");
          return (
            '<div class="cart-line" data-key="' +
            item.key +
            '">' +
            '<img class="cart-line-thumb" src="' +
            item.image +
            '" alt="" />' +
            '<div class="cart-line-info">' +
            "<h4>" +
            title +
            "</h4>" +
            '<div class="qty-box">' +
            '<button type="button" class="qty-btn" data-qty-delta="-1" data-key="' +
            item.key +
            '">−</button>' +
            '<span class="qty-val">' +
            item.qty.toLocaleString("fa-IR") +
            "</span>" +
            '<button type="button" class="qty-btn" data-qty-delta="1" data-key="' +
            item.key +
            '">+</button>' +
            "</div>" +
            '<div class="cart-line-price">' +
            formatPrice(item.price * item.qty) +
            "</div>" +
            "</div>" +
            '<button type="button" class="cart-line-remove" data-remove="' +
            item.key +
            '" aria-label="حذف">×</button>' +
            "</div>"
          );
        })
        .join("")
    );
  }

  function productCard(p) {
    var price = p.salePrice || p.price;
    var href = "product.html?id=" + encodeURIComponent(p.id);
    return (
      '<article class="product-card" data-id="' +
      p.id +
      '">' +
      '<a class="product-media" href="' +
      href +
      '">' +
      '<img src="' +
      p.image +
      '" alt="' +
      p.name +
      '" loading="lazy" />' +
      "</a>" +
      "<h3><a href=\"" +
      href +
      '">' +
      p.name +
      "</a></h3>" +
      '<span class="price-now">' +
      formatPrice(price) +
      "</span>" +
      '<a class="btn-colors" href="' +
      href +
      '">رنگبندی و جزئیات</a>' +
      "</article>"
    );
  }

  function getProducts() {
    return window.ABERANG_PRODUCTS || [];
  }

  function findProduct(id) {
    return getProducts().find(function (p) {
      return p.id === id;
    });
  }

  function openCart() {
    closeMenu(true);
    $("#cartDrawer").addClass("is-open").attr("aria-hidden", "false");
    $("#overlay").prop("hidden", false);
  }

  function closeCart() {
    $("#cartDrawer").removeClass("is-open").attr("aria-hidden", "true");
    if (!$("#menuDrawer").hasClass("is-open")) {
      $("#overlay").prop("hidden", true);
    }
  }

  function openMenu() {
    closeCart();
    $("#menuDrawer").addClass("is-open").attr("aria-hidden", "false");
    $("#overlay").prop("hidden", false);
    $("body").css("overflow", "hidden");
  }

  function closeMenu(keepOverlay) {
    $("#menuDrawer").removeClass("is-open").attr("aria-hidden", "true");
    $("body").css("overflow", "");
    if (!keepOverlay && !$("#cartDrawer").hasClass("is-open")) {
      $("#overlay").prop("hidden", true);
    }
  }

  function toggleMenu() {
    if ($("#menuDrawer").hasClass("is-open")) closeMenu();
    else openMenu();
  }

  function queryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function filterProducts(list) {
    var cat = $("#catFilter").val() || queryParam("cat") || "all";
    var categoryId = queryParam("categoryId");
    var sort = $("#sortFilter").val() || "new";
    var q = (queryParam("q") || "").trim();
    var hashSale = window.location.hash === "#sale";

    var out = list.slice();

    if (categoryId) {
      out = out.filter(function (p) {
        return String(p.categoryId || "") === String(categoryId);
      });
    } else if (cat && cat !== "all") {
      out = out.filter(function (p) {
        return p.category === cat || p.categorySlug === cat;
      });
    }

    if (q) {
      out = out.filter(function (p) {
        return p.name.indexOf(q) !== -1;
      });
      $("#shopTitle").text('نتایج «' + q + '»');
    }

    if (hashSale || sort === "sale") {
      out = out.filter(function (p) {
        return !!p.salePrice;
      });
      if (hashSale) $("#shopTitle").text("فروش ویژه");
    }

    if (sort === "price-asc") {
      out.sort(function (a, b) {
        return (a.salePrice || a.price) - (b.salePrice || b.price);
      });
    } else if (sort === "price-desc") {
      out.sort(function (a, b) {
        return (b.salePrice || b.price) - (a.salePrice || a.price);
      });
    }

    return out;
  }

  function renderHome() {
    var $grid = $("#homeProducts");
    if (!$grid.length) return;
    $grid.html(
      getProducts()
        .slice(0, 8)
        .map(productCard)
        .join("")
    );
  }

  function renderShop() {
    var $grid = $("#shopProducts");
    if (!$grid.length) return;

    var cat = queryParam("cat");
    if (cat && $("#catFilter option[value='" + cat + "']").length) {
      $("#catFilter").val(cat);
    }

    var q = queryParam("q");
    if (q) $("#shopSearchInput").val(q);

    var categoryId = queryParam("categoryId");
    if (categoryId && Array.isArray(window.ABERANG_CATEGORIES)) {
      var match = window.ABERANG_CATEGORIES.find(function (c) {
        return String(c.id) === String(categoryId);
      });
      if (match) $("#shopTitle").text(match.name);
    } else if (cat && !q) {
      $("#shopTitle").text("فروشگاه");
    }

    var list = filterProducts(getProducts());
    $grid.html(list.map(productCard).join(""));
    $("#shopEmpty").prop("hidden", list.length > 0);
  }

  function renderProductPage() {
    var $page = $("#productPage");
    if (!$page.length) return;

    var product = findProduct(queryParam("id"));
    if (!product) {
      $page.html('<p class="empty-state">محصول پیدا نشد. <a href="shop.html">بازگشت به فروشگاه</a></p>');
      return;
    }

    document.title = product.name + " | آبرنگ";

    var price = product.salePrice || product.price;
    var old = product.salePrice
      ? '<span class="price-old">' + formatPrice(product.price) + "</span>"
      : "";

    var colors = (product.colors || [])
      .map(function (c, idx) {
        return (
          '<button type="button" class="js-color' +
          (idx === 0 ? " is-active" : "") +
          '" data-color="' +
          c +
          '">' +
          c +
          "</button>"
        );
      })
      .join("");

    $page.html(
      '<div class="product-layout">' +
        '<div class="product-gallery"><img src="' +
        product.image +
        '" alt="' +
        product.name +
        '" /></div>' +
        '<div class="product-info">' +
        "<h1>" +
        product.name +
        "</h1>" +
        '<div class="price-row">' +
        old +
        '<span class="price-now">' +
        formatPrice(price) +
        "</span></div>" +
        "<p>رنگ‌بندی</p>" +
        '<div class="color-swatches">' +
        colors +
        "</div>" +
        '<button type="button" class="btn-red js-add-detail" data-id="' +
        product.id +
        '">افزودن به سبد</button>' +
        '<p class="product-desc">' +
        (product.desc || "") +
        "</p>" +
        "</div></div>"
    );
  }

  function iconKey(icon) {
    return String(icon || "tshirt")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");
  }

  function iconClass(icon) {
    return "cat-icon cat-" + iconKey(icon);
  }

  /* Inline SVG silhouettes — filled with currentColor from CSS */
  var CAT_SVGS = {
    all:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.5 4.5c0-1.4 1.1-2.5 2.5-2.5h4c1.4 0 2.5 1.1 2.5 2.5V6h2.2l2.3 4.2-2.5 1.1V20a1.5 1.5 0 01-1.5 1.5H7a1.5 1.5 0 01-1.5-1.5v-8.7L3 10.2 5.3 6H7.5V4.5zm2.5 0h4V6h-4V4.5z"/></svg>',
    sale: "<em>SALE</em>",
    tshirt:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.2 4.2c.5-.9 1.6-1.5 2.8-1.5h2c1.2 0 2.3.6 2.8 1.5L16.5 5h2.4l2.6 4.1-3.1 1.5V19a2 2 0 01-2 2H7.6a2 2 0 01-2-2v-8.4L2.5 9.1 5.1 5h2.4l.7-.8z"/></svg>',
    crop:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 3.5c.5-1 1.5-1.6 2.7-1.6h2.6c1.2 0 2.2.6 2.7 1.6L17 5h2.3l2.2 3.5-2.8 1.4V14a1.5 1.5 0 01-1.5 1.5H6.8A1.5 1.5 0 015.3 14V9.9L2.5 8.5 4.7 5H7l1-1.5z"/></svg>',
    "top-body":
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.2 3.2C9.7 2.3 10.7 1.7 12 1.7s2.3.6 2.8 1.5L15.6 5h1.7l1.9 3.2-2.4 1.2v9.4a2 2 0 01-2 2H9.2a2 2 0 01-2-2V9.4L4.8 8.2 6.7 5h1.7l.8-1.8z"/></svg>',
    pants:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.2 3h7.6c.9 0 1.6.7 1.6 1.6V9l-.5 11.2a1.5 1.5 0 01-1.5 1.4h-2.3a1.5 1.5 0 01-1.5-1.6L11.2 12l-.4 7.9a1.5 1.5 0 01-1.5 1.4H7.1a1.5 1.5 0 01-1.5-1.4L5.2 9V4.6C5.2 3.7 5.9 3 6.8 3h1.4z"/></svg>',
    "set-pants-tshirt":
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 2.2h5l.8 1.3H17l1.8 2.9-2.1 1V9H7.3V7.4L5.2 6.4 7 3.5h1.7L9.5 2.2zM8 10.2h8l.4 9.5a1.2 1.2 0 01-1.2 1.3h-1.8a1.2 1.2 0 01-1.2-1.2l-.2-4.2-.2 4.2a1.2 1.2 0 01-1.2 1.2H8.8a1.2 1.2 0 01-1.2-1.3L8 10.2z"/></svg>',
    "set-pants-crop":
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.6 2.3h4.8l.7 1.2h1.8l1.6 2.6-1.9.9V8H8.4V7L6.5 6.1 8.1 3.5h1l.5-1.2zM8.1 9h7.8l.3 5.2a1.1 1.1 0 01-1.1 1.2h-1.6a1.1 1.1 0 01-1.1-1.1l-.2-2-.2 2a1.1 1.1 0 01-1.1 1.1H9a1.1 1.1 0 01-1.1-1.2L8.1 9zm1.2 7.2h5.4l.3 4.2a1 1 0 01-1 1.1h-1.4a1 1 0 01-1-.9l-.2-1.8-.2 1.8a1 1 0 01-1 .9H10a1 1 0 01-1-1.1l.3-4.2z"/></svg>',
    sets:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.5 3h7l1 1.8H19l2 3.3-2.4 1.2V10H5.4V9.3L3 8.1 5 4.8h2.5L8.5 3zm-.3 8h7.6l.4 9.2a1.3 1.3 0 01-1.3 1.4h-2a1.3 1.3 0 01-1.3-1.3l-.2-3.8-.2 3.8A1.3 1.3 0 019.2 21.6h-2a1.3 1.3 0 01-1.3-1.4L6.3 11z"/></svg>',
    blouse:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3.5C9.6 2.4 10.7 1.8 12 1.8s2.4.6 3 1.7L16 5h2.2l2.3 3.8-2.8 1.3V19a2 2 0 01-2 2H8.3a2 2 0 01-2-2V10.1L3.5 8.8 5.8 5H8l1-1.5z"/></svg>',
    coat:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.2 3.2C8.8 2.2 10 1.6 11.3 1.6h1.4c1.3 0 2.5.6 3.1 1.6L17 5h2.3l2.2 4-2.7 1.2v9.6a1.7 1.7 0 01-1.7 1.7h-2.1V12l-1.5 8.5H10.5L9 12v8.5H6.9A1.7 1.7 0 015.2 19V10.2L2.5 9 4.7 5H7l1.2-1.8z"/></svg>',
    hot:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.8 2.2l1.2 3.2 3.4.2-2.6 2.2.9 3.3-2.9-1.7-2.9 1.7.9-3.3-2.6-2.2 3.4-.2 1.2-3.2zM7.5 13h9l.6 7.6a1.4 1.4 0 01-1.4 1.5H8.3a1.4 1.4 0 01-1.4-1.5L7.5 13z"/></svg>',
    dress:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.4 2.5h5.2l.7 2H17l1.6 2.8-2 .9-.8 1.5 3.7 9.2a1.4 1.4 0 01-1.3 1.9H5.8a1.4 1.4 0 01-1.3-1.9l3.7-9.2-.8-1.5-2-.9L7.1 4.5h1.6l.7-2z"/></svg>',
    top:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.5 3.5c.5-1 1.5-1.6 2.6-1.6h1.8c1.1 0 2.1.6 2.6 1.6L16.2 5h2l2 3.4-2.6 1.3v7.8A1.6 1.6 0 0116 19H8a1.6 1.6 0 01-1.6-1.5V9.7L3.8 8.4 5.8 5h2l.7-1.5z"/></svg>',
    scarf:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5S14.8 7 12 7 7 5.9 7 4.5zm1.5 4.2h7l1.2 12.1a1.4 1.4 0 01-1.4 1.5h-1.6L12 14.8 10.3 22.3H8.7a1.4 1.4 0 01-1.4-1.5L8.5 8.7z"/></svg>',
    belt:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 10.2h12.2a2.3 2.3 0 004.6 0H21v3.6h-.7a2.3 2.3 0 00-4.6 0H3.5v-3.6zm14.5 0a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2z"/></svg>',
    hoodie:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2c2.4 0 4.3 1.5 4.3 3.4v.6l1.7 1.1 2 3.4-2.6 1.2v8.6A1.7 1.7 0 0115.7 22H8.3A1.7 1.7 0 016.6 20.5v-8.6L4 10.7l2-3.4 1.7-1.1V5.6c0-1.9 1.9-3.4 4.3-3.4zm0 2c-1.2 0-2.1.7-2.1 1.5v1.2h4.2V5.7c0-.8-.9-1.5-2.1-1.5z"/></svg>'
  };

  function catIconHtml(key) {
    var k = iconKey(key);
    return CAT_SVGS[k] || CAT_SVGS.tshirt;
  }

  function categoryHref(cat) {
    return "shop.html?categoryId=" + encodeURIComponent(cat.id) + "&cat=" + encodeURIComponent(cat.slug || "");
  }

  function renderCategoryGrid(categories) {
    var $grid = $("#catGrid");
    if (!$grid.length) return;

    var html =
      '<a href="shop.html" class="cat-item">' +
      '<span class="cat-icon cat-all">' +
      catIconHtml("all") +
      "</span><span>همه لباس‌ها</span></a>" +
      '<a href="shop.html#sale" class="cat-item">' +
      '<span class="cat-icon cat-sale">' +
      catIconHtml("sale") +
      "</span><span>فروش ویژه</span></a>";

    categories.forEach(function (cat) {
      var key = cat.icon || cat.slug;
      html +=
        '<a href="' +
        categoryHref(cat) +
        '" class="cat-item" data-category-id="' +
        cat.id +
        '">' +
        '<span class="' +
        iconClass(key) +
        '">' +
        catIconHtml(key) +
        "</span>" +
        "<span>" +
        cat.name +
        "</span></a>";
    });

    $grid.html(html);
  }

  function renderMenuCategories(categories) {
    var $wrap = $("#menuCategories");
    if (!$wrap.length) return;

    var html = categories
      .map(function (cat) {
        return (
          '<a class="menu-link" href="' +
          categoryHref(cat) +
          '">' +
          cat.name +
          "</a>"
        );
      })
      .join("");
    $wrap.html(html);
  }

  function loadCategories() {
    var base = window.ABERANG_API_BASE_URL || "http://localhost:8080/api";
    return $.ajax({
      url: base + "/categories",
      method: "GET",
      dataType: "json"
    })
      .done(function (rows) {
        var list = Array.isArray(rows) ? rows : [];
        window.ABERANG_CATEGORIES = list;
        renderCategoryGrid(list);
        renderMenuCategories(list);
      })
      .fail(function () {
        $("#catGrid").html(
          '<p class="cat-loading">دریافت دسته‌ها ناموفق بود. API را بررسی کنید.</p>'
        );
      });
  }

  $(function () {
    renderCart();
    renderHome();
    renderShop();
    renderProductPage();
    loadCategories();

    $("#menuToggle, #dockMenu").on("click", toggleMenu);

    $("#bannerClose").on("click", function () {
      $("#topBanner").slideUp(180);
    });

    $("#searchToggle").on("click", function () {
      openMenu();
      setTimeout(function () {
        $(".menu-search input").trigger("focus");
      }, 280);
    });

    $("#cartToggle, #dockCart").on("click", openCart);
    $("#cartClose").on("click", closeCart);
    $("#overlay").on("click", function () {
      closeCart();
      closeMenu();
    });
    $(document).on("keydown", function (e) {
      if (e.key === "Escape") {
        closeCart();
        closeMenu();
      }
    });

    $(document).on("click", "[data-remove]", function () {
      removeFromCart($(this).data("remove"));
    });

    $(document).on("click", ".qty-btn", function () {
      var key = $(this).data("key");
      var delta = Number($(this).data("qty-delta"));
      var item = getCart().find(function (i) {
        return i.key === key;
      });
      if (!item) return;
      setQty(key, item.qty + delta);
    });

    $("#cartContinue").on("click", closeCart);
    $("#cartCheckout").on("click", function () {
      alert("ثبت سفارش به‌زودی فعال می‌شود.");
    });

    $(document).on("click", ".js-add", function () {
      var p = findProduct($(this).data("id"));
      if (p) addToCart(p, (p.colors && p.colors[0]) || "");
    });

    $(document).on("click", ".js-add-detail", function () {
      var p = findProduct($(this).data("id"));
      var color = $(".js-color.is-active").data("color") || "";
      if (p) addToCart(p, color);
    });

    $(document).on("click", ".js-color", function () {
      $(".js-color").removeClass("is-active");
      $(this).addClass("is-active");
    });

    $("#catFilter, #sortFilter").on("change", renderShop);
  });
})(jQuery);
