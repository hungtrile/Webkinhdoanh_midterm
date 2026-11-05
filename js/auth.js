/* Q1/Q8 - Nạp customers.json, employees.json bằng AJAX và phân quyền. */
(function () {
  var Shop = window.Shop = window.Shop || {};
  Shop.customers = [];
  Shop.employees = [];
  Shop.currentUser = null;

  Shop.loadAuthData = function (callback) {
    var done = 0, error = null;
    function finish(err, data, key) {
      if (err) error = error || err;
      else Shop[key] = data[key] || [];
      done++;
      if (done === 2 && callback) callback(error);
    }
    Shop.request("data/customers.json", function (err, text) {
      if (err) { finish(err); return; }
      try { finish(null, JSON.parse(text), "customers"); } catch (e) { finish(e); }
    });
    Shop.request("data/employees.json", function (err, text) {
      if (err) { finish(err); return; }
      try { finish(null, JSON.parse(text), "employees"); } catch (e) { finish(e); }
    });
  };

  Shop.login = function (email, password) {
    var customer = Shop.customers.find(function (u) { return u.email.toLowerCase() === email.toLowerCase() && u.password === password; });
    var employee = Shop.employees.find(function (u) { return u.email.toLowerCase() === email.toLowerCase() && u.password === password; });
    var user = employee ? Object.assign({ type: "employee" }, employee) :
      (customer ? Object.assign({ type: "customer" }, customer) : null);
    if (!user) return { ok: false, message: "Email hoặc mật khẩu không chính xác." };
    Shop.currentUser = user;
    localStorage.setItem("bw08_session", JSON.stringify(user));
    Shop.updateUserUI();
    return { ok: true, user: user };
  };

  Shop.restoreSession = function () {
    try { Shop.currentUser = JSON.parse(localStorage.getItem("bw08_session") || "null"); }
    catch (e) { Shop.currentUser = null; }
    Shop.updateUserUI();
  };

  Shop.isSalesManager = function () {
    return !!(Shop.currentUser && Shop.currentUser.type === "employee" && Shop.currentUser.position === "Sales Manager");
  };
  Shop.isEmployee = function () { return !!(Shop.currentUser && Shop.currentUser.type === "employee"); };
  Shop.canPurchase = function () { return !Shop.isEmployee(); };

  Shop.logout = function () {
    Shop.currentUser = null;
    localStorage.removeItem("bw08_session");
    Shop.pendingAction = "";
    Shop.updateUserUI();
    if (location.hash === "#admin" || location.hash === "#orders") Shop.showPage("products");
    Shop.toast("Bạn đã đăng xuất.");
  };

  Shop.updateUserUI = function () {
    var label = document.getElementById("user-status");
    var login = document.getElementById("login-open");
    var logout = document.getElementById("logout-btn");
    if (!label || !login || !logout) return;
    var adminLink = document.getElementById("admin-nav");
    var ordersLink = document.getElementById("orders-nav");
    var cartAnchor = document.getElementById("cart-anchor");
    var manager = Shop.isSalesManager();
    var employee = Shop.isEmployee();
    if (adminLink) adminLink.classList.toggle("hidden", !manager);
    if (ordersLink) ordersLink.classList.toggle("hidden", employee && !manager);
    if (cartAnchor) cartAnchor.classList.toggle("hidden", employee);

    if (Shop.currentUser) {
      label.textContent = Shop.currentUser.fullName + (Shop.currentUser.position ? " · " + Shop.currentUser.position : "");
      login.classList.add("hidden");
      logout.classList.remove("hidden");
    } else {
      label.textContent = "Bạn đang mua sắm với tư cách khách";
      login.classList.remove("hidden");
      logout.classList.add("hidden");
    }
    if (Shop.products && Shop.products.length && Shop.renderProducts && Shop._hasRenderedProducts) {
      Shop.renderProducts(Shop.filteredProducts || Shop.products);
    }
    if (location.hash === "#admin" && !manager) Shop.showPage("products");
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var result = Shop.login(document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
      var msg = document.getElementById("login-message");
      if (!result.ok) { msg.textContent = result.message; return; }
      msg.textContent = "";
      document.getElementById("login-modal").classList.add("hidden");
      Shop.toast("Xin chào " + result.user.fullName + "!");

      var action = Shop.pendingAction || "";
      Shop.pendingAction = "";
      if (action === "admin") {
        if (Shop.isSalesManager()) Shop.showPage("admin");
        else Shop.toast("Chỉ Sales Manager được truy cập Admin.");
      } else if (action === "orders") {
        Shop.showPage("orders");
      } else if (action === "checkout") {
        if (result.user.type === "customer") Shop.openCheckout();
        else Shop.toast("Tài khoản nhân viên không được phép đặt hàng.");
      }
    });
  });
})();
