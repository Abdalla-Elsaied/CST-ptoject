/* ═══════════════════════════════════════════════
   DEALPORT – SELLER DASHBOARD  |  script.js
═══════════════════════════════════════════════ */

import { loadProductsFromFolder } from '../Core/FileStorage.js';

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
  let pendingCanceledDrilldownStatus = 'Pending';
  let reportChartSource = 'sales';
  let darkMode = $('body').hasClass('dark');
  let dashboardProductsCache = null;
  let dashboardProductsLoaded = false;
  let usersBarChart = null;
  const REPORT_WEEK_START_DAY = 4; // 0=Sun ... 4=Thu

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
      if (!Array.isArray(parsed)) return [];
      const normalized = normalizeDashboardOrders(parsed);
      localStorage.setItem('ls_orders', JSON.stringify(normalized));
      return normalized;
    } catch (_err) {
      return [];
    }
  }

  function getOrderItemsTotal(order) {
    const items = Array.isArray(order?.products) && order.products.length
      ? order.products
      : (Array.isArray(order?.items) && order.items.length ? order.items : []);

    if (!items.length) return 0;

    const total = items.reduce((sum, item) => {
      const qtyRaw = Number(item?.qty ?? item?.quantity ?? 1);
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
      const unitRaw = Number(item?.unitPrice ?? item?.price ?? 0);
      const unit = Number.isFinite(unitRaw) && unitRaw >= 0 ? unitRaw : 0;
      return sum + (qty * unit);
    }, 0);

    return Number.isFinite(total) && total > 0 ? total : 0;
  }

  function normalizeDashboardOrder(order, idx) {
    const createdAtRaw = order?.createdAt ?? order?.date ?? Date.now();
    const createdAtDate = new Date(createdAtRaw);
    const createdAt = Number.isNaN(createdAtDate.getTime())
      ? new Date().toISOString()
      : createdAtDate.toISOString();

    const paymentRaw = String(order?.payment ?? '').toLowerCase();
    const payment = paymentRaw === 'paid' ? 'Paid' : 'Unpaid';

    const statusRaw = String(order?.status ?? '').toLowerCase();
    let status = 'Pending';
    if (statusRaw === 'delivered') status = 'Delivered';
    else if (statusRaw === 'shipped') status = 'Shipped';
    else if (statusRaw === 'cancelled' || statusRaw === 'canceled') status = 'Cancelled';

    const id = String(order?.id ?? order?.orderId ?? `ORD-${idx + 1}`);
    const safePrice = Number(getSafeOrderAmount(order).toFixed(2));

    return {
      ...order,
      id,
      payment,
      status,
      createdAt,
      price: safePrice
    };
  }

  function normalizeDashboardOrders(rawOrders) {
    return rawOrders.map((order, idx) => normalizeDashboardOrder(order, idx));
  }

  function getSafeOrderAmount(order) {
    const rawAmount = Number(order?.price ?? order?.total ?? order?.totalPrice);
    const itemsTotal = getOrderItemsTotal(order);

    if (itemsTotal > 0) {
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) return itemsTotal;

      // Some data may store totals in cents.
      const centsAsMajor = rawAmount / 100;
      const centsLooksValid = Math.abs(centsAsMajor - itemsTotal) <= Math.max(1, itemsTotal * 0.05);
      if (rawAmount >= itemsTotal * 50 && centsLooksValid) return centsAsMajor;

      // Prevent extreme outliers when line-items exist.
      if (rawAmount > itemsTotal * 10) return itemsTotal;
      return rawAmount;
    }

    if (!Number.isFinite(rawAmount) || rawAmount < 0) return 0;
    if (rawAmount > 100_000) return rawAmount / 100;
    return rawAmount;
  }

  function startOfWeek(dateValue) {
    const d = new Date(dateValue || Date.now());
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun ... 6=Sat
    const offset = (day - REPORT_WEEK_START_DAY + 7) % 7;
    d.setDate(d.getDate() - offset);
    return d;
  }

  function mapDayToReportIndex(day) {
    return (day - REPORT_WEEK_START_DAY + 7) % 7;
  }

  function buildReportWeekLabels() {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, idx) => dayNames[(REPORT_WEEK_START_DAY + idx) % 7]);
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

      const payment = String(order?.payment ?? '').toLowerCase();
      const status = String(order?.status ?? '').toLowerCase();
      if (payment !== 'paid' || status !== 'delivered') return;

      const amount = getSafeOrderAmount(order);
      if (!Number.isFinite(amount) || amount <= 0) return;

      const dayIndex = mapDayToReportIndex(dt.getDay());
      totals[dayIndex] += amount;
    });

    // For the current week, don't force future days to zero.
    // Using null avoids the sharp drop line after "today".
    if (weekOffset === 0) {
      const today = mapDayToReportIndex(new Date().getDay());
      return totals.map((v, idx) => (idx > today ? null : Number(v.toFixed(2))));
    }

    return totals.map((v) => Number(v.toFixed(2)));
  }

  function buildWeeklyCanceledRevenueData(weekOffset = 0) {
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

      const status = String(order?.status ?? '').toLowerCase();
      if (status !== 'cancelled' && status !== 'canceled') return;

      const amount = getSafeOrderAmount(order);
      if (!Number.isFinite(amount) || amount <= 0) return;

      const dayIndex = mapDayToReportIndex(dt.getDay());
      totals[dayIndex] += amount;
    });

    if (weekOffset === 0) {
      const today = mapDayToReportIndex(new Date().getDay());
      return totals.map((v, idx) => (idx > today ? null : Number(v.toFixed(2))));
    }

    return totals.map((v) => Number(v.toFixed(2)));
  }

  function buildWeeklyProductsData(weekOffset = 0) {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() - (weekOffset * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const totals = [0, 0, 0, 0, 0, 0, 0];
    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));

    products.forEach((product) => {
      const dt = new Date(product?.createdAt ?? 0);
      if (Number.isNaN(dt.getTime())) return;
      if (dt < start || dt >= end) return;

      const dayIndex = mapDayToReportIndex(dt.getDay());
      totals[dayIndex] += 1;
    });

    if (weekOffset === 0) {
      const today = mapDayToReportIndex(new Date().getDay());
      return totals.map((v, idx) => (idx > today ? null : v));
    }

    return totals;
  }

  function buildWeeklyStockProductsData(weekOffset = 0) {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() - (weekOffset * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const totals = [0, 0, 0, 0, 0, 0, 0];
    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));

    products.forEach((product) => {
      const dt = new Date(product?.createdAt ?? 0);
      if (Number.isNaN(dt.getTime())) return;
      if (dt < start || dt >= end) return;

      const stock = Number(product?.stock);
      if (!Number.isFinite(stock) || stock <= 0) return;

      const dayIndex = mapDayToReportIndex(dt.getDay());
      totals[dayIndex] += 1;
    });

    if (weekOffset === 0) {
      const today = mapDayToReportIndex(new Date().getDay());
      return totals.map((v, idx) => (idx > today ? null : v));
    }

    return totals;
  }

  function buildWeeklyOutOfStockProductsData(weekOffset = 0) {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() - (weekOffset * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const totals = [0, 0, 0, 0, 0, 0, 0];
    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));

    products.forEach((product) => {
      const dt = new Date(product?.createdAt ?? 0);
      if (Number.isNaN(dt.getTime())) return;
      if (dt < start || dt >= end) return;

      const stock = Number(product?.stock);
      if (!Number.isFinite(stock) || stock > 0) return;

      const dayIndex = mapDayToReportIndex(dt.getDay());
      totals[dayIndex] += 1;
    });

    if (weekOffset === 0) {
      const today = mapDayToReportIndex(new Date().getDay());
      return totals.map((v, idx) => (idx > today ? null : v));
    }

    return totals;
  }

  function getReportSeriesData(weekOffset = 0) {
    if (reportChartSource === 'stock') return buildWeeklyStockProductsData(weekOffset);
    if (reportChartSource === 'out-of-stock') return buildWeeklyOutOfStockProductsData(weekOffset);
    if (reportChartSource === 'products') return buildWeeklyProductsData(weekOffset);
    if (reportChartSource === 'canceled-revenue') return buildWeeklyCanceledRevenueData(weekOffset);
    return buildWeeklySalesData(weekOffset);
  }

  function loadDashboardProducts() {
    if (Array.isArray(dashboardProductsCache)) return dashboardProductsCache;
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

  async function loadDashboardProductsRemote() {
    try {
      const products = await loadProductsFromFolder();
      if (!Array.isArray(products)) return null;
      dashboardProductsCache = products;
      localStorage.setItem('sellerProducts', JSON.stringify(products));
      return products;
    } catch (err) {
      console.warn('Dashboard: failed to load remote products', err);
      return null;
    }
  }

  async function syncDashboardProducts() {
    if (dashboardProductsLoaded) return;
    dashboardProductsLoaded = true;
    await loadDashboardProductsRemote();
  }

  async function refreshDashboardProductsUI() {
    await syncDashboardProducts();
    renderDashboardTotalProductsMetric();
    renderDashboardStockProductsMetric();
    renderDashboardOutOfStockMetric();
    renderBestSellingTable();
    renderTopProductsList();
    renderDashboardCategories();

    if (reportChartSource === 'products' || reportChartSource === 'stock' || reportChartSource === 'out-of-stock') {
      renderWeeklyReportChart('active');
    }
  }

  function formatCompactNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs < 1000) return String(Math.floor(n));
    if (abs < 1_000_000) {
      const compactK = (n / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '');
      return `${compactK}k`;
    }
    const compactM = (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '');
    return `${compactM}m`;
  }

  function formatCompactCurrency(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$0';
    return `$${formatCompactNumber(n)}`;
  }

  function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$0.00';
    return `$${n.toFixed(2)}`;
  }

  function renderDashboardWeeklySalesMetric() {
    const metricEl = document.getElementById('dashboardWeeklySalesMetricValue');
    if (!metricEl) return;

    const weeklyData = buildWeeklySalesData(0);
    const weeklyTotal = weeklyData.reduce((sum, value) => {
      const amount = Number(value);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);

    metricEl.textContent = formatCompactCurrency(weeklyTotal);
  }

  function renderDashboardCanceledRevenueMetric() {
    const metricEl = document.getElementById('dashboardCanceledRevenueMetricValue');
    if (!metricEl) return;

    const orders = loadDashboardOrders();
    const canceledTotal = orders.reduce((sum, order) => {
      const status = String(order?.status ?? '').toLowerCase();
      if (status !== 'cancelled' && status !== 'canceled') return sum;
      const amount = getSafeOrderAmount(order);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);

    metricEl.textContent = formatCompactCurrency(canceledTotal);
  }
  function renderDashboardTotalProductsMetric() {
    const metricEl = document.getElementById('dashboardTotalProductsMetricValue');
    if (!metricEl) return;

    const products = loadDashboardProducts();
    metricEl.textContent = formatCompactNumber(products.length);
  }

  function renderDashboardStockProductsMetric() {
    const metricEl = document.getElementById('dashboardStockProductsMetricValue');
    if (!metricEl) return;

    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));
    const inStockCount = products.filter((p) => Number(p.stock) > 0).length;
    metricEl.textContent = formatCompactNumber(inStockCount);
  }

  function renderDashboardOutOfStockMetric() {
    const metricEl = document.getElementById('dashboardOutOfStockMetricValue');
    if (!metricEl) return;

    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));
    const outOfStockCount = products.filter((p) => {
      const stock = Number(p.stock);
      return Number.isFinite(stock) && stock <= 0;
    }).length;

    metricEl.textContent = formatCompactNumber(outOfStockCount);
  }

  function getRecentOrders(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return loadDashboardOrders().filter((order) => {
      const dt = new Date(order?.createdAt || order?.date || 0);
      if (Number.isNaN(dt.getTime())) return false;
      return dt >= cutoff;
    });
  }

  function renderOrdersStatusPanel() {
    if (!usersBarChart) return;
    const totalEl = document.getElementById('orders30DaysValue');
    const recentOrders = getRecentOrders(30);
    if (totalEl) totalEl.textContent = formatCompactNumber(recentOrders.length);

    const counts = {
      Delivered: 0,
      Shipped: 0,
      Pending: 0,
      Cancelled: 0
    };

    recentOrders.forEach((order) => {
      const status = String(order?.status ?? '').trim();
      if (status === 'Delivered') counts.Delivered += 1;
      else if (status === 'Shipped') counts.Shipped += 1;
      else if (status === 'Cancelled') counts.Cancelled += 1;
      else counts.Pending += 1;
    });

    const data = [
      counts.Delivered,
      counts.Shipped,
      counts.Pending,
      counts.Cancelled
    ];

    usersBarChart.data.labels = ['Delivered', 'Shipped', 'Pending', 'Cancelled'];
    usersBarChart.data.datasets[0].data = data;
    usersBarChart.data.datasets[0].backgroundColor = ['#16a34a', '#22c55e', '#f59e0b', '#ef4444'];
    usersBarChart.update('none');
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
      if (!key || key === '-' || key.toLowerCase() === 'n/a' || key.toLowerCase() === 'none') {
        key = 'Other';
      }
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
      <div class="category-row" data-category="${encodeURIComponent(category)}">
        <div class="cat-icon"><i class="bi ${categoryIconClass(category)}"></i></div>
        <span class="cat-name">${category} (${count})</span>
        <i class="bi bi-chevron-right ms-auto text-muted"></i>
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

  function renderTopProductsList() {
    const listEl = document.getElementById('dashboardTopProductsList');
    if (!listEl) return;

    const rawOrders = loadDashboardOrders();
    const products = loadDashboardProducts().map((p, idx) => normalizeDashboardProduct(p, idx));
    const productById = new Map(products.map((p) => [String(p.id), p]));
    const productByName = new Map(products.map((p) => [p.name.toLowerCase(), p]));

    const sold = new Map();

    rawOrders.forEach((order) => {
      const status = String(order?.status ?? '').toLowerCase();
      if (status === 'cancelled' || status === 'canceled') return;

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
            totalQty: 0
          });
        }

        sold.get(key).totalQty += qty;
      });
    });

    let top = Array.from(sold.values())
      .sort((a, b) => {
        if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
        return b.price - a.price;
      });

    if (!top.length && products.length) {
      top = products
        .map((p) => ({
          id: p.id,
          name: p.name,
          image: p.image,
          price: Number.isFinite(p.price) ? p.price : 0,
          totalQty: 0
        }))
        .sort((a, b) => b.price - a.price);
    }

    top = top.slice(0, 4);

    if (!top.length) {
      listEl.innerHTML = `
        <div class="product-row">
          <div class="product-meta">
            <span class="product-name">No product data yet.</span>
            <span class="product-code">Item: -</span>
          </div>
          <span class="product-price">$0.00</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = top.map((item) => `
      <div class="product-row">
        <img src="${item.image}" alt="${item.name}" class="product-thumb" />
        <div class="product-meta">
          <span class="product-name">${item.name}</span>
          <span class="product-code">Item: #${item.id}</span>
        </div>
        <span class="product-price">${formatPrice(item.price)}</span>
      </div>
    `).join('');
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
    const salesGrowthBadgeEl = document.getElementById('totalSalesGrowthBadge');
    const salesGrowthIconEl = document.getElementById('totalSalesGrowthIcon');
    const salesGrowthValueEl = document.getElementById('totalSalesGrowthValue');
    const salesPrevValueEl = document.getElementById('totalSalesPrevValue');
    const totalOrdersEl = document.getElementById('totalOrdersStatValue');
    const totalOrdersGrowthBadgeEl = document.getElementById('totalOrdersGrowthBadge');
    const totalOrdersGrowthIconEl = document.getElementById('totalOrdersGrowthIcon');
    const totalOrdersGrowthValueEl = document.getElementById('totalOrdersGrowthValue');
    const totalOrdersPrevValueEl = document.getElementById('totalOrdersPrevValue');
    const orders = loadDashboardOrders();

    if (totalOrdersEl) {
      const now = new Date();
      const currentStart = new Date(now);
      currentStart.setHours(0, 0, 0, 0);
      currentStart.setDate(currentStart.getDate() - 6);

      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      const previousEnd = new Date(currentStart);

      let currentOrders = 0;
      let previousOrders = 0;

      orders.forEach((order) => {
        const orderDate = new Date(order?.createdAt ?? order?.date ?? 0);
        if (Number.isNaN(orderDate.getTime())) return;

        if (orderDate >= currentStart && orderDate <= now) {
          currentOrders += 1;
          return;
        }

        if (orderDate >= previousStart && orderDate < previousEnd) {
          previousOrders += 1;
        }
      });

      totalOrdersEl.textContent = String(currentOrders);

      if (totalOrdersPrevValueEl) {
        totalOrdersPrevValueEl.textContent = `(${previousOrders})`;
      }

      if (totalOrdersGrowthBadgeEl && totalOrdersGrowthIconEl && totalOrdersGrowthValueEl) {
        const growthPct = previousOrders > 0
          ? ((currentOrders - previousOrders) / previousOrders) * 100
          : (currentOrders > 0 ? 100 : 0);
        const isUp = growthPct >= 0;
        const absPct = Math.abs(growthPct).toFixed(1);

        totalOrdersGrowthBadgeEl.classList.toggle('up', isUp);
        totalOrdersGrowthBadgeEl.classList.toggle('down', !isUp);
        totalOrdersGrowthIconEl.classList.toggle('bi-arrow-up', isUp);
        totalOrdersGrowthIconEl.classList.toggle('bi-arrow-down', !isUp);
        totalOrdersGrowthValueEl.textContent = `${absPct}%`;
      }
    }

    if (totalSalesEl) {
      const now = new Date();
      const currentStart = new Date(now);
      currentStart.setHours(0, 0, 0, 0);
      currentStart.setDate(currentStart.getDate() - 6);

      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      const previousEnd = new Date(currentStart);

      let currentSales = 0;
      let previousSales = 0;

      orders.forEach((order) => {
        const payment = String(order?.payment ?? '').toLowerCase();
        const status = String(order?.status ?? '').toLowerCase();
        const delivered = status === 'delivered';
        const paid = payment === 'paid';
        if (!delivered || !paid) return;

        const amount = getSafeOrderAmount(order);
        if (!Number.isFinite(amount) || amount <= 0) return;

        const orderDate = new Date(order?.createdAt ?? order?.date ?? 0);
        if (Number.isNaN(orderDate.getTime())) return;

        if (orderDate >= currentStart && orderDate <= now) {
          currentSales += amount;
          return;
        }

        if (orderDate >= previousStart && orderDate < previousEnd) {
          previousSales += amount;
        }
      });

      totalSalesEl.textContent = `$${currentSales.toFixed(2)}`;

      if (salesPrevValueEl) {
        salesPrevValueEl.textContent = `($${previousSales.toFixed(2)})`;
      }

      if (salesGrowthBadgeEl && salesGrowthIconEl && salesGrowthValueEl) {
        const growthPct = previousSales > 0
          ? ((currentSales - previousSales) / previousSales) * 100
          : (currentSales > 0 ? 100 : 0);
        const isUp = growthPct >= 0;
        const absPct = Math.abs(growthPct).toFixed(1);

        salesGrowthBadgeEl.classList.toggle('up', isUp);
        salesGrowthBadgeEl.classList.toggle('down', !isUp);
        salesGrowthIconEl.classList.toggle('bi-arrow-up', isUp);
        salesGrowthIconEl.classList.toggle('bi-arrow-down', !isUp);
        salesGrowthValueEl.textContent = `${absPct}%`;
      }
    }
  }

  function renderPendingCanceledStats() {
    const pendingEl = document.getElementById('pendingOrdersStatValue');
    const canceledEl = document.getElementById('canceledOrdersStatValue');
    const pendingSubEl = document.getElementById('pendingOrdersStatSub');
    const canceledGrowthBadgeEl = document.getElementById('canceledOrdersGrowthBadge');
    const canceledGrowthIconEl = document.getElementById('canceledOrdersGrowthIcon');
    const canceledGrowthValueEl = document.getElementById('canceledOrdersGrowthValue');
    if (!pendingEl || !canceledEl) return;

    const orders = loadDashboardOrders();
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setHours(0, 0, 0, 0);
    currentStart.setDate(currentStart.getDate() - 6);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    const previousEnd = new Date(currentStart);

    const pendingCount = orders.filter((o) => {
      const orderDate = new Date(o?.createdAt ?? o?.date ?? 0);
      if (Number.isNaN(orderDate.getTime())) return false;
      return String(o?.status ?? '').toLowerCase() === 'pending' && orderDate >= currentStart && orderDate <= now;
    }).length;

    const canceledCount = orders.filter((o) => {
      const orderDate = new Date(o?.createdAt ?? o?.date ?? 0);
      if (Number.isNaN(orderDate.getTime())) return false;
      const status = String(o?.status ?? '').toLowerCase();
      return (status === 'cancelled' || status === 'canceled') && orderDate >= currentStart && orderDate <= now;
    }).length;

    const previousCanceledCount = orders.filter((o) => {
      const orderDate = new Date(o?.createdAt ?? o?.date ?? 0);
      if (Number.isNaN(orderDate.getTime())) return false;
      const status = String(o?.status ?? '').toLowerCase();
      return (status === 'cancelled' || status === 'canceled') && orderDate >= previousStart && orderDate < previousEnd;
    }).length;

    pendingEl.textContent = String(pendingCount);
    canceledEl.textContent = String(canceledCount);
    if (pendingSubEl) pendingSubEl.textContent = `orders ${pendingCount}`;

    if (canceledGrowthBadgeEl && canceledGrowthIconEl && canceledGrowthValueEl) {
      const growthPct = previousCanceledCount > 0
        ? ((canceledCount - previousCanceledCount) / previousCanceledCount) * 100
        : (canceledCount > 0 ? 100 : 0);
      const isUp = growthPct >= 0;
      const absPct = Math.abs(growthPct).toFixed(1);

      canceledGrowthBadgeEl.classList.toggle('up', isUp);
      canceledGrowthBadgeEl.classList.toggle('down', !isUp);
      canceledGrowthIconEl.classList.toggle('bi-arrow-up', isUp);
      canceledGrowthIconEl.classList.toggle('bi-arrow-down', !isUp);
      canceledGrowthValueEl.textContent = `${absPct}%`;
    }
  }

  function setPendingCanceledDrilldown(status) {
    const normalized = status === 'Cancelled' ? 'Cancelled' : 'Pending';
    pendingCanceledDrilldownStatus = normalized;

    const pendingCol = document.getElementById('pendingOrdersCardLink');
    const canceledCol = document.getElementById('canceledOrdersCardLink');
    if (pendingCol) pendingCol.classList.toggle('active', normalized === 'Pending');
    if (canceledCol) canceledCol.classList.toggle('active', normalized === 'Cancelled');
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
    renderDashboardWeeklySalesMetric();
    renderDashboardCanceledRevenueMetric();
    renderDashboardTotalProductsMetric();
    renderDashboardStockProductsMetric();
    renderDashboardOutOfStockMetric();
    renderOrdersStatusPanel();
    setPendingCanceledDrilldown(pendingCanceledDrilldownStatus);
    renderTransactionTable();
    renderBestSellingTable();
    renderTopProductsList();
    renderDashboardCategories();
    refreshDashboardProductsUI();
  }

  function showOrderManagement(status, payment, recentDays) {
    const statusValue = String(status ?? '').trim();
    const paymentValue = String(payment ?? '').trim();
    const recentDaysValue = Number(recentDays);
    const params = new URLSearchParams();
    if (statusValue) params.set('status', statusValue);
    if (paymentValue) params.set('payment', paymentValue);
    if (Number.isFinite(recentDaysValue) && recentDaysValue > 0) {
      params.set('recentDays', String(Math.floor(recentDaysValue)));
    }
    const query = params.toString();

    $embeddedPageFrame.attr('src', query ? `OrderManagement.html?${query}` : 'OrderManagement.html');
    $dashboardView.hide();
    $orderManagementView.show();
    $pageTitle.text('Order Management');
    setActiveNavLink('#orderManagementLink');
    closeMobileSidebar();
  }

  function showProductList(category) {
    const categoryValue = String(category ?? '').trim();
    const url = categoryValue
      ? `ProductList.html?category=${encodeURIComponent(categoryValue)}`
      : 'ProductList.html';
    $embeddedPageFrame.attr('src', url);
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

  $('#totalSalesDetailsBtn').on('click', function () {
    showOrderManagement('Delivered', 'Paid');
  });

  $('#totalOrdersDetailsBtn').on('click', function () {
    showOrderManagement('', '', 7);
  });

  $('#pendingCanceledDetailsBtn').on('click', function () {
    showOrderManagement(pendingCanceledDrilldownStatus, '', 7);
  });

  $('#pendingOrdersCardLink').on('click', function () {
    setPendingCanceledDrilldown('Pending');
    showOrderManagement('Pending', '', 7);
  });

  $('#canceledOrdersCardLink').on('click', function () {
    setPendingCanceledDrilldown('Cancelled');
    showOrderManagement('Cancelled', '', 7);
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

  $(document).on('click', '#dashboardCategoryList .category-row[data-category]', function () {
    const encodedCategory = String($(this).attr('data-category') || '').trim();
    if (!encodedCategory) return;

    let category = encodedCategory;
    try {
      category = decodeURIComponent(encodedCategory);
    } catch (_err) {
      // use raw value if decode fails
    }

    if (!category) return;
    showProductList(category);
  });

  $('#bestSellingDetailsBtn').on('click', function () {
    showProductList();
  });

  $('#bestSellingFilterBtn').on('click', function () {
    cycleBestSellingFilter();
  });

  $(document).on('click', '#dashboardTopProductsList .product-row', function () {
    showProductList();
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
    const data = getReportSeriesData(weeklyChartOffset);
    const maxValue = Math.max(...data.map((v) => (Number.isFinite(v) ? v : 0)), 0);
    const chartMax = reportChartSource === 'products' || reportChartSource === 'stock' || reportChartSource === 'out-of-stock'
      ? Math.max(5, Math.ceil(maxValue / 5) * 5)
      : Math.max(100, Math.ceil(maxValue / 100) * 100);

    weeklyChart.data.datasets[0].data = data;
    weeklyChart.data.datasets[0].label = reportChartSource === 'products'
      ? 'Products'
      : (reportChartSource === 'stock'
        ? 'Stock Products'
        : (reportChartSource === 'out-of-stock'
          ? 'Out of Stock'
          : (reportChartSource === 'canceled-revenue' ? 'Canceled Revenue' : 'Sales')));
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
    reportChartSource = String($(this).data('chart-source') || 'sales').toLowerCase();
    renderWeeklyReportChart('active');
  });

  /* ═══════════════════════════════════════════
     CHART.JS – WEEKLY SALES LINE CHART
  ═══════════════════════════════════════════ */
  const weekDays   = buildReportWeekLabels();
  const salesData  = [];

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
            label: (item)  => {
              const value = Number(item.raw || 0);
              if (reportChartSource === 'products') return ` ${Math.round(value)} products`;
              if (reportChartSource === 'stock') return ` ${Math.round(value)} in stock`;
              if (reportChartSource === 'out-of-stock') return ` ${Math.round(value)} out of stock`;
              return ` $${value.toFixed(2)}`;
            }
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
            callback: (v) => {
              if (reportChartSource === 'products' || reportChartSource === 'stock' || reportChartSource === 'out-of-stock') return Math.round(v);
              return v >= 1000 ? (v / 1000) + 'k' : v;
            }
          }
        }
      }
    }
  });

  /* ═══════════════════════════════════════════
     CHART.JS – USERS PER MINUTE BAR CHART
  ═══════════════════════════════════════════ */
  const barCtx = document.getElementById('usersBarChart').getContext('2d');

  usersBarChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['Delivered', 'Shipped', 'Pending', 'Cancelled'],
      datasets: [{
        label: 'Orders',
        data: [0, 0, 0, 0],
        backgroundColor: ['#16a34a', '#22c55e', '#f59e0b', '#ef4444'],
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
          grid: { display: false },
          ticks: {
            color: '#6b7280',
            font: { family: "'Plus Jakarta Sans'", size: 11 }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#6b7280',
            precision: 0,
            font: { family: "'Plus Jakarta Sans'", size: 11 }
          }
        }
      }
    }
  });

  renderOrdersStatusPanel();

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

  // Ensure first paint uses computed data/max immediately.
  renderWeeklyReportChart('none');

  renderDashboardOrderStats();
  renderPendingCanceledStats();
  showDashboard();
  renderWeeklyReportChart();

});

