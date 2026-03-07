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

  function showDashboard() {
    $dashboardView.show();
    $orderManagementView.hide();
    $pageTitle.text('Dashboard');
    setActiveNavLink('#dashboardLink');
    closeMobileSidebar();
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

  $('#productListLink').on('click', function () {
    showProductList();
  });


//---------------------------------------------------------------------------------------------------------
  // moshady21   addProductPage --Add

  $('#addProductPageLink').on('click', function () {
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
  $('.btn-week').on('click', function () {
    $('.btn-week').removeClass('active');
    $(this).addClass('active');

    // Randomize chart data for demo
    const newData = weekDays.map(() => Math.floor(Math.random() * 45000 + 5000));
    weeklyChart.data.datasets[0].data = newData;
    weeklyChart.update('active');
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
  $('.btn-add').on('click', function () {
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
  const salesData  = [8000, 20000, 15000, 14000, 32000, 40000, 35000];

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
            label: (item)  => ` $${(item.raw / 1000).toFixed(1)}k`
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

});
