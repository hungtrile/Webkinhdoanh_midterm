/* Khởi tạo website, điều hướng và hiển thị đơn hàng theo tài khoản. */
(function () {
  var Shop = window.Shop = window.Shop || {};

  Shop.toast = function (message) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(Shop.toastTimer);
    Shop.toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3000);
  };

  Shop.showLogin = function (message, pendingAction) {
    var modal = document.getElementById("login-modal");
    var msg = document.getElementById("login-message");
    if (msg) msg.textContent = message || "Vui lòng đăng nhập để tiếp tục.";
    Shop.pendingAction = pendingAction || "";
    if (modal) modal.classList.remove("hidden");
  };

  Shop.showPage = function (page) {
    var views = { products: "catalog-view", orders: "orders-view", admin: "admin-view" };
    if (page === "orders" && !Shop.currentUser) {
      Shop.pendingAction = "orders";
      Shop.showLogin("Vui lòng đăng nhập để xem đơn hàng của tài khoản.", "orders");
      return;
    }
    if (page === "orders" && Shop.currentUser.type === "employee" && !Shop.isSalesManager()) {
      Shop.toast("Tài khoản nhân viên không có quyền xem danh sách đơn hàng.");
      page = "products";
    }
    if (page === "admin" && !Shop.isSalesManager()) {
      Shop.showLogin("Đăng nhập bằng tài khoản Sales Manager để truy cập Admin.", "admin");
      return;
    }
    if (!views[page]) page = "products";

    Object.keys(views).forEach(function (key) {
      document.getElementById(views[key]).classList.add("hidden");
    });
    document.getElementById(views[page]).classList.remove("hidden");
    document.querySelectorAll(".nav-link").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-page") === page);
    });
    if (page === "orders") Shop.renderCustomerOrders();
    if (page === "admin") Shop.renderAdmin();
    try { history.replaceState(null, "", "#" + page); } catch (e) { location.hash = page; }
  };

  Shop.renderCustomerOrders = function () {
    var host = document.getElementById("customer-orders");
    var title = document.getElementById("orders-title");
    if (!host || !Shop.currentUser) return;

    var isManager = Shop.isSalesManager();
    var local = JSON.parse(localStorage.getItem("bw08_orders") || "[]");
    var orders;
    if (isManager) {
      orders = Shop.allOrders ? Shop.allOrders() : local;
      if (title) title.textContent = "Danh sách đơn hàng";
    } else {
      var email = String(Shop.currentUser.email || "").toLowerCase();
      var customerId = String(Shop.currentUser.customerId || Shop.currentUser.id || "");
      orders = local.filter(function (o) {
        return (o.customerEmail && String(o.customerEmail).toLowerCase() === email) ||
          (customerId && o.customerId && String(o.customerId) === customerId);
      });
      if (title) title.textContent = "Đơn hàng của tôi";
    }

    if (!orders.length) {
      host.innerHTML = '<div class="empty-state"><div>🧾</div><h3>' +
        (isManager ? "Chưa có đơn hàng trong hệ thống" : "Tài khoản chưa có đơn hàng") +
        '</h3></div>';
      return;
    }

    host.innerHTML = '<div class="customer-order-list">' + orders.map(function (o) {
      var isPaid = o.paymentStatus === "Paid" || o.status === "Paid" || o.status === "Completed";
      var itemRows = (o.items || []).map(function (item) {
        var reviewed = Shop.hasReviewedProduct ? Shop.hasReviewedProduct(item.id) : false;
        var reviewAction = !isManager && isPaid
          ? (reviewed ? '<span class="status-pill">Đã đánh giá</span>' : '<button type="button" class="btn btn-small btn-outline" data-order-review="' + item.id + '">Đánh giá sản phẩm</button>')
          : '';
        var p = (Shop.products || []).find(function (product) { return product.id === Number(item.id); });
        return '<div class="customer-order-product"><span>' + Shop.escapeHTML(item.title || (p ? p.title : "Sản phẩm " + item.id)) + ' · ' + item.quantity + ' × ' + Shop.formatMoney(item.price) + '</span><div>' + reviewAction + '</div></div>';
      }).join("");
      return '<article class="customer-order-card"><div class="customer-order-head"><div><strong>' + Shop.escapeHTML(o.code) + '</strong><small>' + new Date(o.date).toLocaleString("vi-VN") + '</small></div><div class="customer-order-total"><span>' + Shop.escapeHTML(o.status || "Processing") + '</span><strong>' + Shop.formatMoney(o.totalAmount) + '</strong></div></div>' +
        '<div class="customer-order-meta"><span>Người nhận: <strong>' + Shop.escapeHTML(o.customerName) + '</strong></span><span>' + Shop.escapeHTML(o.customerEmail || "") + '</span></div>' +
        '<div class="customer-order-items">' + itemRows + '</div></article>';
    }).join("") + '</div>';
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".nav-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        Shop.showPage(a.getAttribute("data-page"));
      });
    });
    document.getElementById("login-open").addEventListener("click", function () {
      Shop.showLogin("Đăng nhập tài khoản khách hàng hoặc nhân viên.", "");
    });
    document.getElementById("logout-btn").addEventListener("click", Shop.logout);
    document.getElementById("cart-toggle").addEventListener("click", function () { Shop.toggleMiniCart(); });
    document.getElementById("mini-cart-close").addEventListener("click", function () { Shop.toggleMiniCart(false); });
    document.getElementById("checkout-open").addEventListener("click", Shop.openCheckout);
    document.getElementById("customer-orders").addEventListener("click", function (event) {
      var reviewButton = event.target.closest("[data-order-review]");
      if (reviewButton) Shop.showReviewForm(reviewButton.getAttribute("data-order-review"));
    });
    document.getElementById("mini-cart-items").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cart-action]");
      if (!b) return;
      var id = b.getAttribute("data-id"), v = b.getAttribute("data-variant"), a = b.getAttribute("data-cart-action");
      if (a === "increase") Shop.changeCartQty(id, v, 1);
      else if (a === "decrease") Shop.changeCartQty(id, v, -1);
      else Shop.removeCartItem(id, v);
    });
    document.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", function () { document.getElementById(b.getAttribute("data-close")).classList.add("hidden"); });
    });
    document.querySelectorAll(".modal-backdrop").forEach(function (m) {
      m.addEventListener("click", function (e) { if (e.target === m) m.classList.add("hidden"); });
    });
    Shop.loadCart();
    Shop.loadAuthData(function (err) {
      if (err) Shop.toast("Không tải được dữ liệu tài khoản.");
      Shop.restoreSession();
      var requested = location.hash.replace("#", "");
      Shop.showPage(requested === "admin" && Shop.isSalesManager() ? "admin" :
        (requested === "orders" && Shop.currentUser ? "orders" : "products"));
    });
    Shop.loadReviews(function () {
      Shop.loadProducts(function (err, list) {
        if (err) Shop.toast("Không có dữ liệu sản phẩm.");
        Shop.renderCategories();
        Shop.renderProducts(list);
        document.getElementById("load-state").classList.add("hidden");
        if (location.hash === "#admin" && Shop.isSalesManager()) Shop.renderAdmin();
      });
    });
    Shop.loadOrdersXML(function () {
      if (Shop.isSalesManager && Shop.isSalesManager()) {
        if (!document.getElementById("orders-view").classList.contains("hidden")) Shop.renderCustomerOrders();
        if (!document.getElementById("admin-view").classList.contains("hidden")) Shop.renderAdmin();
      }
    });
  });
})();
