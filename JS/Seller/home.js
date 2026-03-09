/* ═══════════════════════════════════════════════
   DEALPORT – SELLER DASHBOARD  |  script.js
═══════════════════════════════════════════════ */

$(function () {

  /* ─────────────────────────────────────────
     SIDEBAR: Desktop collapse toggle
  ───────────────────────────────────────── */
  $('#sidebarCollapseBtn').on('click', function () {
    $('#sidebar').toggleClass('collapsed');
  });

  /* ─────────────────────────────────────────
     SIDEBAR: Mobile open / close
  ───────────────────────────────────────── */
  $('#mobileSidebarBtn').on('click', function () {
    $('#sidebar').addClass('mobile-open');
    $('#sidebarOverlay').addClass('active');
  });

  $('#sidebarOverlay').on('click', function () {
    $('#sidebar').removeClass('mobile-open');
    $(this).removeClass('active');
  });

  const $dashboardView = $('#dashboardView');
  const $orderManagementView = $('#orderManagementView');
  const $pageTitle = $('.page-title');
  const $embeddedPageFrame = $('#embeddedPageFrame');
  let transactionPaymentFilter = 'all';
  let bestSellingInventoryFilter = 'all';
  let darkMode = $('body').hasClass('dark');

  function closeMobileSidebar() {
    $('#sidebar').removeClass('mobile-open');
    $('#sidebarOverlay').removeClass('active');
  }

  function setActiveNavLink(linkSelector) {
    $('.nav-link').removeClass('active');
    $(linkSelector).addClass('active');
  }

  function syncNavFromEmbeddedPage() {
    const iframe = $embeddedPageFrame.get(0);
    if (!iframe || !iframe.contentWindow) return;

    let fileName = '';
    try {
      const path = iframe.contentWindow.location.pathname || '';
      fileName = path.split('/').pop().toLowerCase();
    } catch (err) {
      return;
    }

    if (fileName === 'productlist.html') {
      setActiveNavLink('#productListLink');
      $pageTitle.text('Product List');
      return;
    }

    if (fileName === 'addproductpage.html') {
      setActiveNavLink('#addProductPageLink');
      $pageTitle.text('Add Product');
      return;
    }

    if (fileName === 'productmedia.html') {
      setActiveNavLink('#productMediaLink');
      $pageTitle.text('Product Media');
      return;
    }

    if (fileName === 'ordermanagement.html') {
      setActiveNavLink('#orderManagementLink');
      $pageTitle.text('Order Management');
    }
  }

  function syncEmbeddedTheme() {
    const iframe = $embeddedPageFrame.get(0);
    if (!iframe || !iframe.contentWindow || !iframe.contentWindow.document) return;
    iframe.contentWindow.document.body.classList.toggle('dark', darkMode);
  }

  function formatTxnDate(rawDate) {
    const d = new Date(rawDate || Date.now());
    if (Number.isNaN(d.getTime())) return '-';
    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short'
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
    return `${datePart} | ${timePart}`;
  }

  function loadDashboardOrders() {
    try {
      const parsed = JSON.parse(localStorage.getItem('ls_orders'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function startOfWeek(dateValue) {
    const d = new Date(dateValue || Date.now());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function buildWeeklySalesData(weekOffset = 0) {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() - (weekOffset * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const totals = [0, 0, 0, 0, 0, 0, 0];
    const orders = loadDashboardOrders();

    orders.forEach((order) => {
      const dt = new Date(order?.createdAt || order?.date || 0);
      if (Number.isNaN(dt.getTime())) return;
      if (dt < start || dt >= end) return;

      const amount = Number(order?.price ?? order?.total ?? order?.totalPrice);
      if (!Number.isFinite(amount)) return;

      totals[dt.getDay()] += amount;
    });

    return totals.map((v) => Number(v.toFixed(2)));
  }

  function loadDashboardProducts() {
    const keys = ['ls_products', 'products', 'sellerProducts'];
    for (const key of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(parsed)) return parsed;
      } catch (_err) {
        // try next key
      }
    }
    return [];
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeDashboardProduct(raw, idx) {
    const name = String(raw?.productName ?? raw?.name ?? `Product ${idx + 1}`).trim();
    const id = String(raw?.id ?? idx + 1);
    const price = Number(raw?.price);
    const stock = Number(raw?.stockQuantity ?? raw?.stock);
    const categoryRaw =
      raw?.category ??
      raw?.productCategory ??
      raw?.product_category ??
      raw?.categoryName ??
      raw?.productCategoryName ??
      raw?.type ??
      raw?.tag;

    let image = '';
    if (typeof raw?.image === 'string' && raw.image.trim()) image = raw.image.trim();
    else if (typeof raw?.imageUrl === 'string' && raw.imageUrl.trim()) image = raw.imageUrl.trim();
    else if (Array.isArray(raw?.images) && raw.images.length) {
      const first = raw.images[0];
      if (typeof first === 'string' && first.trim()) image = first.trim();
      else if (first && typeof first.url === 'string' && first.url.trim()) image = first.url.trim();
    }

    return {
      id,
      name,
      category: String(categoryRaw ?? '').trim(),
      image: image || `https://placehold.co/80x80/ecfdf5/166534?text=${encodeURIComponent(name || 'P')}`,
      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : null,
      createdAt: new Date(raw?.createdAt ?? raw?.date ?? 0).getTime()
    };
  }

  function categoryIconClass(categoryName) {
    const key = String(categoryName || '').toLowerCase();
    if (key.includes('elect')) return 'bi-phone';
    if (key.includes('fashion') || key.includes('cloth')) return 'bi-bag';
    if (key.includes('home') || key.includes('furniture')) return 'bi-house';
    if (key.includes('beauty') || key.includes('health')) return 'bi-heart';
    if (key.includes('sport')) return 'bi-trophy';
    return 'bi-grid';
  }

  function renderDashboardCategories() {
    const listEl = document.getElementById('dashboardCategoryList');
    if (!listEl) return;

    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));
    const categoryCounts = new Map();

    products.forEach((product) => {
      let key = String(product.category || '').trim();
      if (key === '-' || key.toLowerCase() === 'n/a' || key.toLowerCase() === 'none') {
        key = 'Other';
      }
      if (!key) return;
      categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    });

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => {
        const aOther = a[0].toLowerCase() === 'other';
        const bOther = b[0].toLowerCase() === 'other';
        if (aOther && !bOther) return 1;
        if (!aOther && bOther) return -1;
        return b[1] - a[1];
      })
      .slice(0, 6);

    if (!topCategories.length) {
      listEl.innerHTML = `
        <div class="category-row">
          <div class="cat-icon"><i class="bi bi-grid"></i></div>
          <span class="cat-name">No categories yet</span>
          <i class="bi bi-chevron-right ms-auto text-muted"></i>
        </div>
      `;
      return;
    }

    listEl.innerHTML = topCategories.map(([category, count]) => `
      <div class="category-row">
        <div class="cat-icon"><i class="bi ${categoryIconClass(category)}"></i></div>
        <span class="cat-name">${category} (${count})</span>
        <i class="bi bi-chevron-right ms-auto text-muted"></i>
      </div>
    `).join('');
  }

  function renderDashboardQuickProducts() {
    const listEl = document.getElementById('dashboardQuickAddList');
    if (!listEl) return;

    const products = loadDashboardProducts()
      .map((p, idx) => normalizeDashboardProduct(p, idx))
      .sort((a, b) => {
        const aDate = Number.isFinite(a.createdAt) ? a.createdAt : 0;
        const bDate = Number.isFinite(b.createdAt) ? b.createdAt : 0;
        return bDate - aDate;
      })
      .slice(0, 3);

    if (!products.length) {
      listEl.innerHTML = `
        <div class="quick-add-row">
          <div class="qa-meta">
            <span class="qa-name">No products yet</span>
            <span class="qa-price text-success">$0.00</span>
          </div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = products.map((p) => `
      <div class="quick-add-row">
        <img src="${escapeHtml(p.image)}" class="qa-img" alt="${escapeHtml(p.name)}" />
        <div class="qa-meta">
          <span class="qa-name">${escapeHtml(p.name)}</span>
          <span class="qa-price text-success">$${Number(p.price || 0).toFixed(2)}</span>
        </div>
        <button class="btn-add" data-product-id="${escapeHtml(p.id)}">
          <i class="bi bi-plus-circle-fill me-1"></i>Add
        </button>
      </div>
    `).join('');
  }

  function extractOrderItems(order) {
    if (Array.isArray(order?.products) && order.products.length) return order.products;
    if (Array.isArray(order?.items) && order.items.length) return order.items;
    if (order?.product) return [{ name: order.product, qty: 1 }];
    return [];
  }

  function renderBestSellingTable() {
    const tbody = document.getElementById('bestSellingTableBody');
    if (!tbody) return;

    const rawOrders = loadDashboardOrders();
    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));
    const productById = new Map(products.map((p) => [String(p.id), p]));
    const productByName = new Map(products.map((p) => [p.name.toLowerCase(), p]));

    const sold = new Map();

    rawOrders.forEach((order) => {
      extractOrderItems(order).forEach((item) => {
        const itemId = String(item?.id ?? item?.productId ?? item?.product_id ?? '').trim();
        const itemName = String(item?.name ?? item?.productName ?? item?.product ?? item?.title ?? '').trim();
        const qtyRaw = Number(item?.qty ?? item?.quantity ?? 1);
        const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
        const unitPriceRaw = Number(item?.unitPrice ?? item?.price ?? 0);

        const matched = itemId ? productById.get(itemId) : (productByName.get(itemName.toLowerCase()) ?? null);
        const key = itemId || itemName.toLowerCase();
        if (!key) return;

        if (!sold.has(key)) {
          sold.set(key, {
            id: matched?.id ?? itemId ?? key,
            name: matched?.name ?? itemName ?? 'Unknown Product',
            image: matched?.image ?? `https://placehold.co/80x80/ecfdf5/166534?text=${encodeURIComponent(itemName || 'P')}`,
            price: Number.isFinite(matched?.price) ? matched.price : (Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0),
            stock: matched?.stock ?? null,
            totalQty: 0
          });
        }

        sold.get(key).totalQty += qty;
      });
    });

    let top = Array.from(sold.values())
      .sort((a, b) => b.totalQty - a.totalQty);

    if (bestSellingInventoryFilter !== 'all') {
      top = top.filter((item) => {
        const stock = Number(item.stock);
        if (!Number.isFinite(stock)) return bestSellingInventoryFilter === 'in-stock';
        if (bestSellingInventoryFilter === 'in-stock') return stock > 10;
        if (bestSellingInventoryFilter === 'low-stock') return stock > 0 && stock <= 10;
        return stock <= 0;
      });
    }

    top = top.slice(0, 6);

    if (!top.length) {
      tbody.innerHTML = '<tr><td colspan="4">No order data yet.</td></tr>';
      return;
    }

    tbody.innerHTML = top.map((item) => {
      const stock = Number(item.stock);
      const hasStock = !Number.isFinite(stock) ? true : stock > 0;
      const isLowStock = Number.isFinite(stock) && stock > 0 && stock <= 10;
      const statusDot = hasStock ? (isLowStock ? 'pending' : 'paid') : 'danger-dot';
      const statusTextClass = hasStock ? (isLowStock ? 'text-warning' : 'text-success') : 'text-danger';
      const statusLabel = hasStock ? (isLowStock ? 'Low stock' : 'Stock') : 'Stock out';

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2">
              <img src="${item.image}" class="tbl-prod-img" alt="${item.name}" />
              ${item.name}
            </div>
          </td>
          <td>${item.totalQty}</td>
          <td><span class="status-dot ${statusDot}"></span><span class="${statusTextClass}">${statusLabel}</span></td>
          <td>$${Number(item.price || 0).toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  }

  function cycleBestSellingFilter() {
    if (bestSellingInventoryFilter === 'all') bestSellingInventoryFilter = 'in-stock';
    else if (bestSellingInventoryFilter === 'in-stock') bestSellingInventoryFilter = 'low-stock';
    else if (bestSellingInventoryFilter === 'low-stock') bestSellingInventoryFilter = 'out-stock';
    else bestSellingInventoryFilter = 'all';

    const label = document.getElementById('bestSellingFilterLabel');
    if (label) {
      const text = bestSellingInventoryFilter === 'all'
        ? 'All Inventory'
        : (bestSellingInventoryFilter === 'in-stock'
          ? 'In Stock'
          : (bestSellingInventoryFilter === 'low-stock' ? 'Low Stock' : 'Out of Stock'));
      label.textContent = `Filter: ${text}`;
    }
    renderBestSellingTable();
  }

  function renderTransactionTable() {
    const tbody = document.getElementById('transactionTableBody');
    if (!tbody) return;

    let orders = loadDashboardOrders()
      .slice()
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
      .slice(0, 20);

    if (transactionPaymentFilter !== 'all') {
      orders = orders.filter((order) => {
        const payment = String(order.payment ?? '').toLowerCase();
        const isPaid = payment === 'paid';
        return transactionPaymentFilter === 'paid' ? isPaid : !isPaid;
      });
    }

    orders = orders.slice(0, 6);

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="5">No transactions yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map((order, idx) => {
      const id = String(order.id ?? order.orderId ?? `ORD-${idx + 1}`);
      const amount = Number(order.price ?? order.total ?? order.totalPrice);
      const isPaid = String(order.payment ?? '').toLowerCase() === 'paid';
      const paymentText = isPaid ? 'Paid' : 'Pending';
      const dotClass = isPaid ? 'paid' : 'pending';
      return `
        <tr>
          <td>${idx + 1}.</td>
          <td>#${id}</td>
          <td>${formatTxnDate(order.createdAt || order.date)}</td>
          <td><span class="status-dot ${dotClass}"></span>${paymentText}</td>
          <td>$${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}</td>
        </tr>
      `;
    }).join('');
  }

  function renderDashboardOrderStats() {
    const totalSalesEl = document.getElementById('totalSalesStatValue');
    const totalOrdersEl = document.getElementById('totalOrdersStatValue');
    const orders = loadDashboardOrders();

    if (totalOrdersEl) {
      totalOrdersEl.textContent = String(orders.length);
    }

    if (totalSalesEl) {
      const totalSales = orders.reduce((sum, order) => {
        const payment = String(order?.payment ?? '').toLowerCase();
        const status = String(order?.status ?? '').toLowerCase();
        const delivered = status === 'delivered';
        const paid = payment === 'paid';
        if (!delivered || !paid) return sum;

        const amount = Number(order?.price ?? order?.total ?? order?.totalPrice);
        return Number.isFinite(amount) ? sum + amount : sum;
      }, 0);

      totalSalesEl.textContent = `$${totalSales.toFixed(2)}`;
    }
  }

  function renderPendingCanceledStats() {
    const pendingEl = document.getElementById('pendingOrdersStatValue');
    const canceledEl = document.getElementById('canceledOrdersStatValue');
    const pendingSubEl = document.getElementById('pendingOrdersStatSub');
    if (!pendingEl || !canceledEl) return;

    const orders = loadDashboardOrders();
    const pendingCount = orders.filter((o) => String(o?.status ?? '').toLowerCase() === 'pending').length;
    const canceledCount = orders.filter((o) => {
      const status = String(o?.status ?? '').toLowerCase();
      return status === 'cancelled' || status === 'canceled';
    }).length;

    pendingEl.textContent = String(pendingCount);
    canceledEl.textContent = String(canceledCount);
    if (pendingSubEl) pendingSubEl.textContent = `orders ${pendingCount}`;
  }

  function cycleTransactionFilter() {
    if (transactionPaymentFilter === 'all') transactionPaymentFilter = 'paid';
    else if (transactionPaymentFilter === 'paid') transactionPaymentFilter = 'pending';
    else transactionPaymentFilter = 'all';

    const label = document.getElementById('transactionFilterLabel');
    if (label) {
      const text = transactionPaymentFilter === 'all'
        ? 'All'
        : (transactionPaymentFilter === 'paid' ? 'Paid' : 'Pending');
      label.textContent = `Filter: ${text}`;
    }

    renderTransactionTable();
  }

  function showDashboard() {
    $dashboardView.show();
    $orderManagementView.hide();
    $pageTitle.text('Dashboard');
    setActiveNavLink('#dashboardLink');
    closeMobileSidebar();
    renderDashboardOrderStats();
    renderPendingCanceledStats();
    renderTransactionTable();
    renderBestSellingTable();
    renderDashboardCategories();
    renderDashboardQuickProducts();
  }

  function showOrderManagement() {
    $embeddedPageFrame.attr('src', 'OrderManagement.html');
    $dashboardView.hide();
    $orderManagementView.show();
    $pageTitle.text('Order Management');
    setActiveNavLink('#orderManagementLink');
    closeMobileSidebar();
  }

  function showProductList() {
    $embeddedPageFrame.attr('src', 'ProductList.html');
    $dashboardView.hide();
    $orderManagementView.show();
    $pageTitle.text('Product List');
    setActiveNavLink('#productListLink');
    closeMobileSidebar();
  }

  function showProductMedia() {
    $embeddedPageFrame.attr('src', 'ProductMedia.html');
    $dashboardView.hide();
    $orderManagementView.show();
    $pageTitle.text('Product Media');
    setActiveNavLink('#productMediaLink');
    closeMobileSidebar();
  }

  $embeddedPageFrame.on('load', function () {
    syncEmbeddedTheme();
    syncNavFromEmbeddedPage();
  });

  /* ─────────────────────────────────────────
     NAV LINK: active state switch
  ───────────────────────────────────────── */
  $('.nav-link').on('click', function (e) {
    e.preventDefault();
    setActiveNavLink(this);
  });

  $('#dashboardLink').on('click', function () {
    showDashboard();
  });

  $('#orderManagementLink').on('click', function () {
    showOrderManagement();
  });

  $('#transactionDetailsBtn').on('click', function () {
    showOrderManagement();
  });

  $('#totalOrdersDetailsBtn').on('click', function () {
    showOrderManagement();
  });

  $('#pendingCanceledDetailsBtn').on('click', function () {
    showOrderManagement();
  });

  $('#transactionFilterBtn').on('click', function () {
    cycleTransactionFilter();
  });

  $('#productListLink').on('click', function () {
    showProductList();
  });

  $('#categoriesSeeMoreBtn').on('click', function () {
    showProductList();
  });

  $('#productSeeMoreBtn').on('click', function (e) {
    e.preventDefault();
    showProductList();
  });

  $('#bestSellingDetailsBtn').on('click', function () {
    showProductList();
  });

  $('#bestSellingFilterBtn').on('click', function () {
    cycleBestSellingFilter();
  });

  $('#productMediaLink').on('click', function () {
    showProductMedia();
  });


//---------------------------------------------------------------------------------------------------------
  // moshady21   addProductPage --Add

  $('#addProductPageLink').on('click', function () {
    showaddProductPage();
  });

  $('#addNewQuickLink').on('click', function (e) {
    e.preventDefault();
    showaddProductPage();
  });


   function showaddProductPage() {
    $embeddedPageFrame.attr('src', 'addProductPage.html');
    $dashboardView.hide();
    $orderManagementView.show();
    $pageTitle.text('Add Product');
    setActiveNavLink('#addProductPageLink');
    closeMobileSidebar();
  }

  // update product page-------------------------------------------------------------


  $('#updateProductPageLink').on('click', function () {
    showupdateProductPage();
  });


   function showupdateProductPage() {
    $embeddedPageFrame.attr('src', 'updateProductPage.html');
    $dashboardView.hide();
    $orderManagementView.show();
    $pageTitle.text('Update Product');
    closeMobileSidebar();
  }





//---------------------------------------------------------------------------------------------------------


   

  /* ─────────────────────────────────────────
     THEME TOGGLE (light ↔ dark)
  ───────────────────────────────────────── */
  $('#themeToggle').on('click', function () {
    darkMode = !darkMode;
    $('body').toggleClass('dark', darkMode);
    $(this).find('i')
      .toggleClass('bi-sun',  !darkMode)
      .toggleClass('bi-moon', darkMode);

    // Update charts for dark mode
    updateChartColors();
    syncEmbeddedTheme();
  });

  /* ─────────────────────────────────────────
     WEEK TOGGLE BUTTONS
  ───────────────────────────────────────── */
  let weeklyChartOffset = 0;
  function renderWeeklyReportChart(animationMode = 'none') {
    const data = buildWeeklySalesData(weeklyChartOffset);
    const maxValue = Math.max(...data, 0);
    const chartMax = Math.max(100, Math.ceil(maxValue / 100) * 100);

    weeklyChart.data.datasets[0].data = data;
    weeklyChart.options.scales.y.max = chartMax;
    weeklyChart.update(animationMode);
  }

  $('.btn-week').on('click', function () {
    $('.btn-week').removeClass('active');
    $(this).addClass('active');

    const label = $(this).text().toLowerCase();
    weeklyChartOffset = label.includes('last') ? 1 : 0;
    renderWeeklyReportChart('active');
  });

  /* ─────────────────────────────────────────
     METRIC ITEMS: click to activate
  ───────────────────────────────────────── */
  $('.metric-item').on('click', function () {
    $('.metric-item').removeClass('active');
    $(this).addClass('active');
  });

  /* ─────────────────────────────────────────
     PRODUCT SEARCH FILTER
  ───────────────────────────────────────── */
  $('.product-search input').on('input', function () {
    const q = $(this).val().toLowerCase();
    $('.product-row').each(function () {
      const name = $(this).find('.product-name').text().toLowerCase();
      $(this).toggle(name.includes(q));
    });
  });

  /* ─────────────────────────────────────────
     ADD BUTTON – feedback animation
  ───────────────────────────────────────── */
  $(document).on('click', '.btn-add', function () {
    const $btn = $(this);
    const orig = $btn.html();
    $btn.html('<i class="bi bi-check-circle-fill me-1"></i>Added!');
    $btn.css('background', '#16a34a');
    setTimeout(() => {
      $btn.html(orig);
      $btn.css('background', '');
    }, 1500);
  });


  /* ═══════════════════════════════════════════
     CHART.JS – WEEKLY SALES LINE CHART
  ═══════════════════════════════════════════ */
  const weekDays   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const salesData  = buildWeeklySalesData(0);

  const weeklyCtx  = document.getElementById('weeklyChart').getContext('2d');

  // Gradient fill
  const gradient = weeklyCtx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0,   'rgba(34,197,94,0.28)');
  gradient.addColorStop(0.6, 'rgba(34,197,94,0.08)');
  gradient.addColorStop(1,   'rgba(34,197,94,0.00)');

  const weeklyChart = new Chart(weeklyCtx, {
    type: 'line',
    data: {
      labels: weekDays,
      datasets: [{
        label: 'Sales',
        data: salesData,
        fill: true,
        backgroundColor: gradient,
        borderColor: '#22c55e',
        borderWidth: 2.5,
        tension: 0.45,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: '#22c55e',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            title: (items) => items[0].label,
            label: (item)  => ` $${Number(item.raw || 0).toFixed(2)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#6b7280',
            font: { family: "'Plus Jakarta Sans'", size: 11 }
          }
        },
        y: {
          min: 0,
          max: 50000,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#6b7280',
            font: { family: "'Plus Jakarta Sans'", size: 11 },
            callback: (v) => (v >= 1000 ? (v / 1000) + 'k' : v)
          }
        }
      }
    }
  });

  /* ═══════════════════════════════════════════
     CHART.JS – USERS PER MINUTE BAR CHART
  ═══════════════════════════════════════════ */
  const barCtx = document.getElementById('usersBarChart').getContext('2d');

  // Generate random bar heights
  function randomBars(n) {
    return Array.from({ length: n }, () => Math.floor(Math.random() * 90 + 20));
  }

  const barLabels = Array.from({ length: 24 }, (_, i) => i + '');
  const barData   = randomBars(24);

  // Color bars: last few are darker green
  const barColors = barData.map((_, i) =>
    i >= 20 ? '#16a34a' : '#86efac'
  );

  const usersBarChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        label: 'Users',
        data: barData,
        backgroundColor: barColors,
        borderRadius: 3,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          cornerRadius: 6,
          padding: 8
        }
      },
      scales: {
        x: {
          display: false,
          grid: { display: false }
        },
        y: {
          display: false,
          grid: { display: false }
        }
      }
    }
  });

  /* ─────────────────────────────────────────
     Live-ish bar animation: update every 2s
  ───────────────────────────────────────── */
  setInterval(() => {
    usersBarChart.data.datasets[0].data = randomBars(24);
    usersBarChart.update('none');
  }, 2500);

  /* ─────────────────────────────────────────
     Helper: update chart colors on theme toggle
  ───────────────────────────────────────── */
  function updateChartColors() {
    const tickColor = darkMode ? '#94a3b8' : '#6b7280';
    const gridColor = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

    // Weekly chart
    weeklyChart.options.scales.x.ticks.color = tickColor;
    weeklyChart.options.scales.y.ticks.color = tickColor;
    weeklyChart.options.scales.x.grid.color  = gridColor;
    weeklyChart.options.scales.y.grid.color  = gridColor;

    // Re-draw gradient for dark
    const ctx2 = weeklyCtx;
    const grad2 = ctx2.createLinearGradient(0, 0, 0, 220);
    if (darkMode) {
      grad2.addColorStop(0,   'rgba(34,197,94,0.35)');
      grad2.addColorStop(0.6, 'rgba(34,197,94,0.10)');
      grad2.addColorStop(1,   'rgba(34,197,94,0.00)');
    } else {
      grad2.addColorStop(0,   'rgba(34,197,94,0.28)');
      grad2.addColorStop(0.6, 'rgba(34,197,94,0.08)');
      grad2.addColorStop(1,   'rgba(34,197,94,0.00)');
    }
    weeklyChart.data.datasets[0].backgroundColor = grad2;
    weeklyChart.update();
    usersBarChart.update();
  }

  /* ─────────────────────────────────────────
     NOTIFICATION BUTTON: subtle pulse demo
  ───────────────────────────────────────── */
  $('.notif-btn').on('click', function () {
    $(this).find('.badge-dot').fadeOut(200).fadeIn(200);
  });

  renderDashboardOrderStats();
  renderPendingCanceledStats();
  renderTransactionTable();
  renderBestSellingTable();
  renderDashboardCategories();
  renderDashboardQuickProducts();
  renderWeeklyReportChart();

});
