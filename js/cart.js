/* Q6 - Đối tượng giỏ hàng JS, lưu Local Storage và mini-cart nổi. */
(function () {
  var Shop = window.Shop = window.Shop || {};
  Shop.cart = { items: [] };
  Shop.loadCart = function () {
    try { Shop.cart = JSON.parse(localStorage.getItem("bw08_cart") || '{"items":[]}'); }
    catch (e) { Shop.cart = { items: [] }; }
    if (!Shop.cart || !Array.isArray(Shop.cart.items)) Shop.cart = { items: [] };
    Shop.renderCart();
  };
  Shop.saveCart = function () { localStorage.setItem("bw08_cart", JSON.stringify(Shop.cart)); Shop.renderCart(); };
  Shop.cartCount = function () { return Shop.cart.items.reduce(function (n, item) { return n + item.quantity; }, 0); };
  Shop.cartTotal = function () { return Shop.cart.items.reduce(function (n, item) { return n + item.price * item.quantity; }, 0); };
  Shop.addToCart = function (id, variant) {
    if (Shop.isEmployee && Shop.isEmployee()) {
      Shop.toast("Tài khoản nhân viên/Admin không được phép đặt hàng.");
      return;
    }
    var p = Shop.products.find(function (item) { return item.id === Number(id); });
    if (!p) return Shop.toast("Không tìm thấy sản phẩm.");
    if (p.stock <= 0) return Shop.toast("Sản phẩm đã hết hàng.");
    var color = variant || p.color;
    var exists = Shop.cart.items.find(function (item) { return item.id === p.id && item.variant === color; });
    var currentQty = exists ? exists.quantity : 0;
    if (currentQty >= p.stock) return Shop.toast("Số lượng vượt tồn kho.");
    if (exists) exists.quantity += 1;
    else Shop.cart.items.push({ id:p.id, title:p.title, price:p.price, image:p.image, variant:color, quantity:1, stock:p.stock });
    Shop.saveCart(); Shop.toast("Đã thêm " + p.title + " vào giỏ hàng.");
    Shop.toggleMiniCart(true);
  };
  Shop.changeCartQty = function (id, variant, delta) {
    var item = Shop.cart.items.find(function (x) { return x.id === Number(id) && x.variant === variant; });
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) Shop.cart.items = Shop.cart.items.filter(function (x) { return x !== item; });
    else if (item.quantity > item.stock) { item.quantity = item.stock; Shop.toast("Đã đạt số lượng tồn kho tối đa."); }
    Shop.saveCart();
  };
  Shop.removeCartItem = function (id, variant) {
    Shop.cart.items = Shop.cart.items.filter(function (x) { return !(x.id === Number(id) && x.variant === variant); });
    Shop.saveCart();
  };
  Shop.toggleMiniCart = function (force) {
    var panel = document.getElementById("mini-cart");
    var open = typeof force === "boolean" ? force : panel.hidden;
    panel.hidden = !open;
    document.getElementById("cart-toggle").setAttribute("aria-expanded", String(open));
  };
  Shop.renderCart = function () {
    var count = document.getElementById("cart-count");
    var itemsEl = document.getElementById("mini-cart-items");
    if (!count || !itemsEl) return;
    count.textContent = Shop.cartCount();
    document.getElementById("mini-cart-total").textContent = Shop.formatMoney(Shop.cartTotal());
    document.getElementById("checkout-total").textContent = Shop.formatMoney(Shop.cartTotal());
    if (!Shop.cart.items.length) { itemsEl.innerHTML = '<p class="muted">Chưa có sản phẩm.</p>'; return; }
    itemsEl.innerHTML = Shop.cart.items.map(function (item) {
      return '<div class="mini-item"><img src="' + Shop.escapeHTML(item.image) + '" alt=""><div><strong>' + Shop.escapeHTML(item.title) + '</strong><small>' + Shop.escapeHTML(item.variant) + ' · ' + Shop.formatMoney(item.price) + '</small><div class="mini-item-actions"><button type="button" data-cart-action="decrease" data-id="' + item.id + '" data-variant="' + Shop.escapeHTML(item.variant) + '">−</button><b>' + item.quantity + '</b><button type="button" data-cart-action="increase" data-id="' + item.id + '" data-variant="' + Shop.escapeHTML(item.variant) + '">+</button></div></div><button type="button" class="icon-btn" data-cart-action="remove" data-id="' + item.id + '" data-variant="' + Shop.escapeHTML(item.variant) + '" aria-label="Xóa">×</button></div>';
    }).join("");
  };
})();
