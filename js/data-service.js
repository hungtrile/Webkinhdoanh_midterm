/* Q1 - Q3: AJAX (XMLHttpRequest), đọc Fake Store API, bổ sung màu/tồn kho và xuất XML. */
(function () {
  window.Shop = window.Shop || {};
  var Shop = window.Shop;
  Shop.API_URL = "https://fakestoreapi.com/products";
  Shop.products = [];
  Shop.currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  Shop.formatMoney = function (value) { return Shop.currency.format(Number(value) || 0); };
  Shop.escapeHTML = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  };
  Shop.request = function (url, callback, responseType) {
    var xhr = new XMLHttpRequest();
    var completed = false;
    function finish(err, text, request) {
      if (completed) return;
      completed = true;
      callback(err, text, request || xhr);
    }
    xhr.open("GET", url, true);
    xhr.timeout = 12000;
    if (responseType === "json") xhr.setRequestHeader("Accept", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) finish(null, xhr.responseText, xhr);
        else finish(new Error("HTTP " + xhr.status), null, xhr);
      }
    };
    xhr.onerror = function () { finish(new Error("Không thể kết nối máy chủ.")); };
    xhr.ontimeout = function () { finish(new Error("Yêu cầu quá thời gian.")); };
    xhr.onabort = function () { finish(new Error("Yêu cầu đã bị hủy.")); };
    xhr.send();
    return xhr;
  };
  Shop.colorById = function (id) {
    var colors = ["#c8a16a", "#6f8d79", "#415c70", "#a9a9a9", "#c48e9a", "#d5bd82"];
    return colors[(Number(id) - 1) % colors.length];
  };
  Shop.normalizeProducts = function (arr) {
    var products = arr.map(function (p) {
      return {
        id: Number(p.id), title: p.title || "Sản phẩm " + p.id,
        price: Number(p.price) || 0, description: p.description || "",
        category: p.category || "Other", image: p.image || "",
        rating: { rate: 0, count: 0 },
        color: p.color || Shop.colorById(p.id), stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : (5 + (Number(p.id) * 7) % 36)
      };
    });
    var inventory = {};
    try { inventory = JSON.parse(localStorage.getItem("bw08_inventory") || "{}"); } catch (e) { inventory = {}; }
    products.forEach(function (product) {
      if (Object.prototype.hasOwnProperty.call(inventory, product.id)) product.stock = Math.max(0, Number(inventory[product.id]) || 0);
    });
    return products;
  };
  Shop.saveInventory = function () {
    var inventory = {};
    (Shop.products || []).forEach(function (product) { inventory[product.id] = Math.max(0, Number(product.stock) || 0); });
    localStorage.setItem("bw08_inventory", JSON.stringify(inventory));
  };
  Shop.parseProductsXML = function (text) {
    var doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("localproducts.xml không hợp lệ.");
    var nodes = doc.getElementsByTagName("product");
    var arr = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      function txt(name) { var el = n.getElementsByTagName(name)[0]; return el ? el.textContent : ""; }
      var ratingNode = n.getElementsByTagName("rating")[0];
      arr.push({ id: Number(n.getAttribute("id")), title: txt("title"), price: Number(txt("price")), description: txt("description"), category: txt("category"), image: txt("image"), color: n.getAttribute("color"), stock: Number(n.getAttribute("stock")), rating: ratingNode ? { rate: Number(ratingNode.getAttribute("rate")), count: Number(ratingNode.getAttribute("count")) } : { rate: 0, count: 0 } });
    }
    return Shop.normalizeProducts(arr);
  };
  Shop.loadProducts = function (callback) {
    Shop.request(Shop.API_URL, function (err, text) {
      if (!err) {
        try {
          var parsed = JSON.parse(text);
          if (!Array.isArray(parsed) || !parsed.length) throw new Error("API không trả về danh sách sản phẩm.");
          Shop.products = Shop.normalizeProducts(parsed);
          localStorage.setItem("bw08_products_cache", JSON.stringify(Shop.products));
          callback(null, Shop.products, "api");
          return;
        } catch (e) { err = e; }
      }
      // API lỗi/CORS: đọc XML cục bộ để website vẫn chạy được.
      Shop.request("data/localproducts.xml", function (xmlErr, xmlText) {
        if (!xmlErr) {
          try {
            Shop.products = Shop.parseProductsXML(xmlText);
            callback(null, Shop.products, "xml");
            return;
          } catch (parseErr) { xmlErr = parseErr; }
        }
        try {
          var cached = JSON.parse(localStorage.getItem("bw08_products_cache") || "[]");
          if (cached.length) {
            Shop.products = Shop.normalizeProducts(cached);
            callback(null, Shop.products, "cache");
          } else {
            callback(xmlErr || err || new Error("Không có dữ liệu."), [], "error");
          }
        } catch (cacheErr) { callback(cacheErr, [], "error"); }
      });
    }, "json");
  };
  Shop.escapeXML = function (value) {
    return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
  };
  Shop.buildProductsXML = function () {
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<products>\n';
    Shop.products.forEach(function (p) {
      xml += '  <product id="' + p.id + '" color="' + Shop.escapeXML(p.color) + '" stock="' + p.stock + '">\n';
      ["title","price","description","category","image"].forEach(function (k) { xml += "    <" + k + ">" + Shop.escapeXML(p[k]) + "</" + k + ">\n"; });
      xml += '    <rating rate="' + Number(p.rating.rate || 0) + '" count="' + Number(p.rating.count || 0) + '" />\n';
      xml += '  </product>\n';
    });
    return xml + '</products>';
  };
  Shop.downloadText = function (name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };
  Shop.exportProductsXML = function () {
    if (!Shop.products.length) { Shop.toast("Chưa có dữ liệu để xuất."); return; }
    Shop.downloadText("localproducts.xml", Shop.buildProductsXML(), "application/xml;charset=utf-8");
    Shop.toast("Đã tạo file localproducts.xml để tải xuống.");
  };
})();
