import {
    getSellers,
    getProducts,
    getOrders,
    getUsers,
    getCustomerName,
    getSellerName,
    formatPrice,
    statusBadge,
    escapeHTML
} from '../Admin/admin-helpers.js';


/**
 * Main function for the dashboard section.
 * Called every time the user clicks "Dashboard" in the sidebar.
 */
export function renderDashboard() {
    renderKPICards();
    renderRecentSellers();
    renderRecentOrders();
}


// ─── KPI CARDS ───────────────────────────────────────────────

/**
 * Builds and injects the 4 KPI stat cards into #kpiRow.
 * Reads live data from localStorage on every call.
 */
function renderKPICards() {
    const sellers = getSellers();
    const products = getProducts();
    const orders = getOrders();
    const users = getUsers();

    // Count customers only (filter by role)
    const customerCount = users.filter(u => u.role === 'customer').length;

    // Total platform revenue = sum of all order subtotals
    const totalRevenue = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);

    const cards = [
        {
            label: 'Total Sellers',
            value: sellers.length,
            icon: '<i class="bi bi-shop"></i>',
            color: 'var(--green-primary)',
            border: 'var(--green-dark)'
        },
        {
            label: 'Total Customers',
            value: customerCount,
            icon: '<i class="bi bi-people"></i>',
            color: '#3b82f6',
            border: '#1d4ed8'
        },
        {
            label: 'Total Products',
            value: products.filter(p => p.isActive).length,
            icon: '<i class="bi bi-box-seam"></i>',
            color: '#8b5cf6',
            border: '#6d28d9'
        },
        {
            label: 'Total Revenue',
            value: formatPrice(totalRevenue),
            icon: '<i class="bi bi-cash-stack"></i>',
            color: '#f59e0b',
            border: '#b45309'
        }
    ];

    const container = document.getElementById('kpiRow');
    if (!container) return;

    container.innerHTML = cards.map(card => `
        <div class="col-sm-6 col-xl-3">
            <div class="kpi-card" style="border-top: 4px solid ${card.border}">
                <div class="kpi-icon">${card.icon}</div>
                <div class="kpi-label">${card.label}</div>
                <div class="kpi-value" style="color:${card.color}">${card.value}</div>
            </div>
        </div>
    `).join('');
}


// ─── RECENT SELLERS TABLE ────────────────────────────────────

/**
 * Shows the last 5 added sellers in the recent sellers table.
 * Since sellers have no createdAt, we use the last 5 by array position.
 */
function renderRecentSellers() {
    const sellers = getSellers().slice(-5).reverse(); // last 5, newest first
    const tbody = document.getElementById('recentSellersBody');

    if (!tbody) return;

    if (sellers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">No sellers registered yet.</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = sellers.map(s => `
        <tr>
            <td>${escapeHTML(s.fullName)}</td>
            <td>${escapeHTML(s.storeName)}</td>
            <td>${escapeHTML(s.city)}</td>
            <td>${escapeHTML(s.paymentMethod)}</td>
        </tr>
    `).join('');
}


// ─── RECENT ORDERS TABLE ─────────────────────────────────────

/**
 * Shows the last 5 orders placed on the platform.
 */
function renderRecentOrders() {
    const orders = getOrders().slice(-5).reverse(); // last 5, newest first
    const tbody = document.getElementById('recentOrdersBody');

    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">No orders placed yet.</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        // Handle multiple sellers in one order
        let sellerText = '—';
        if (o.items && o.items.length > 0) {
            const uniqueSellerIds = [...new Set(o.items.map(item => item.sellerId).filter(Boolean))];
            if (uniqueSellerIds.length === 0) {
                sellerText = '—';
            } else if (uniqueSellerIds.length > 1) {
                sellerText = 'Multiple Sellers';
            } else {
                sellerText = getSellerName(uniqueSellerIds[0]);
            }
        } else if (o.sellerId) {
            // Fallback to order-level sellerId if items not available
            sellerText = getSellerName(o.sellerId);
        }

        return `
        <tr>
            <td class="order-id">${o.id || 'N/A'}</td>
            <td>${getCustomerName(o.customerId)}</td>
            <td>${sellerText}</td>
            <td>${formatPrice(o.subtotal || o.totalPrice || o.total)}</td>
            <td>${statusBadge(o.status)}</td>
        </tr>
    `;
    }).join('');
}