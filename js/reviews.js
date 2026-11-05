/* Q5 - Đọc reviews.xml, lưu đánh giá mới và chỉ cho người đã mua đánh giá sản phẩm. */
(function () {
  var Shop = window.Shop = window.Shop || {};
  Shop.reviews = [];

  function currentCustomerId() {
    return Shop.currentUser && Shop.currentUser.type === "customer"
      ? String(Shop.currentUser.customerId || Shop.currentUser.id || "") : "";
  }
  function localReviews() {
    try { return JSON.parse(localStorage.getItem("bw08_customer_reviews") || "[]"); }
    catch (e) { return []; }
  }
  function sameCustomer(review) {
    var user = Shop.currentUser;
    if (!user || user.type !== "customer") return false;
    return (review.customerId && String(review.customerId) === currentCustomerId()) ||
      (review.customerEmail && String(review.customerEmail).toLowerCase() === String(user.email).toLowerCase());
  }
  Shop.loadReviews = function (callback) {
    Shop.request("data/reviews.xml", function (err, text) {
      var source = [];
      if (!err) {
        try {
          var doc = new DOMParser().parseFromString(text, "application/xml");
          if (doc.querySelector("parsererror")) throw new Error("reviews.xml không hợp lệ.");
          var nodes = doc.getElementsByTagName("review");
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            source.push({ id:n.getAttribute("id"), productId:Number(n.getAttribute("productId")), customerId:n.getAttribute("customerId"), rating:Number(n.getAttribute("rating")), date:n.getAttribute("date"), customerName:n.getElementsByTagName("customerName")[0].textContent, comment:n.getElementsByTagName("comment")[0].textContent, source:"xml" });
          }
        } catch (parseError) { err = parseError; }
      }
      // Đánh giá do khách gửi được giữ ở Local Storage vì trình duyệt không thể ghi trực tiếp ngược vào reviews.xml.
      Shop.reviews = source.concat(localReviews());
      if (callback) callback(err || null);
    });
  };

  Shop.getProductRating = function (id) {
    var list = Shop.reviews.filter(function (r) { return r.productId === Number(id); });
    if (!list.length) return { average:0, count:0, reviews:[] };
    var sum = list.reduce(function (total, item) { return total + Number(item.rating || 0); }, 0);
    return { average:sum/list.length, count:list.length, reviews:list };
  };

  Shop.getCustomerOrders = function () {
    if (!Shop.currentUser || Shop.currentUser.type !== "customer") return [];
    var email = String(Shop.currentUser.email || "").toLowerCase();
    var id = currentCustomerId();
    var orders = JSON.parse(localStorage.getItem("bw08_orders") || "[]");
    return orders.filter(function (o) {
      return ((o.customerEmail && String(o.customerEmail).toLowerCase() === email) || (id && String(o.customerId) === id)) &&
        o.status !== "Cancelled" && (o.paymentStatus === "Paid" || o.status === "Paid" || o.status === "Completed");
    });
  };

  Shop.hasPurchasedProduct = function (productId) {
    return Shop.getCustomerOrders().some(function (order) {
      return (order.items || []).some(function (item) { return Number(item.id) === Number(productId); });
    });
  };

  Shop.hasReviewedProduct = function (productId) {
    return Shop.reviews.some(function (review) {
      return Number(review.productId) === Number(productId) && sameCustomer(review);
    });
  };

  Shop.canReviewProduct = function (productId) {
    return !!(currentCustomerId() && Shop.hasPurchasedProduct(productId) && !Shop.hasReviewedProduct(productId));
  };

  Shop.showReviewDetails = function (id) {
    var product = Shop.products.find(function (p) { return p.id === Number(id); });
    if (!product) return;
    var info = Shop.getProductRating(id);
    var items = info.reviews.map(function (r) {
      return '<div class="review-item"><strong>' + Shop.escapeHTML(r.customerName) + ' · ' + '★'.repeat(Math.max(0, Math.min(5, Number(r.rating)))) + '</strong><p>' + Shop.escapeHTML(r.comment) + '</p><small class="muted">' + Shop.escapeHTML(r.date) + '</small></div>';
    }).join("");
    var canReview = Shop.canReviewProduct(id);
    var reviewAction = canReview
      ? '<button type="button" class="btn btn-primary" data-review-product="' + product.id + '">Viết đánh giá</button>'
      : (Shop.hasReviewedProduct(id) ? '<p class="muted">Bạn đã đánh giá sản phẩm này.</p>' : '<p class="muted">Bạn cần mua và thanh toán sản phẩm này trước khi đánh giá.</p>');
    document.getElementById("product-modal-body").innerHTML = '<span class="eyebrow">RATING DETAIL</span><h2 id="modal-title">Đánh giá: ' + Shop.escapeHTML(product.title) + '</h2><p><strong>' + info.average.toFixed(1) + ' / 5</strong> · ' + info.count + ' lượt đánh giá</p><div class="review-list">' + (items || '<p class="muted">Sản phẩm chưa có đánh giá.</p>') + '</div><div class="review-submit-action">' + reviewAction + '</div>';
    document.getElementById("product-modal").classList.remove("hidden");
  };

  Shop.showReviewForm = function (id) {
    var product = Shop.products.find(function (p) { return p.id === Number(id); });
    if (!product) return;
    if (!Shop.currentUser || Shop.currentUser.type !== "customer") {
      Shop.showLogin("Đăng nhập tài khoản khách hàng để đánh giá sản phẩm.", "orders");
      return;
    }
    if (!Shop.hasPurchasedProduct(id)) return Shop.toast("Bạn chỉ có thể đánh giá sản phẩm đã mua và thanh toán.");
    if (Shop.hasReviewedProduct(id)) return Shop.toast("Bạn đã đánh giá sản phẩm này.");
    document.getElementById("product-modal-body").innerHTML = '<span class="eyebrow">WRITE A REVIEW</span><h2 id="modal-title">Đánh giá sản phẩm</h2><p><strong>' + Shop.escapeHTML(product.title) + '</strong></p><form id="customer-review-form" class="stack-form" data-product-id="' + product.id + '"><label for="customer-review-rating">Số sao</label><select id="customer-review-rating" required><option value="">Chọn số sao</option><option value="1">1 sao</option><option value="2">2 sao</option><option value="3">3 sao</option><option value="4">4 sao</option><option value="5">5 sao</option></select><label for="customer-review-comment">Nhận xét</label><textarea id="customer-review-comment" rows="4" required minlength="5" maxlength="500" placeholder="Chia sẻ trải nghiệm của bạn..."></textarea><div id="customer-review-message" class="form-message" role="alert"></div><button class="btn btn-primary" type="submit">Gửi đánh giá</button></form>';
    document.getElementById("product-modal").classList.remove("hidden");
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("product-modal-body").addEventListener("click", function (event) {
      var button = event.target.closest("[data-review-product]");
      if (button) Shop.showReviewForm(button.getAttribute("data-review-product"));
    });
    document.getElementById("product-modal-body").addEventListener("submit", function (event) {
      var form = event.target.closest("#customer-review-form");
      if (!form) return;
      event.preventDefault();
      var productId = Number(form.getAttribute("data-product-id"));
      if (!Shop.canReviewProduct(productId)) {
        document.getElementById("customer-review-message").textContent = "Không đủ điều kiện đánh giá hoặc bạn đã đánh giá sản phẩm này.";
        return;
      }
      var rating = Number(document.getElementById("customer-review-rating").value);
      var comment = document.getElementById("customer-review-comment").value.trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 5) {
        document.getElementById("customer-review-message").textContent = "Vui lòng chọn 1–5 sao và nhập nhận xét ít nhất 5 ký tự.";
        return;
      }
      var review = {
        id:"USR-" + Date.now(), productId:productId,
        customerId:currentCustomerId(), customerEmail:Shop.currentUser.email,
        customerName:Shop.currentUser.fullName, rating:rating,
        date:new Date().toISOString().slice(0,10), comment:comment, source:"local"
      };
      var list = localReviews();
      list.push(review);
      localStorage.setItem("bw08_customer_reviews", JSON.stringify(list));
      Shop.reviews.push(review);
      Shop.toast("Cảm ơn bạn đã đánh giá sản phẩm.");
      Shop.showReviewDetails(productId);
      if (Shop.renderProducts) Shop.renderProducts(Shop.filteredProducts && Shop.filteredProducts.length ? Shop.filteredProducts : Shop.products);
      if (Shop.renderCustomerOrders && !document.getElementById("orders-view").classList.contains("hidden")) Shop.renderCustomerOrders();
    });
  });
})();
