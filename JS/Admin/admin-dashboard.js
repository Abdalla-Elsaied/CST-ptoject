// ============================================================
// admin-dashboard.js
// Dashboard — KPI cards, Recent Sellers, Recent Orders.
//
// REQUIRES: initUsers() called first in admin-panel.js
//           otherwise getCustomerName/getSellerName return '—'
// ============================================================

import { KEY_APPROVAL, KEY_CATEGORIES }      from '../Core/Constants.js';
import { getLS }                              from '../Core/Storage.js';
import { updateSidebarBadges }                from './admin-profile.js';
import { saveMetricsSnapshot, getAllTrends }  from './admin-metrics.js';
import { fetchProducts }                      from './admin-data-products.js';
import { fetchOrders }                        from './admin-data-orders.js';
import {
    getSellers,
    getUsers,
    getOrders,
    getCustomerName,
    getSellerName,
    statusBadge,
    formatPrice,
    escapeHTML
} from './admin-helpers.js';


// ─── MAIN ENTRY POINT ────────────────────────────────────────

export async function renderDashboard() {
    updateSidebarBadges();
    renderActionAlerts();

    await saveMetricsSnapshot();

    const [products, orders] = await Promise.all([
        fetchProducts(),
        fetchOrders()
    ]);

    await renderKPICards(products, orders);
    renderRecentSellers();
    renderRecentOrders(orders);

    if (!window._dashboardOrdersListenerAdded) {
        window.addEventListener('storage', async (e) => {
            if (e.key === 'ls_orders') {
                const updated = await fetchOrders();
                renderRecentOrders(updated);
            }
        });
        window._dashboardOrdersListenerAdded = true;
    }
}


// ─── ACTION ALERTS ───────────────────────────────────────────

function renderActionAlerts() {
    const container = document.getElementById('actionAlerts');
    if (!container) return;

    const requests         = getLS(KEY_APPROVAL) || [];
    const pendingRequests  = requests.filter(r => r.status === 'pending').length;

    const categories        = getLS(KEY_CATEGORIES) || [];
    const pendingCategories = categories.filter(
        c => c.visibility === 'draft'
    ).length;

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
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="action-alerts">
            ${alerts.map(a => `
                <div class="alert-item">
                    <i class="bi ${a.icon}"></i>
                    <span class="alert-text">⚠️ ${a.text}</span>
                    <button class="alert-action" data-section="${a.section}">
                        ${a.action} →
                    </button>
                </div>
            `).join('')}
        </div>`;

    container.querySelectorAll('.alert-action[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            window.activateSection
                ? window.activateSection(btn.dataset.section)
                : document.querySelector(`[data-section="${btn.dataset.section}"]`)?.click();
        });
    });
}


// ─── KPI CARDS ───────────────────────────────────────────────

async function renderKPICards(products, orders) {
    const sellers       = getSellers();
    const users         = getUsers();
    const customerCount = users.filter(u => (u.role || '').toLowerCase() === 'customer').length;

    const totalRevenue = orders.reduce((sum, o) => {
        return sum + (Number(o.total) || Number(o.subtotal) || Number(o.totalPrice) || 0);
    }, 0);

    const trends = await getAllTrends();

    const cards = [
        { label: 'Total Sellers',   value: sellers.length,                              icon: 'bi-shop',      section: 'sellers',   trend: trends.sellers,   iconClass: 'sellers'   },
        { label: 'Total Customers', value: customerCount,                               icon: 'bi-people',    section: 'customers', trend: trends.customers, iconClass: 'customers' },
        { label: 'Total Products',  value: products.filter(p => p.isActive !== false).length, icon: 'bi-box-seam', section: 'products',  trend: trends.products,  iconClass: 'products'  },
        { label: 'Total Revenue',   value: formatPrice(totalRevenue),                   icon: 'bi-cash-stack', section: 'orders',   trend: trends.revenue,   iconClass: 'orders'    }
    ];

    const container = document.getElementById('kpiRow');
    if (!container) return;

    container.innerHTML = cards.map(card => `
        <div class="kpi-card" data-section="${card.section}">
            <div class="kpi-card-header">
                <div class="kpi-icon-wrapper ${card.iconClass}">
                    <i class="bi ${card.icon}"></i>
                </div>
                ${card.trend ? `
                <div class="kpi-trend ${card.trend.direction === 'up' ? 'positive' : card.trend.direction === 'down' ? 'negative' : 'neutral'}">
                    ${card.trend.icon} ${card.trend.percentage}%
                </div>` : ''}
            </div>
            <div class="kpi-content">
                <div class="kpi-label">${card.label}</div>
                <div class="kpi-value">${card.value}</div>
                ${card.trend ? `
                <div class="kpi-change ${card.trend.direction === 'up' ? 'positive' : card.trend.direction === 'down' ? 'negative' : 'neutral'}">
                    <span class="kpi-change-icon">${card.trend.icon}</span>
                    ${card.trend.text}
                </div>` : ''}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.kpi-card[data-section]').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            window.activateSection
                ? window.activateSection(card.dataset.section)
                : document.querySelector(`[data-section="${card.dataset.section}"]`)?.click();
        });
    });
}


// ─── RECENT SELLERS ──────────────────────────────────────────

