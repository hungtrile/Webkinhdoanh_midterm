/* Q6-Q7 - Đơn hàng, xác nhận thanh toán mô phỏng và cập nhật tồn kho. */
(function () {
  var Shop = window.Shop = window.Shop || {};
  Shop.checkoutSubmitting = false;

  Shop.renderCheckoutSummary = function () {
    var host = document.getElementById("checkout-order-items");
    if (!host) return;
    if (!Shop.cart.items.length) {
      host.innerHTML = '<p class="muted">Giỏ hàng đang trống.</p>';
      return;
    }
    host.innerHTML = '<div class="checkout-order-list">' + Shop.cart.items.map(function (item) {
      var lineTotal = Number(item.price) * Number(item.quantity);
      return '<div class="checkout-order-item"><img src="' + Shop.escapeHTML(item.image) + '" alt=""><div class="checkout-order-product"><strong>' + Shop.escapeHTML(item.title) + '</strong><small>Màu: ' + Shop.escapeHTML(item.variant || "Mặc định") + ' · Số lượng: ' + item.quantity + '</small></div><strong class="checkout-order-price">' + Shop.formatMoney(lineTotal) + '</strong></div>';
    }).join("") + '</div><div class="checkout-order-subtotal"><span>Tạm tính (' + Shop.cartCount() + ' sản phẩm)</span><strong>' + Shop.formatMoney(Shop.cartTotal()) + '</strong></div><div class="checkout-order-subtotal"><span>Phí giao hàng</span><strong>Miễn phí</strong></div>';
    document.getElementById("checkout-total").textContent = Shop.formatMoney(Shop.cartTotal());
  };

  Shop.openCheckout = function () {
    if (!Shop.currentUser) {
      Shop.showLogin("Bạn cần đăng nhập tài khoản khách hàng trước khi đặt hàng.", "checkout");
      return;
    }
    if (Shop.currentUser.type !== "customer") {
      Shop.toast("Tài khoản nhân viên/Admin chỉ được quản lý, không được đặt hàng.");
      return;
    }
    if (!Shop.cart.items.length) return Shop.toast("Giỏ hàng đang trống.");
    document.getElementById("checkout-message").textContent = "";
    var user = Shop.currentUser;
    document.getElementById("checkout-name").value = user.fullName || "";
    document.getElementById("checkout-email").value = user.email || "";
    document.getElementById("checkout-phone").value = user.phone || "";
    document.getElementById("checkout-address").value = user.address || "";
    Shop.renderCheckoutSummary();
    document.getElementById("checkout-modal").classList.remove("hidden");
  };

  Shop.createInvoiceXML = function (order) {
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<invoices>\n  <invoice code="' + Shop.escapeXML(order.code) + '" date="' + Shop.escapeXML(order.date) + '" status="' + Shop.escapeXML(order.status) + '">\n';
    xml += '    <customer id="' + Shop.escapeXML(order.customerId) + '" email="' + Shop.escapeXML(order.customerEmail) + '">' + Shop.escapeXML(order.customerName) + '</customer>\n';
    xml += '    <employee id="WEB">Website</employee>\n    <details>\n';
    order.items.forEach(function (item) {
      xml += '      <item productId="' + item.id + '" quantity="' + item.quantity + '" unitPrice="' + Number(item.price).toFixed(2) + '" variant="' + Shop.escapeXML(item.variant) + '" />\n';
    });
    xml += '    </details>\n    <total>' + Number(order.totalAmount).toFixed(2) + '</total>\n  </invoice>\n</invoices>';
    return xml;
  };

  Shop.saveOrder = function (order) {
    var orders = JSON.parse(localStorage.getItem("bw08_orders") || "[]");
    orders.unshift(order);
    localStorage.setItem("bw08_orders", JSON.stringify(orders));
    localStorage.setItem("bw08_last_invoice_xml", Shop.createInvoiceXML(order));
  };

  Shop.showOrderConfirmation = function (order) {
    var host = document.getElementById("order-confirmation-content");
    if (!host) return;
    host.innerHTML = '<div class="confirmation-mark">✓</div><h2>Thanh toán thành công</h2><p class="muted">Đơn hàng đã được xác nhận và tồn kho đã cập nhật.</p>' +
      '<div class="confirmation-info"><div><span>Mã đơn hàng</span><strong>' + Shop.escapeHTML(order.code) + '</strong></div><div><span>Người nhận</span><strong>' + Shop.escapeHTML(order.customerName) + '</strong></div><div><span>Email</span><strong>' + Shop.escapeHTML(order.customerEmail) + '</strong></div><div><span>Điện thoại</span><strong>' + Shop.escapeHTML(order.phone) + '</strong></div><div class="full"><span>Địa chỉ giao hàng</span><strong>' + Shop.escapeHTML(order.address) + '</strong></div></div>' +
      '<div class="confirmation-items">' + order.items.map(function (item) {
        return '<div><span>' + Shop.escapeHTML(item.title) + ' × ' + item.quantity + '</span><strong>' + Shop.formatMoney(item.price * item.quantity) + '</strong></div>';
      }).join("") + '</div><div class="checkout-total"><span>Tổng thanh toán</span><strong>' + Shop.formatMoney(order.totalAmount) + '</strong></div><span class="status-pill">Đã xác nhận thanh toán</span>';
    document.getElementById("order-confirmation-modal").classList.remove("hidden");
  };

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("checkout-form");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (Shop.checkoutSubmitting) return;
      var message = document.getElementById("checkout-message");
      if (!Shop.currentUser || Shop.currentUser.type !== "customer") {
        document.getElementById("checkout-modal").classList.add("hidden");
        Shop.openCheckout();
        return;
      }
      var name = document.getElementById("checkout-name").value.trim();
      var phone = document.getElementById("checkout-phone").value.trim();
      var email = document.getElementById("checkout-email").value.trim();
      var address = document.getElementById("checkout-address").value.trim();
      var phonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (!phonePattern.test(phone)) { message.textContent = "Số điện thoại chưa đúng định dạng Việt Nam."; return; }
      if (!emailPattern.test(email)) { message.textContent = "Email chưa hợp lệ."; return; }
      if (!Shop.cart.items.length) { message.textContent = "Giỏ hàng đang trống."; return; }

      // Kiểm tra lại tồn kho ngay tại thời điểm xác nhận thanh toán.
      var insufficient = Shop.cart.items.find(function (item) {
        var p = Shop.products.find(function (x) { return x.id === item.id; });
        return !p || Number(p.stock) < Number(item.quantity);
      });
      if (insufficient) { message.textContent = "Số lượng tồn kho không đủ cho sản phẩm: " + insufficient.title + ". Vui lòng quay lại giỏ hàng."; return; }

      Shop.checkoutSubmitting = true;
      var submitButton = form.querySelector('[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "Đang xác nhận thanh toán...";

      var user = Shop.currentUser;
      var orderItems = Shop.cart.items.map(function (x) { return Object.assign({}, x); });
      var order = {
        code: "INV-" + Date.now(), date: new Date().toISOString(), status: "Paid", paymentStatus: "Paid",
        paymentMethod: "Thanh toán mô phỏng", confirmedAt: new Date().toISOString(),
        customerId: user.customerId || user.id || "", customerEmail: user.email,
        customerName: name, phone: phone, email: email, address: address,
        employeeId: "WEB", employeeName: "Website", totalAmount: orderItems.reduce(function (sum, x) { return sum + Number(x.price) * Number(x.quantity); }, 0),
        items: orderItems
      };

      try {
        // Mô phỏng cổng thanh toán trả kết quả thành công; chỉ sau bước này mới trừ tồn kho.
        var orders = JSON.parse(localStorage.getItem("bw08_orders") || "[]");
        orders.unshift(order);
        var nextInventory = {};
        Shop.products.forEach(function (p) { nextInventory[p.id] = Number(p.stock) || 0; });
        orderItems.forEach(function (item) { nextInventory[item.id] = Math.max(0, nextInventory[item.id] - Number(item.quantity)); });
        localStorage.setItem("bw08_orders", JSON.stringify(orders));
        localStorage.setItem("bw08_inventory", JSON.stringify(nextInventory));
        localStorage.setItem("bw08_last_invoice_xml", Shop.createInvoiceXML(order));
        Shop.products.forEach(function (p) { p.stock = nextInventory[p.id]; });
      } catch (storageError) {
        Shop.checkoutSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = "Xác nhận thanh toán";
        message.textContent = "Không thể lưu đơn hàng. Vui lòng kiểm tra bộ nhớ trình duyệt và thử lại.";
        return;
      }

      Shop.cart.items = [];
      Shop.saveCart();
      Shop.toggleMiniCart(false);
      document.getElementById("checkout-modal").classList.add("hidden");
      Shop.checkoutSubmitting = false;
      submitButton.disabled = false;
      submitButton.textContent = "Xác nhận thanh toán";
      Shop.showOrderConfirmation(order);
      if (!document.getElementById("orders-view").classList.contains("hidden")) Shop.renderCustomerOrders();
      if (Shop.renderAdmin) Shop.renderAdmin();
      if (Shop.renderProducts) Shop.renderProducts(Shop.filteredProducts && Shop.filteredProducts.length ? Shop.filteredProducts : Shop.products);
      Shop.toast("Đã xác nhận thanh toán. Mã đơn: " + order.code);
    });

    var orderAgain = document.getElementById("confirmation-view-orders");
    if (orderAgain) orderAgain.addEventListener("click", function () {
      document.getElementById("order-confirmation-modal").classList.add("hidden");
      Shop.showPage("orders");
    });
  });
})();
