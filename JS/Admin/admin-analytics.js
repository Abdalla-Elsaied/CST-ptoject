import {
    getSellers,
    getUsers,
    getOrders
} from './admin-helpers.js';


/**
 * Main entry point for the analytics section.
 * Called every time the user clicks "Analytics" in the sidebar.
 * Rebuilds all 4 charts from fresh localStorage data each time.
 */
export function renderAnalytics() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Set Chart.js global font and color defaults based on theme
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = isDark ? '#334155' : '#e2e8f0';

    renderUserDistributionChart(isDark);
    renderOrdersByStatusChart(isDark);
    renderTopSellersChart(isDark);
    renderDailyOrdersChart(isDark);
}


// ─── CHART HELPER ────────────────────────────────────────────

/**
 * Destroys an existing chart on a canvas before creating a new one.
 * MUST be called before every new Chart() to avoid "Canvas already in use" error.
 * @param {string} canvasId - the id of the <canvas> element
 */
function destroyChart(canvasId) {
    const existing = Chart.getChart(canvasId);
    if (existing) existing.destroy();
}


// ─── CHART 1: USER DISTRIBUTION ──────────────────────────────

/**
 * Doughnut chart showing how many sellers vs customers exist.
 */
function renderUserDistributionChart(isDark) {
    destroyChart('userDistributionChart');

    const sellersCount = getSellers().length;
    const customersCount = getUsers().filter(u => u.role === 'customer').length;

    new Chart(document.getElementById('userDistributionChart'), {
        type: 'doughnut',
        data: {
            labels: ['Sellers', 'Customers'],
            datasets: [{
                data: [sellersCount, customersCount],
                backgroundColor: [isDark ? '#22c55e' : '#10b981', isDark ? '#3b82f6' : '#2563eb'],
                borderWidth: 2,
                borderColor: isDark ? '#1e293b' : '#ffffff'
            }]
        },
        options: {
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        color: isDark ? '#f8fafc' : '#1f2937',
                        padding: 20,
                        usePointStyle: true
                    }
                },
                title: { 
                    display: true, 
                    text: 'User Distribution', 
                    color: isDark ? '#f8fafc' : '#1f2937',
                    font: { size: 16, weight: '700' },
                    padding: { bottom: 20 }
                }
            },
            cutout: '70%'
        }
    });
}


// ─── CHART 2: ORDERS BY STATUS ───────────────────────────────

/**
 * Bar chart showing how many orders are in each status.
 */
function renderOrdersByStatusChart(isDark) {
    destroyChart('ordersByStatusChart');

    const orders = getOrders();
    const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];

    // Count orders per status
    const counts = statuses.map(s => orders.filter(o => o.status === s).length);

    new Chart(document.getElementById('ordersByStatusChart'), {
        type: 'bar',
        data: {
            labels: statuses,
            datasets: [{
                label: 'Orders',
                data: counts,
                backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444', '#6b7280'],
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { 
                    display: true, 
                    text: 'Orders by Status', 
                    color: isDark ? '#f8fafc' : '#1f2937',
                    font: { size: 16, weight: '700' },
                    padding: { bottom: 20 }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { stepSize: 1, color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { display: false }
                }
            }
        }
    });
}


// ─── CHART 3: TOP 5 SELLERS BY REVENUE ───────────────────────

/**
 * Horizontal bar chart of top 5 sellers ranked by total revenue.
 * Revenue = sum of subtotals from orders belonging to each seller.
 */
function renderTopSellersChart(isDark) {
    destroyChart('topSellersChart');

    const orders = getOrders();
    const sellers = getSellers();

    // Group revenue by seller: from order items (multi-seller support) or order-level sellerId
    const revenueMap = {};
    orders.forEach(o => {
        if (o.items && o.items.length > 0) {
            o.items.forEach(item => {
                const sid = item.sellerId;
                if (!sid) return;
                const amt = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                revenueMap[sid] = (revenueMap[sid] || 0) + amt;
            });
        } else if (o.sellerId) {
            const amt = Number(o.subtotal) || Number(o.total) || Number(o.totalPrice) || 0;
            revenueMap[o.sellerId] = (revenueMap[o.sellerId] || 0) + amt;
        }
    });

    // Sort and take top 5
    const top5 = Object.entries(revenueMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Map seller IDs to store names
    const labels = top5.map(([id]) => {
        const seller = sellers.find(s => s.id == id);
        return seller ? seller.storeName : 'Unknown';
    });
    const data = top5.map(([, revenue]) => Number(revenue.toFixed(2)));

    // Empty state
    const chartCanvas = document.getElementById('topSellersChart');
    if (!chartCanvas) return;

    let emptyMsg = document.getElementById('topSellersEmptyMsg');
    if (data.length === 0) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('p');
            emptyMsg.id = 'topSellersEmptyMsg';
            emptyMsg.className = 'empty-state';
            emptyMsg.textContent = 'No order data yet.';
            chartCanvas.parentElement.appendChild(emptyMsg);
        }
        chartCanvas.style.display = 'none';
        emptyMsg.style.display = 'block';
        return;
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        chartCanvas.style.display = 'block';
    }

    new Chart(document.getElementById('topSellersChart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Revenue ($)',
                data,
                backgroundColor: '#16a34a',
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            indexAxis: 'y',   // horizontal bar
            plugins: {
                legend: { display: false },
                title: { 
                    display: true, 
                    text: 'Top 5 Sellers by Revenue', 
                    color: isDark ? '#f8fafc' : '#1f2937',
                    font: { size: 16, weight: '700' },
                    padding: { bottom: 20 }
                }
            },
            scales: {
                x: { 
                    beginAtZero: true,
                    ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { display: false }
                }
            }
        }
    });
}


// ─── CHART 4: DAILY ORDERS (LAST 14 DAYS) ───────────────────

/**
 * Line chart showing order count per day for the last 14 days.
 * Days with no orders show 0.
 */
function renderDailyOrdersChart(isDark) {
    destroyChart('dailyOrdersChart');

    const orders = getOrders();

    // Build array of last 14 days as "YYYY-MM-DD" strings
    const days = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }

    // Count how many orders fall on each day (support date, createdAt)
    const counts = days.map(day =>
        orders.filter(o => {
            const d = o.createdAt || o.date;
            return d && String(d).slice(0, 10) === day;
        }).length
    );

    // Short label format: "Mar 5"
    const labels = days.map(d => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    new Chart(document.getElementById('dailyOrdersChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Orders',
                data: counts,
                borderColor: '#22c55e',
                backgroundColor: '#ecfdf5',
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#16a34a',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { 
                    display: true, 
                    text: 'Orders — Last 14 Days', 
                    color: isDark ? '#f8fafc' : '#1f2937',
                    font: { size: 16, weight: '700' },
                    padding: { bottom: 20 }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { stepSize: 1, color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { display: false }
                }
            }
        }
    });
}
