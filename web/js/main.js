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

  function addToCart(product, selection, qty) {
    selection = selection || {};
    var amount = Math.max(1, Number(qty) || 1);
    var attrs = selection.attrs || {};
    var variantId = selection.variantId || "";
    var variantLabel = selection.variantLabel || "";
    var unitPrice = Number(selection.price);
    if (!(unitPrice > 0)) {
      unitPrice = product.salePrice || product.price || 0;
    }
    var image = selection.image || product.image || PLACEHOLDER_IMG;
    var key =
      product.id +
      "::" +
      (variantId ||
        Object.keys(attrs)
          .sort()
          .map(function (k) {
            return k + "=" + attrs[k];
          })
          .join("|"));

    var items = getCart();
    var existing = items.find(function (i) {
      return i.key === key;
    });
    if (existing) {
      existing.qty += amount;
      if (variantId) existing.variantId = variantId;
      if (variantLabel) existing.variantLabel = variantLabel;
      existing.price = unitPrice;
      existing.attrs = attrs;
    } else {
      items.push({
        key: key,
        id: product.id,
        productId: product.id,
        variantId: variantId,
        name: product.name,
        variantLabel: variantLabel,
        attrs: attrs,
        price: unitPrice,
        image: image,
        color: attrs.color || selection.color || "",
        qty: amount
      });
    }
    saveCart(items);
    openCart();
  }

  function cartLineTitle(item) {
    if (item.variantLabel) return item.name + " — " + item.variantLabel;
    if (item.color) return item.name + " — " + item.color;
    return item.name;
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
          var title = cartLineTitle(item);
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

  var PLACEHOLDER_IMG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#f0f0f0" width="400" height="500"/><text x="200" y="250" text-anchor="middle" fill="#aaa" font-family="sans-serif" font-size="18">بدون تصویر</text></svg>'
    );

  function mapApiProduct(api) {
    var variants = Array.isArray(api.variants) ? api.variants : [];
    var gallery = Array.isArray(api.images)
      ? api.images.filter(function (s) {
          return !!s;
        })
      : [];
    var variantImgs = variants
      .map(function (v) {
        return v.image;
      })
      .filter(Boolean);
    var resolve = window.ABERANG_MEDIA_URL || function (p) { return p; };
    var images = (gallery.length ? gallery : variantImgs).map(resolve);

    var sellPrices = variants
      .map(function (v) {
        var sell = Number(v.salePrice) || 0;
        var cost = Number(v.price) || 0;
        return sell > 0 ? sell : cost;
      })
      .filter(function (n) {
        return n > 0;
      });
    var price = sellPrices.length ? Math.min.apply(null, sellPrices) : 0;

    var colors = [];
    var attrs = Array.isArray(api.attributes) ? api.attributes : [];
    var colorAttrs = attrs.filter(function (a) {
      var n = String(a.name || "").toLowerCase();
      return a.allowImage || n.indexOf("رنگ") !== -1 || n.indexOf("color") !== -1;
    });
    (colorAttrs.length ? colorAttrs : attrs).forEach(function (a) {
      (a.options || []).forEach(function (o) {
        if (o.label && colors.indexOf(o.label) === -1) colors.push(o.label);
      });
    });

    var cat = null;
    if (api.categoryId && Array.isArray(window.ABERANG_CATEGORIES)) {
      cat = window.ABERANG_CATEGORIES.find(function (c) {
        return String(c.id) === String(api.categoryId);
      });
    }

    return {
      id: api.id,
      name: api.name || "بدون نام",
      categoryId: api.categoryId || null,
      category: cat ? cat.slug : "",
      categorySlug: cat ? cat.slug : "",
      categoryName: cat ? cat.name : "",
      price: price,
      salePrice: null,
      colors: colors,
      image: images[0] || PLACEHOLDER_IMG,
      images: images,
      desc: "",
      variants: variants,
      attributes: attrs
    };
  }

  function getProducts() {
    return window.ABERANG_PRODUCTS || [];
  }

  function findProduct(id) {
    return getProducts().find(function (p) {
      return p.id === id;
    });
  }

  function productHref(id) {
    return "product.html?id=" + encodeURIComponent(id);
  }

  function productCard(p) {
    var price = p.salePrice || p.price;
    var href = productHref(p.id);
    var img = p.image || PLACEHOLDER_IMG;
    var blank = ' target="_blank" rel="noopener noreferrer"';
    return (
      '<article class="product-card" data-id="' +
      p.id +
      '">' +
      '<a class="product-media" href="' +
      href +
      '"' +
      blank +
      ">" +
      '<img src="' +
      img +
      '" alt="' +
      p.name +
      '" loading="lazy" onerror="this.onerror=null;this.src=\'' +
      PLACEHOLDER_IMG +
      '\'" />' +
      "</a>" +
      "<h3><a href=\"" +
      href +
      '"' +
      blank +
      ">" +
      p.name +
      "</a></h3>" +
      '<span class="price-now">' +
      formatPrice(price) +
      "</span>" +
      '<a class="btn-colors" href="' +
      href +
      '"' +
      blank +
      ">رنگبندی و جزئیات</a>" +
      "</article>"
    );
  }

  function loadProducts() {
    var base = window.ABERANG_API_BASE_URL || "http://localhost:8080/api";
    var $home = $("#homeProducts");
    var onProductPage = $("#productPage").length > 0;
    if ($home.length) {
      $home.html('<p class="cat-loading">در حال بارگذاری محصولات...</p>');
    }
    // Product detail: fetch that id directly (new tab / deep link)
    if (onProductPage) {
      loadProductDetail();
    }
    return $.ajax({
      url: base + "/products",
      method: "GET",
      dataType: "json"
    })
      .done(function (rows) {
        var list = (Array.isArray(rows) ? rows : []).map(mapApiProduct);
        window.ABERANG_PRODUCTS = list;
        renderHome();
        renderShop();
        if (!onProductPage) renderProductPage();
      })
      .fail(function () {
        window.ABERANG_PRODUCTS = [];
        if ($home.length) {
          $home.html(
            '<p class="cat-loading">دریافت محصولات ناموفق بود. API را بررسی کنید.</p>'
          );
        }
        renderShop();
        if (!onProductPage) renderProductPage();
      });
  }

  function loadProductDetail() {
    var $page = $("#productPage");
    if (!$page.length) return;
    var id = queryParam("id");
    if (!id) {
      $page.html(
        '<p class="empty-state">محصول پیدا نشد. <a href="shop.html">بازگشت به فروشگاه</a></p>'
      );
      return;
    }
    $page.html('<p class="loading-msg">در حال بارگذاری...</p>');
    var base = window.ABERANG_API_BASE_URL || "http://localhost:8080/api";
    return $.ajax({
      url: base + "/products/" + encodeURIComponent(id),
      method: "GET",
      dataType: "json"
    })
      .done(function (row) {
        var product = mapApiProduct(row);
        window.ABERANG_PRODUCTS = [product].concat(
          (window.ABERANG_PRODUCTS || []).filter(function (p) {
            return p.id !== product.id;
          })
        );
        renderProductPage(product);
      })
      .fail(function () {
        $page.html(
          '<p class="empty-state">محصول پیدا نشد. <a href="shop.html">بازگشت به فروشگاه</a></p>'
        );
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
    var list = getProducts();
    if (!list.length) {
      $grid.html(
        '<p class="cat-loading">هنوز محصولی ثبت نشده است.</p>'
      );
      return;
    }
    $grid.html(
      list
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

  function uniqueImages(list) {
    var out = [];
    var seen = {};
    (list || []).forEach(function (src) {
      if (!src || seen[src]) return;
      seen[src] = true;
      out.push(src);
    });
    return out;
  }

  function productGalleryImages(product) {
    var resolve = window.ABERANG_MEDIA_URL || function (p) {
      return p;
    };
    var gallery = (product.images || []).slice();
    (product.variants || []).forEach(function (v) {
      if (v.image) gallery.push(resolve(v.image));
    });
    var imgs = uniqueImages(gallery);
    return imgs.length ? imgs : [product.image || PLACEHOLDER_IMG];
  }

  function isColorAttr(attr) {
    var n = String((attr && attr.name) || "").toLowerCase();
    return (
      !!(attr && attr.allowImage) ||
      n.indexOf("رنگ") !== -1 ||
      n.indexOf("color") !== -1
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function productAttrsHtml(product) {
    var attrs = (product.attributes || []).filter(function (a) {
      return !isColorAttr(a);
    });
    if (!attrs.length) return "";

    return attrs
      .map(function (a) {
        var opts = Array.isArray(a.options) ? a.options : [];
        if (!opts.length) return "";
        var name = escapeHtml(a.name || "ویژگی");
        var chips = opts
          .map(function (o, idx) {
            return (
              '<button type="button" class="js-attr pdp-swatch' +
              (idx === 0 ? " is-active" : "") +
              '" data-attr-id="' +
              escapeHtml(a.id) +
              '" data-attr-name="' +
              name +
              '" data-value="' +
              escapeHtml(o.label) +
              '"><span>' +
              escapeHtml(o.label) +
              "</span></button>"
            );
          })
          .join("");
        return (
          '<div class="pdp-field"><span class="pdp-label">' +
          name +
          '</span><div class="pdp-swatches pdp-attr-swatches">' +
          chips +
          "</div></div>"
        );
      })
      .join("");
  }

  function collectProductSelection(product) {
    var $page = $("#productPage");
    var selectedById = {};
    var labels = [];

    (product.attributes || []).forEach(function (a) {
      if (isColorAttr(a)) {
        var color = String($page.find(".js-color.is-active").data("color") || "").trim();
        if (!color && a.options && a.options[0]) color = a.options[0].label;
        if (color) {
          selectedById[a.id] = color;
          labels.push(color);
        }
        return;
      }
      var $active = $page.find('.js-attr.is-active[data-attr-id="' + a.id + '"]');
      var val = String($active.data("value") || "").trim();
      if (!val && a.options && a.options[0]) val = a.options[0].label;
      if (val) {
        selectedById[a.id] = val;
        labels.push(val);
      }
    });

    var variant = matchVariant(product, selectedById);
    var resolve = window.ABERANG_MEDIA_URL || function (p) {
      return p;
    };
    var price = product.price || 0;
    var image = product.image;
    if (variant) {
      var sell = Number(variant.salePrice) || 0;
      var cost = Number(variant.price) || 0;
      price = sell > 0 ? sell : cost > 0 ? cost : price;
      if (variant.image) image = resolve(variant.image);
    }

    return {
      attrs: selectedById,
      variantId: variant ? variant.id : "",
      variantLabel: labels.join(" / "),
      price: price,
      image: image,
      color: labels[0] || ""
    };
  }

  function matchVariant(product, selectedById) {
    var variants = product.variants || [];
    if (!variants.length) return null;

    var exact = variants.find(function (v) {
      var av = v.attributeValues || {};
      var keys = Object.keys(av);
      if (!keys.length) return Object.keys(selectedById).length === 0;
      return keys.every(function (k) {
        return String(av[k] || "") === String(selectedById[k] || "");
      });
    });
    if (exact) return exact;

    // Soft match: all selected values appear in the variant map
    var selectedVals = Object.keys(selectedById).map(function (k) {
      return String(selectedById[k]);
    });
    return (
      variants.find(function (v) {
        var vals = Object.keys(v.attributeValues || {}).map(function (k) {
          return String(v.attributeValues[k]);
        });
        return selectedVals.every(function (s) {
          return vals.indexOf(s) !== -1;
        });
      }) || null
    );
  }

  function openCheckout() {
    var items = getCart();
    if (!items.length) {
      alert("سبد خرید خالی است.");
      return;
    }
    var missing = items.filter(function (i) {
      return !i.variantId;
    });
    if (missing.length) {
      alert(
        "برای بعضی اقلام ترکیب ویژگی یافت نشد. لطفاً از صفحه محصول رنگ و ویژگی‌ها را دوباره انتخاب کنید."
      );
      return;
    }
    window.location.href = "checkout.html";
  }

  function closeCheckout() {
    $("#checkoutModal").prop("hidden", true);
  }

  function submitCheckout(e) {
    if (e && e.preventDefault) e.preventDefault();
    openCheckout();
  }

  function colorOptionMeta(product) {
    var resolve = window.ABERANG_MEDIA_URL || function (p) {
      return p;
    };
    var colors = product.colors || [];
    return colors.map(function (label) {
      var match = (product.variants || []).find(function (v) {
        var vals = v.attributeValues || {};
        return Object.keys(vals).some(function (k) {
          return String(vals[k]) === String(label);
        });
      });
      var img = match && match.image ? resolve(match.image) : "";
      return { label: label, image: img };
    });
  }

  function renderProductPage(forced) {
    var $page = $("#productPage");
    if (!$page.length) return;

    var product = forced || findProduct(queryParam("id"));
    if (!product) {
      if (!forced) return; // still loading via loadProductDetail
      $page.html(
        '<p class="empty-state">محصول پیدا نشد. <a href="shop.html">بازگشت به فروشگاه</a></p>'
      );
      return;
    }

    document.title = product.name + " | آبرنگ";

    var price = product.salePrice || product.price;
    var old = product.salePrice
      ? '<span class="price-old">' + formatPrice(product.price) + "</span>"
      : "";
    var images = productGalleryImages(product);
    var colorMeta = colorOptionMeta(product);

    var slides = images
      .map(function (src, idx) {
        return (
          '<div class="pdp-slide' +
          (idx === 0 ? " is-active" : "") +
          '" data-index="' +
          idx +
          '">' +
          '<img src="' +
          src +
          '" alt="' +
          product.name +
          " — تصویر " +
          (idx + 1) +
          '" loading="' +
          (idx === 0 ? "eager" : "lazy") +
          '" onerror="this.onerror=null;this.src=\'' +
          PLACEHOLDER_IMG +
          '\'" />' +
          "</div>"
        );
      })
      .join("");

    var thumbs = images
      .map(function (src, idx) {
        return (
          '<button type="button" class="pdp-thumb' +
          (idx === 0 ? " is-active" : "") +
          '" data-index="' +
          idx +
          '" aria-label="تصویر ' +
          (idx + 1) +
          '">' +
          '<img src="' +
          src +
          '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' +
          PLACEHOLDER_IMG +
          '\'" />' +
          "</button>"
        );
      })
      .join("");

    var dots = images
      .map(function (_, idx) {
        return (
          '<button type="button" class="pdp-dot' +
          (idx === 0 ? " is-active" : "") +
          '" data-index="' +
          idx +
          '" aria-label="اسلاید ' +
          (idx + 1) +
          '"></button>'
        );
      })
      .join("");

    var colors = colorMeta
      .map(function (c, idx) {
        var imgHtml = c.image
          ? '<span class="swatch-img"><img src="' +
            c.image +
            '" alt="" loading="lazy" /></span>'
          : "";
        return (
          '<button type="button" class="js-color pdp-swatch' +
          (idx === 0 ? " is-active" : "") +
          '" data-color="' +
          c.label +
          '"' +
          (c.image ? ' data-image="' + c.image + '"' : "") +
          ">" +
          imgHtml +
          "<span>" +
          c.label +
          "</span></button>"
        );
      })
      .join("");

    var crumbCat = product.categoryName || product.category
      ? '<a href="shop.html?cat=' +
        encodeURIComponent(product.category || "") +
        (product.categoryId
          ? "&categoryId=" + encodeURIComponent(product.categoryId)
          : "") +
        '">' +
        (product.categoryName || product.category) +
        "</a>"
      : "";

    $page.html(
      '<div class="pdp" data-id="' +
        product.id +
        '">' +
        '<div class="pdp-gallery" data-count="' +
        images.length +
        '">' +
        '<div class="pdp-stage" tabindex="0" aria-roledescription="carousel">' +
        (images.length > 1
          ? '<button type="button" class="pdp-nav pdp-prev" aria-label="قبلی">‹</button>'
          : "") +
        '<div class="pdp-viewport"><div class="pdp-track">' +
        slides +
        "</div></div>" +
        (images.length > 1
          ? '<button type="button" class="pdp-nav pdp-next" aria-label="بعدی">›</button>'
          : "") +
        '<span class="pdp-counter"><b class="js-pdp-n">1</b> / ' +
        images.length +
        "</span>" +
        "</div>" +
        (images.length > 1
          ? '<div class="pdp-dots" role="tablist">' + dots + "</div>"
          : "") +
        (images.length > 1
          ? '<div class="pdp-thumbs" role="list">' + thumbs + "</div>"
          : "") +
        "</div>" +
        '<div class="pdp-info">' +
        '<nav class="pdp-breadcrumb" aria-label="مسیر">' +
        '<a href="index.html">خانه</a>' +
        (crumbCat ? "<span>/</span>" + crumbCat : "") +
        "<span>/</span><span>" +
        product.name +
        "</span></nav>" +
        "<h1>" +
        product.name +
        "</h1>" +
        '<div class="price-row">' +
        old +
        '<span class="price-now">' +
        formatPrice(price) +
        "</span></div>" +
        (colors
          ? '<div class="pdp-field"><span class="pdp-label">رنگ</span><div class="color-swatches pdp-swatches">' +
            colors +
            "</div></div>"
          : "") +
        productAttrsHtml(product) +
        '<div class="pdp-buy">' +
        '<div class="pdp-qty" aria-label="تعداد">' +
        '<button type="button" class="js-qty-dec" aria-label="کاهش">−</button>' +
        '<input type="number" class="js-qty" value="1" min="1" max="99" inputmode="numeric" />' +
        '<button type="button" class="js-qty-inc" aria-label="افزایش">+</button>' +
        "</div>" +
        '<button type="button" class="btn-red js-add-detail" data-id="' +
        product.id +
        '">افزودن به سبد خرید</button>' +
        "</div>" +
        (product.desc
          ? '<div class="pdp-desc"><h2>توضیحات</h2><p class="product-desc">' +
            product.desc +
            "</p></div>"
          : "") +
        "</div>" +
        '<div class="pdp-sticky" hidden>' +
        '<div class="pdp-sticky-inner">' +
        '<div class="pdp-sticky-meta"><strong>' +
        product.name +
        '</strong><span class="price-now">' +
        formatPrice(price) +
        "</span></div>" +
        '<button type="button" class="btn-red js-add-detail" data-id="' +
        product.id +
        '">افزودن به سبد</button>' +
        "</div></div>" +
        "</div>"
    );

    bindProductGallery($page, images);
  }

  function bindProductGallery($page, images) {
    var index = 0;
    var $track = $page.find(".pdp-track");
    var $stage = $page.find(".pdp-stage");
    var count = images.length;

    function go(to) {
      if (count < 1) return;
      index = (to + count) % count;
      $track.css("transform", "translate3d(-" + index * 100 + "%, 0, 0)");
      $page.find(".pdp-slide").removeClass("is-active").eq(index).addClass("is-active");
      $page.find(".pdp-thumb, .pdp-dot").removeClass("is-active");
      $page.find('.pdp-thumb[data-index="' + index + '"], .pdp-dot[data-index="' + index + '"]').addClass("is-active");
      $page.find(".js-pdp-n").text(String(index + 1));
      var $activeThumb = $page.find(".pdp-thumb.is-active");
      if ($activeThumb.length) {
        var thumbs = $page.find(".pdp-thumbs")[0];
        if (thumbs) {
          $activeThumb[0].scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        }
      }
    }

    $page.find(".pdp-next").on("click", function () {
      go(index + 1);
    });
    $page.find(".pdp-prev").on("click", function () {
      go(index - 1);
    });
    $page.on("click", ".pdp-thumb, .pdp-dot", function () {
      go(Number($(this).data("index")) || 0);
    });

    // Touch / swipe
    var startX = 0;
    var startY = 0;
    var dragging = false;
    $stage.on("touchstart", function (e) {
      var t = e.originalEvent.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      dragging = true;
    });
    $stage.on("touchmove", function (e) {
      if (!dragging) return;
      var t = e.originalEvent.touches[0];
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        e.preventDefault();
      }
    });
    $stage.on("touchend", function (e) {
      if (!dragging) return;
      dragging = false;
      var t = e.originalEvent.changedTouches[0];
      var dx = t.clientX - startX;
      if (Math.abs(dx) < 40) return;
      // RTL: swipe right (positive dx) → previous visually left content... gallery still advances with dx sign
      if (dx < 0) go(index + 1);
      else go(index - 1);
    });

    // Color → jump to matching image if present
    $page.on("click", ".js-color", function () {
      var img = $(this).data("image");
      if (!img) return;
      var i = images.indexOf(img);
      if (i >= 0) go(i);
    });

    // Sticky bar
    var $sticky = $page.find(".pdp-sticky");
    var $buy = $page.find(".pdp-buy");
    function onScroll() {
      if (!$buy.length) return;
      var rect = $buy[0].getBoundingClientRect();
      var show = rect.bottom < 0;
      $sticky.prop("hidden", !show);
    }
    $(window).off("scroll.pdp").on("scroll.pdp", onScroll);
    onScroll();

    go(0);
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
        // Enrich product category slugs once categories are known
        if (Array.isArray(window.ABERANG_PRODUCTS) && window.ABERANG_PRODUCTS.length) {
          window.ABERANG_PRODUCTS.forEach(function (p) {
            var match = list.find(function (c) {
              return String(c.id) === String(p.categoryId || "");
            });
            if (match) {
              p.category = match.slug;
              p.categorySlug = match.slug;
              p.categoryName = match.name;
            }
          });
          renderShop();
          if ($("#productPage").length) {
            var current = findProduct(queryParam("id"));
            if (current) renderProductPage(current);
          }
        }
      })
      .fail(function () {
        $("#catGrid").html(
          '<p class="cat-loading">دریافت دسته‌ها ناموفق بود. API را بررسی کنید.</p>'
        );
      });
  }

  $(function () {
    if (window.AberangAuth && typeof AberangAuth.wireAccountLinks === "function") {
      AberangAuth.wireAccountLinks();
    }
    renderCart();
    loadCategories();
    loadProducts();

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
      closeCheckout();
    });
    $(document).on("keydown", function (e) {
      if (e.key === "Escape") {
        closeCart();
        closeMenu();
        closeCheckout();
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
    $("#cartCheckout").on("click", openCheckout);
    $(document).on("click", "#checkoutClose", closeCheckout);
    $(document).on("submit", "#checkoutForm", submitCheckout);

    $(document).on("click", ".js-add", function () {
      var p = findProduct($(this).data("id"));
      if (!p) return;
      var color = (p.colors && p.colors[0]) || "";
      var attrs = {};
      (p.attributes || []).forEach(function (a) {
        if (a.options && a.options[0]) attrs[a.id] = a.options[0].label;
      });
      var sel = {
        attrs: attrs,
        variantId: "",
        variantLabel: color,
        price: p.salePrice || p.price,
        image: p.image,
        color: color
      };
      var matched = matchVariant(p, attrs);
      if (matched) {
        sel.variantId = matched.id;
        var sell = Number(matched.salePrice) || 0;
        var cost = Number(matched.price) || 0;
        sel.price = sell > 0 ? sell : cost > 0 ? cost : sel.price;
        var parts = (p.attributes || [])
          .map(function (a) {
            return attrs[a.id];
          })
          .filter(Boolean);
        sel.variantLabel = parts.join(" / ");
      }
      addToCart(p, sel, 1);
    });

    $(document).on("click", ".js-add-detail", function () {
      var p = findProduct($(this).data("id"));
      if (!p) return;
      var qty = Number($("#productPage .js-qty").val()) || 1;
      var sel = collectProductSelection(p);
      if (!sel.variantId && (p.variants || []).length) {
        alert("این ترکیب ویژگی در موجودی نیست. لطفاً رنگ و ویژگی‌های دیگر را تغییر دهید.");
        return;
      }
      addToCart(p, sel, qty);
    });

    $(document).on("click", ".js-color", function () {
      $(this).closest(".color-swatches, .pdp-swatches").find(".js-color").removeClass("is-active");
      $(this).addClass("is-active");
    });

    $(document).on("click", ".js-attr", function () {
      $(this).closest(".pdp-attr-swatches, .pdp-swatches").find(".js-attr").removeClass("is-active");
      $(this).addClass("is-active");
    });

    $(document).on("click", ".js-qty-dec", function () {
      var $input = $("#productPage .js-qty");
      var n = Math.max(1, (Number($input.val()) || 1) - 1);
      $input.val(n);
    });
    $(document).on("click", ".js-qty-inc", function () {
      var $input = $("#productPage .js-qty");
      var n = Math.min(99, (Number($input.val()) || 1) + 1);
      $input.val(n);
    });
    $(document).on("change", "#productPage .js-qty", function () {
      var n = Math.max(1, Math.min(99, Number($(this).val()) || 1));
      $(this).val(n);
    });

    $("#catFilter, #sortFilter").on("change", renderShop);
  });
})(jQuery);
