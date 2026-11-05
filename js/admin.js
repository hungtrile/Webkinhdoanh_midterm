/* Q8 - Admin Sales Manager: theo dõi đơn hàng, doanh thu và yêu cầu nhập kho. */
(function () {
  var Shop = window.Shop = window.Shop || {};
  Shop.xmlOrders = [];

  Shop.loadOrdersXML = function (callback) {
    Shop.request("data/carts.xml", function (err, text) {
      if (err) { Shop.xmlOrders = []; if (callback) callback(err); return; }
      try {
        var doc = new DOMParser().parseFromString(text, "application/xml");
        if (doc.querySelector("parsererror")) throw new Error("carts.xml không hợp lệ.");
        var nodes = doc.getElementsByTagName("invoice");
        Shop.xmlOrders = [];
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          var customer = n.getElementsByTagName("customer")[0];
          var employee = n.getElementsByTagName("employee")[0];
          var detailNodes = n.getElementsByTagName("item");
          var items = [];
          for (var j = 0; j < detailNodes.length; j++) {
            items.push({ id: Number(detailNodes[j].getAttribute("productId")), quantity: Number(detailNodes[j].getAttribute("quantity")), price: Number(detailNodes[j].getAttribute("unitPrice")) });
          }
          Shop.xmlOrders.push({
            code: n.getAttribute("code"), date: n.getAttribute("date"), status: n.getAttribute("status"),
            customerName: customer ? customer.textContent : "", customerId: customer ? customer.getAttribute("id") : "",
            customerEmail: customer ? customer.getAttribute("email") : "",
            employeeName: employee ? employee.textContent : "", employeeId: employee ? employee.getAttribute("id") : "",
            totalAmount: Number(n.getElementsByTagName("total")[0].textContent), items: items
          });
        }
        if (callback) callback(null);
      } catch (e) { Shop.xmlOrders = []; if (callback) callback(e); }
    });
  };

  Shop.allOrders = function () {
    var local = JSON.parse(localStorage.getItem("bw08_orders") || "[]");
    var localCodes = {};
    local.forEach(function (o) { localCodes[o.code] = true; });
    return local.concat(Shop.xmlOrders.filter(function (o) { return !localCodes[o.code]; }));
  };

  function getMonthlyRevenue(orders) {
    var now = new Date();
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      months.push({ key: key, label: date.toLocaleDateString("vi-VN", { month: "short" }), revenue: 0, count: 0 });
    }
    orders.forEach(function (order) {
      if (order.status === "Cancelled") return;
      var date = new Date(order.date);
      var key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      var month = months.find(function (m) { return m.key === key; });
      if (month) { month.revenue += Number(order.totalAmount) || 0; month.count++; }
    });
    return months;
  }

  function renderRevenueChart(orders) {
    var months = getMonthlyRevenue(orders);
    var max = Math.max.apply(null, months.map(function (m) { return m.revenue; }).concat([1]));
    return '<div class="revenue-chart" role="img" aria-label="Biểu đồ doanh thu 6 tháng gần nhất">' +
      '<div class="chart-axis"><span>' + Shop.formatMoney(max) + '</span><span>' + Shop.formatMoney(max / 2) + '</span><span>$0</span></div>' +
      '<div class="chart-bars">' + months.map(function (m) {
        var height = m.revenue ? Math.max(5, Math.round(m.revenue / max * 100)) : 2;
        return '<div class="chart-column"><strong>' + (m.revenue ? Shop.formatMoney(m.revenue) : "$0") + '</strong><div class="chart-bar-track"><div class="chart-bar" style="height:' + height + '%"></div></div><span>' + Shop.escapeHTML(m.label) + '</span><small>' + m.count + ' đơn</small></div>';
      }).join("") + '</div></div>';
  }

  function getRestockRequests() {
    try { return JSON.parse(localStorage.getItem("bw08_restock_requests") || "[]"); }
    catch (e) { return []; }
  }

  function renderRestockRequests() {
    var requests = getRestockRequests();
    if (!requests.length) return '<p class="muted">Chưa có yêu cầu nhập hàng.</p>';
    return '<div class="table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Ngày yêu cầu</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      requests.map(function (request) {
        var action = request.status === "Đã nhập" ? '<span class="status-pill">Đã nhập</span>' : '<button type="button" class="btn btn-small btn-primary" data-restock-received="' + Shop.escapeHTML(request.id) + '">Xác nhận đã nhập</button>';
        return '<tr><td>' + Shop.escapeHTML(request.productName) + '</td><td>' + request.quantity + '</td><td>' + new Date(request.date).toLocaleDateString("vi-VN") + '</td><td>' + Shop.escapeHTML(request.status) + '</td><td>' + action + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderInventory() {
    if (!Shop.products || !Shop.products.length) return '<p class="muted">Đang tải dữ liệu tồn kho.</p>';
    return '<div class="table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Số lượng cần nhập</th><th></th></tr></thead><tbody>' +
      Shop.products.map(function (p) {
        return '<tr><td>' + Shop.escapeHTML(p.title) + '</td><td><span class="stock-number ' + (p.stock <= 5 ? 'stock-low' : '') + '">' + p.stock + '</span></td><td><input class="restock-qty" type="number" min="1" max="9999" value="10" aria-label="Số lượng cần nhập cho ' + Shop.escapeHTML(p.title) + '" data-restock-qty="' + p.id + '"></td><td><button type="button" class="btn btn-small btn-outline" data-restock="' + p.id + '">Yêu cầu nhập</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  Shop.renderAdmin = function () {
    var container = document.getElementById("admin-content");
    if (!container) return;
    if (!Shop.isSalesManager()) {
      container.innerHTML = '<div class="empty-state"><div>🔒</div><h3>Quyền truy cập bị giới hạn</h3><button class="btn btn-primary" id="admin-login-required" type="button">Đăng nhập Sales Manager</button></div>';
      var b = document.getElementById("admin-login-required");
      if (b) b.addEventListener("click", function () { Shop.showLogin("Đăng nhập bằng tài khoản Sales Manager để truy cập Admin.", "admin"); });
      return;
    }

    var orders = Shop.allOrders();
    var revenue = orders.reduce(function (sum, o) { return sum + (o.status === "Cancelled" ? 0 : (Number(o.totalAmount) || 0)); }, 0);
    var lowStock = Shop.products.filter(function (p) { return p.stock <= 5; }).length;
    var qtyByProduct = {};
    orders.forEach(function (o) { (o.items || []).forEach(function (item) { qtyByProduct[item.id] = (qtyByProduct[item.id] || 0) + item.quantity; }); });
    var best = Object.keys(qtyByProduct).map(function (id) {
      var p = Shop.products.find(function (x) { return x.id === Number(id); });
      return { title: p ? p.title : "Product " + id, qty: qtyByProduct[id] };
    }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);

    var rows = orders.map(function (o) {
      return '<tr><td><strong>' + Shop.escapeHTML(o.code) + '</strong></td><td>' + Shop.escapeHTML(new Date(o.date).toLocaleDateString("vi-VN")) + '</td><td>' + Shop.escapeHTML(o.customerName) + '</td><td>' + Shop.escapeHTML(o.employeeName || "Website") + '</td><td>' + Shop.formatMoney(o.totalAmount) + '</td><td><span class="status-pill">' + Shop.escapeHTML(o.status) + '</span></td></tr>';
    }).join("");

    container.innerHTML =
      '<div class="stat-grid"><div class="stat-card"><span>Tổng doanh thu ghi nhận</span><strong>' + Shop.formatMoney(revenue) + '</strong></div><div class="stat-card"><span>Số hóa đơn</span><strong>' + orders.length + '</strong></div><div class="stat-card"><span>Sản phẩm trong catalog</span><strong>' + Shop.products.length + '</strong></div><div class="stat-card"><span>Sản phẩm tồn kho thấp (≤ 5)</span><strong>' + lowStock + '</strong></div></div>' +
      '<section class="admin-card chart-card"><h3>Biểu đồ doanh thu 6 tháng gần nhất</h3>' + renderRevenueChart(orders) + '</section>' +
      '<div class="admin-grid admin-grid-orders"><section class="admin-card"><h3>Danh sách hóa đơn</h3><div class="table-wrap"><table><thead><tr><th>Mã hóa đơn</th><th>Ngày</th><th>Khách hàng</th><th>Nhân viên</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">Chưa có hóa đơn.</td></tr>') + '</tbody></table></div></section><section class="admin-card"><h3>Sản phẩm bán chạy</h3>' + (best.length ? best.map(function (x) { return '<div class="best-item"><span>' + Shop.escapeHTML(x.title) + '</span><strong>' + x.qty + ' sp</strong></div>'; }).join("") : '<p class="muted">Chưa có dữ liệu bán hàng.</p>') + '</section></div>' +
      '<section class="admin-card inventory-card"><h3>Kiểm tra tồn kho và yêu cầu nhập hàng</h3><p class="muted">Số lượng tồn kho được cập nhật sau mỗi đơn hàng và khi xác nhận nhập kho.</p>' + renderInventory() + '</section>' +
      '<section class="admin-card inventory-card"><h3>Yêu cầu nhập hàng</h3>' + renderRestockRequests() + '</section>';

    if (!container.getAttribute("data-admin-listeners")) {
      container.setAttribute("data-admin-listeners", "1");
      container.addEventListener("click", function (event) {
        var requestButton = event.target.closest("[data-restock]");
        var receivedButton = event.target.closest("[data-restock-received]");
        if (requestButton) {
          var id = Number(requestButton.getAttribute("data-restock"));
          var input = container.querySelector('[data-restock-qty="' + id + '"]');
          var quantity = input ? Number(input.value) : 0;
          var product = Shop.products.find(function (p) { return p.id === id; });
          if (!product || !Number.isInteger(quantity) || quantity < 1) { Shop.toast("Vui lòng nhập số lượng cần nhập hợp lệ."); return; }
          var requests = getRestockRequests();
          requests.unshift({ id: "RST-" + Date.now(), productId: id, productName: product.title, quantity: quantity, date: new Date().toISOString(), status: "Chờ nhập" });
          localStorage.setItem("bw08_restock_requests", JSON.stringify(requests));
          Shop.toast("Đã tạo yêu cầu nhập " + quantity + " sản phẩm.");
          Shop.renderAdmin();
          return;
        }
        if (receivedButton) {
          var requestId = receivedButton.getAttribute("data-restock-received");
          var list = getRestockRequests();
          var restock = list.find(function (r) { return r.id === requestId; });
          if (!restock || restock.status === "Đã nhập") return;
          var targetProduct = Shop.products.find(function (p) { return p.id === Number(restock.productId); });
          if (targetProduct) {
            targetProduct.stock += Number(restock.quantity);
            if (Shop.saveInventory) Shop.saveInventory();
          }
          restock.status = "Đã nhập";
          restock.receivedDate = new Date().toISOString();
          localStorage.setItem("bw08_restock_requests", JSON.stringify(list));
          Shop.toast("Đã cập nhật tồn kho.");
          Shop.renderAdmin();
          if (Shop.renderProducts) Shop.renderProducts(Shop.filteredProducts || Shop.products);
        }
      });
    }
  };
})();
