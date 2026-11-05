/* Q2-Q5 - Search/filter, product grid, Event Delegation và Quick View. */
(function () {
  var Shop = window.Shop = window.Shop || {};
  Shop.filteredProducts = [];

  Shop.renderCategories = function () {
    var select = document.getElementById("category-filter");
    var categories = [];
    Shop.products.forEach(function (p) {
      if (categories.indexOf(p.category) === -1) categories.push(p.category);
    });
    select.innerHTML = '<option value="">Tất cả danh mục</option>' + categories.sort().map(function (c) {
      return '<option value="' + Shop.escapeHTML(c) + '">' + Shop.escapeHTML(c) + '</option>';
    }).join("");
  };

  Shop.renderProducts = function (list) {
    var grid = document.getElementById("product-grid");
    var skeleton = document.getElementById("skeleton-grid");
    var empty = document.getElementById("empty-state");
    var canPurchase = !Shop.isEmployee || !Shop.isEmployee();
    skeleton.classList.add("hidden");
    grid.classList.remove("hidden");
    Shop.filteredProducts = list;
    Shop._hasRenderedProducts = true;
    document.getElementById("product-summary").textContent = list.length + " sản phẩm phù hợp";
    if (!list.length) { grid.innerHTML = ""; empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");

    grid.innerHTML = list.map(function (p) {
      var rating = Shop.getProductRating(p.id);
      var rounded = Math.max(0, Math.min(5, Math.round(rating.average)));
      var stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);
      var colors = [p.color, "#7895a5", "#c58f91"];
      var purchaseControl = canPurchase
        ? '<button class="btn btn-primary" type="button" data-action="add" data-id="' + p.id + '" data-variant="' + p.color + '" ' + (p.stock <= 0 ? "disabled" : "") + '>Thêm vào giỏ</button>'
        : '<span class="employee-view-note">Nhân viên chỉ xem sản phẩm</span>';
      return '<article class="product-card" data-product-card="' + p.id + '">' +
        '<div class="product-image-wrap"><span class="stock-tag ' + (p.stock <= 0 ? "out" : "") + '">' + (p.stock > 0 ? "Còn " + p.stock + " sản phẩm" : "Hết hàng") + '</span>' +
        '<img class="product-image" src="' + Shop.escapeHTML(p.image) + '" alt="' + Shop.escapeHTML(p.title) + '" loading="lazy"></div>' +
        '<div class="product-body"><span class="category-tag">' + Shop.escapeHTML(p.category) + '</span>' +
        '<h3 class="product-title">' + Shop.escapeHTML(p.title) + '</h3><p class="product-desc">' + Shop.escapeHTML(p.description.slice(0, 78)) + (p.description.length > 78 ? "…" : "") + '</p>' +
        '<div class="rating-line">' + stars + ' <button type="button" data-action="reviews" data-id="' + p.id + '">' + rating.average.toFixed(1) + ' (' + rating.count + ')</button></div>' +
        '<div class="product-price">' + Shop.formatMoney(p.price) + '</div><div class="color-variants"><span class="variant-label">Màu:</span>' +
        colors.map(function (c, i) { return '<button type="button" class="variant-choice ' + (i === 0 ? "selected" : "") + '" style="background:' + c + '" data-action="variant" data-id="' + p.id + '" data-variant="' + c + '" aria-label="Chọn màu ' + c + '"></button>'; }).join("") +
        '</div><div class="product-actions">' + purchaseControl + '<button class="btn quick-btn" type="button" data-action="quick" data-id="' + p.id + '">Xem nhanh</button></div></div></article>';
    }).join("");
  };

  Shop.applyFilters = function () {
    var keyword = document.getElementById("search-name").value.trim().toLowerCase();
    var category = document.getElementById("category-filter").value;
    var min = document.getElementById("price-min").value;
    var max = document.getElementById("price-max").value;
    var stock = document.getElementById("stock-filter").checked;
    var color = document.getElementById("color-filter").value;
    var ratingInput = document.querySelector('input[name="rating-filter"]:checked');
    var minRating = ratingInput ? Number(ratingInput.value) : 0;
    if (min !== "" && max !== "" && Number(min) > Number(max)) { Shop.toast("Giá tối thiểu không được lớn hơn giá tối đa."); return; }
    var list = Shop.products.filter(function (p) {
      var rating = Shop.getProductRating(p.id).average;
      return (!keyword || p.title.toLowerCase().indexOf(keyword) !== -1 || p.description.toLowerCase().indexOf(keyword) !== -1) &&
        (!category || p.category === category) && (min === "" || p.price >= Number(min)) && (max === "" || p.price <= Number(max)) &&
        (!stock || p.stock > 0) && (!color || p.color === color) && rating >= minRating;
    });
    var sort = document.getElementById("sort-filter").value;
    if (sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
    else if (sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
    else if (sort === "name") list.sort(function (a, b) { return a.title.localeCompare(b.title); });
    else if (sort === "rating") list.sort(function (a, b) { return Shop.getProductRating(b.id).average - Shop.getProductRating(a.id).average; });
    Shop.renderProducts(list);
  };

  Shop.showQuickView = function (id) {
    var p = Shop.products.find(function (x) { return x.id === Number(id); });
    if (!p) return;
    var rating = Shop.getProductRating(p.id);
    var purchaseControl = (!Shop.isEmployee || !Shop.isEmployee())
      ? '<button type="button" class="btn btn-primary" data-modal-add="' + p.id + '" data-variant="' + p.color + '">Thêm vào giỏ</button>'
      : '<p class="employee-view-note">Tài khoản nhân viên chỉ xem sản phẩm và tồn kho.</p>';
    document.getElementById("product-modal-body").innerHTML =
      '<div class="quick-view"><img src="' + Shop.escapeHTML(p.image) + '" alt="' + Shop.escapeHTML(p.title) + '"><div>' +
      '<span class="eyebrow">QUICK VIEW · ' + Shop.escapeHTML(p.category) + '</span><h2 id="modal-title">' + Shop.escapeHTML(p.title) + '</h2>' +
      '<p>' + Shop.escapeHTML(p.description) + '</p><p class="product-price">' + Shop.formatMoney(p.price) + '</p>' +
      '<p>Đánh giá: <strong>' + rating.average.toFixed(1) + '/5</strong> · ' + rating.count + ' lượt</p><p>Tồn kho: <strong>' + p.stock + '</strong></p>' +
      purchaseControl + ' <button type="button" class="btn btn-outline" data-modal-reviews="' + p.id + '">Xem đánh giá</button></div></div>';
    document.getElementById("product-modal").classList.remove("hidden");
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("filter-form").addEventListener("submit", function (e) { e.preventDefault(); Shop.applyFilters(); });
    document.getElementById("filter-reset").addEventListener("click", function () { document.getElementById("filter-form").reset(); Shop.applyFilters(); });
    document.getElementById("sort-filter").addEventListener("change", Shop.applyFilters);
    document.getElementById("color-filter").addEventListener("change", Shop.applyFilters);
    document.querySelectorAll('input[name="rating-filter"]').forEach(function (radio) { radio.addEventListener("change", Shop.applyFilters); });
    document.getElementById("product-grid").addEventListener("click", function (event) {
      var target = event.target.closest("[data-action]");
      if (!target) return;
      var id = target.getAttribute("data-id");
      var variant = target.getAttribute("data-variant");
      if (target.getAttribute("data-action") === "variant") {
        var card = target.closest("[data-product-card]");
        card.querySelectorAll(".variant-choice").forEach(function (btn) { btn.classList.remove("selected"); });
        target.classList.add("selected");
        var addButton = card.querySelector('[data-action="add"]');
        if (addButton) addButton.setAttribute("data-variant", variant);
        return;
      }
      if (target.getAttribute("data-action") === "add") Shop.addToCart(id, variant);
      else if (target.getAttribute("data-action") === "quick") Shop.showQuickView(id);
      else if (target.getAttribute("data-action") === "reviews") Shop.showReviewDetails(id);
    });
    document.getElementById("product-modal-body").addEventListener("click", function (event) {
      var add = event.target.closest("[data-modal-add]");
      var rev = event.target.closest("[data-modal-reviews]");
      if (add) { Shop.addToCart(add.getAttribute("data-modal-add"), add.getAttribute("data-variant")); document.getElementById("product-modal").classList.add("hidden"); }
      if (rev) Shop.showReviewDetails(rev.getAttribute("data-modal-reviews"));
    });
  });
})();