function renderRecentSellers() {
    const tbody   = document.getElementById('recentSellersBody');
    if (!tbody) return;

    const sellers = getSellers().slice(-5).reverse();

    const header = document.querySelector('.data-card:has(#recentSellersBody) .data-card-header');
    if (header) {
        header.innerHTML = `Recent Sellers <span class="badge rounded-pill bg-light text-dark ms-2 border">${sellers.length}</span>`;
    }

    if (sellers.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5">
                <div class="empty-state">
                    <i class="bi bi-shop empty-icon"></i>
                    <p class="empty-title">No sellers registered yet</p>
                    <p class="empty-sub">Add your first seller to get started</p>
                    <button class="btn-primary-green mt-3" onclick="openAddSellerModal()">
                        <i class="bi bi-plus-lg"></i> Onboard Seller
                    </button>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = sellers.map(s => {
        const name    = s.fullName || s.name || '—';
        const initial = name.charAt(0).toUpperCase();
        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span class="table-avatar">${initial}</span>
                        <span>${escapeHTML(name)}</span>
                    </div>
                </td>
                <td>${escapeHTML(s.storeName || '—')}</td>
                <td>${escapeHTML(s.city || '—')}</td>
                <td><small class="text-muted">${escapeHTML(s.paymentMethod || '—')}</small></td>
                <td class="text-center">
                    <div class="d-flex gap-1 justify-content-center">
                        <button class="btn-action btn-info btn-sm" onclick="viewSellerDetails('${s.id}')" title="View">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-action btn-edit btn-sm" onclick="editSeller('${s.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

window.viewSellerDetails = function (sellerId) {
    document.querySelector('[data-section="sellers"]')?.click();
    setTimeout(() => {
        const row = document.querySelector(`[data-seller-id="${sellerId}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.backgroundColor = 'var(--green-light-bg)';
            setTimeout(() => { row.style.backgroundColor = ''; }, 2000);
        }
    }, 300);
};

window.editSeller = function (sellerId) {
    window.openEditSellerModal
        ? window.openEditSellerModal(sellerId)
        : document.querySelector('[data-section="sellers"]')?.click();
};


// ─── RECENT ORDERS ───────────────────────────────────────────

function renderRecentOrders(allOrders) {
    const orders = (allOrders || getOrders()).slice(-5).reverse();
    const tbody  = document.getElementById('recentOrdersBody');
    if (!tbody) return;

    const header = document.querySelector('.data-card:has(#recentOrdersBody) .data-card-header');
    if (header) {
        header.innerHTML = `Recent Orders <span class="badge rounded-pill bg-light text-dark ms-2 border">${orders.length}</span>`;
    }

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5">
                <div class="empty-state">
                    <i class="bi bi-receipt empty-icon"></i>
                    <p class="empty-title">No orders yet</p>
                    <p class="empty-sub">Orders will appear here once customers start purchasing</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => {

        // Short Order ID
        const fullId  = String(o.id || '');
        const shortId = fullId.length > 6 ? '#' + fullId.slice(-6) : '#' + fullId;

        // Customer — no avatar if name not resolved
        const customerName    = getCustomerName(o.customerId);
        const customerDisplay = customerName === '—'
            ? `<span class="text-muted">—</span>`
            : `<div class="d-flex align-items-center gap-2">
                   <span class="table-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0;">
                       ${customerName.charAt(0).toUpperCase()}
                   </span>
                   <span>${customerName}</span>
               </div>`;

        // Seller — resolve from items first
        let rawSellerId = null;
        if (o.items && o.items.length > 0) {
            const ids = [...new Set(o.items.map(i => i.sellerId).filter(Boolean))];
            rawSellerId = ids.length === 1 ? ids[0] : ids.length > 1 ? 'multiple' : null;
        } else if (o.sellerId) {
            rawSellerId = o.sellerId;
        }

        let sellerDisplay;
        if (rawSellerId === 'multiple') {
            sellerDisplay = `<span class="text-muted small">Multiple Sellers</span>`;
        } else {
            const sellerName = rawSellerId ? getSellerName(rawSellerId) : '—';
            sellerDisplay = sellerName === '—'
                ? `<span class="text-muted">—</span>`
                : `<div class="d-flex align-items-center gap-2">
                       <span class="table-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0;background:linear-gradient(135deg,#3b82f6,#2563eb);">
                           ${sellerName.charAt(0).toUpperCase()}
                       </span>
                       <span>${sellerName}</span>
                   </div>`;
        }

        // Total — try all field names then calculate from items
        let total = Number(o.subtotal) || Number(o.total) || Number(o.totalPrice) || 0;
        if (total === 0 && o.items && o.items.length > 0) {
            total = o.items.reduce((sum, item) => {
                return sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1));
            }, 0);
        }

        return `
            <tr data-id="${escapeHTML(fullId)}">
                <td><span class="order-id" title="${escapeHTML(fullId)}">${escapeHTML(shortId)}</span></td>
                <td>${customerDisplay}</td>
                <td>${sellerDisplay}</td>
                <td class="text-end fw-bold">${formatPrice(total)}</td>
                <td>${statusBadge(o.status)}</td>
            </tr>`;
    }).join('');
}
