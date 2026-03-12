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
} from './admin-helpers.js';

import { getLS } from '../Core/Storage.js';


/**
 * Main function for the dashboard section.
 * Called every time the user clicks "Dashboard" in the sidebar.
 */
export function renderDashboard() {
    renderActionAlerts();
    renderKPICards();
    renderRecentSellers();
    renderRecentOrders();
}

/**
 * Renders action alerts banner showing pending items that need attention.
 */
function renderActionAlerts() {
    const alertsContainer = document.getElementById('actionAlerts');
    if (!alertsContainer) return;

    const requests = getLS('ls_approval') || [];
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    
    const categories = getLS('ls_categories') || [];
    const pendingCategories = categories.filter(c => c.visibility === 'draft').length;

    const alerts = [];
    
    if (pendingRequests > 0) {
        alerts.push({
            icon: 'bi-person-check',
            text: `${pendingRequests} seller request${pendingRequests > 1 ? 's' : ''} pending review`,
            action: 'Review Now',
            section: 'requests'
        });
    }
    
    if (pendingCategories > 0) {
        alerts.push({
            icon: 'bi-tags',
            text: `${pendingCategories} category suggestion${pendingCategories > 1 ? 's' : ''} waiting`,
            action: 'Review Now',
            section: 'categories'
        });
    }

    if (alerts.length === 0) {
        alertsContainer.innerHTML = '';
        return;
    }

    alertsContainer.innerHTML = `
        <div class="action-alerts">
            ${alerts.map(alert => `
                <div class="alert-item">
                    <i class="bi ${alert.icon}"></i>
                    <span class="alert-text">⚠️ ${alert.text}</span>
                    <button class="alert-action" data-section="${alert.section}">
                        ${alert.action} →
                    </button>
                </div>
            `).join('')}
        </div>
    `;

    // Bind click events to alert action buttons
    alertsContainer.querySelectorAll('.alert-action[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            const navLink = document.querySelector(`[data-section="${section}"]`);
            if (navLink) navLink.click();
        });
    });
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

    // Count customers only (exclude admin and seller)
    const customerCount = users.filter(u => (u.role || '').toLowerCase() === 'customer').length;

    // Total platform revenue = sum of all order totals
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || Number(o.totalPrice) || 0), 0);

    const cards = [
        {
            label: 'Total Sellers',
            value: sellers.length,
            icon: '<i class="bi bi-shop"></i>',
            color: 'var(--green-primary)',
            border: 'var(--green-dark)',
            section: 'sellers'
        },
        {
            label: 'Total Customers',
            value: customerCount,
            icon: '<i class="bi bi-people"></i>',
            color: '#3b82f6',
            border: '#1d4ed8',
            section: 'customers'
        },
        {
            label: 'Total Products',
            value: products.filter(p => p.isActive !== false).length,
            icon: '<i class="bi bi-box-seam"></i>',
            color: '#8b5cf6',
            border: '#6d28d9',
            section: 'products'
        },
        {
            label: 'Total Revenue',
            value: formatPrice(totalRevenue),
            icon: '<i class="bi bi-cash-stack"></i>',
            color: '#f59e0b',
            border: '#b45309',
            section: 'orders'
        }
    ];

    const container = document.getElementById('kpiRow');
    if (!container) return;

    container.innerHTML = cards.map(card => `
        <div class="col-sm-6 col-xl-3">
            <div class="kpi-card" style="border-top: 4px solid ${card.border}" data-section="${card.section}">
                <div class="kpi-icon ${getIconClass(card.section)}">${card.icon}</div>
                <div class="kpi-label">${card.label}</div>
                <div class="kpi-value" style="color:${card.color}">${card.value}</div>
            </div>
        </div>
    `).join('');

    // Make KPI cards clickable - navigate to their section
    container.querySelectorAll('.kpi-card[data-section]').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            if (section) {
                // Trigger the sidebar navigation
                const navLink = document.querySelector(`[data-section="${section}"]`);
                if (navLink) navLink.click();
            }
        });
    });
}

/**
 * Returns the appropriate icon class based on the section.
 */
function getIconClass(section) {
    const iconClasses = {
        sellers: 'green',
        customers: 'blue', 
        products: 'purple',
        orders: 'yellow'
    };
    return iconClasses[section] || 'green';
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
                <td colspan="4" class="empty-state">
                    <i class="bi bi-shop empty-icon"></i>
                    <p>No sellers registered yet</p>
                    <p class="empty-sub">Add your first seller to get started</p>
                    <button class="btn-primary-green" onclick="openAddSellerModal()">
                        <i class="bi bi-plus-lg"></i> Onboard Seller
                    </button>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = sellers.map(s => `
        <tr>
            <td>${escapeHTML(s.fullName || s.name)}</td>
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
                <td colspan="5" class="empty-state">
                    <i class="bi bi-receipt empty-icon"></i>
                    <p>No orders placed yet</p>
                    <p class="empty-sub">Orders will appear here once customers start purchasing</p>
                    <button class="btn-outline-green" onclick="document.querySelector('[data-section=\\"products\\"]').click()">
                        <i class="bi bi-box-seam"></i> View Products
                    </button>
                </td>
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
            <td>${formatPrice(o.subtotal || o.total || o.totalPrice)}</td>
            <td>${statusBadge(o.status)}</td>
        </tr>
    `;
    }).join('');
}