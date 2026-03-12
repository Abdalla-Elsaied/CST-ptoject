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
import { updateSidebarBadges } from './admin-profile.js';


/**
 * Main function for the dashboard section.
 * Called every time the user clicks "Dashboard" in the sidebar.
 */
export function renderDashboard() {
    updateSidebarBadges(); // Update badges when dashboard loads
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

    const requests = getLS('ls_sellerRequests') || getLS('ls_approval') || [];
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    
    const categories = getLS('ls_categoryRequests') || getLS('ls_categories') || [];
    const pendingCategories = categories.filter(c => c.status === 'pending' || c.visibility === 'draft').length;

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
            if (window.activateSection) {
                window.activateSection(section);
            } else {
                const navLink = document.querySelector(`[data-section="${section}"]`);
                if (navLink) navLink.click();
            }
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

    // Calculate trends (mock data for demo - in real app, compare with previous period)
    const trends = calculateTrends(sellers.length, customerCount, products.length, totalRevenue);

    const cards = [
        {
            label: 'Total Sellers',
            value: sellers.length,
            icon: 'bi-shop',
            section: 'sellers',
            trend: trends.sellers,
            iconClass: 'sellers'
        },
        {
            label: 'Total Customers',
            value: customerCount,
            icon: 'bi-people',
            section: 'customers',
            trend: trends.customers,
            iconClass: 'customers'
        },
        {
            label: 'Total Products',
            value: products.filter(p => p.isActive !== false).length,
            icon: 'bi-box-seam',
            section: 'products',
            trend: trends.products,
            iconClass: 'products'
        },
        {
            label: 'Total Revenue',
            value: formatPrice(totalRevenue),
            icon: 'bi-cash-stack',
            section: 'orders',
            trend: trends.revenue,
            iconClass: 'orders'
        }
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
                    <div class="kpi-trend ${card.trend.direction === 'up' ? 'positive' : 'negative'}">
                        ${card.trend.icon} ${card.trend.percentage || Math.floor(Math.random() * 15) + 5}%
                    </div>
                ` : ''}
            </div>
            <div class="kpi-content">
                <div class="kpi-label">${card.label}</div>
                <div class="kpi-value">${card.value}</div>
                ${card.trend ? `
                    <div class="kpi-change ${card.trend.direction === 'up' ? 'positive' : 'negative'}">
                        <span class="kpi-change-icon">${card.trend.icon}</span>
                        ${card.trend.text}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    // Make KPI cards clickable - navigate to their section
    container.querySelectorAll('.kpi-card[data-section]').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            if (section) {
                // Add hover effect classes
                card.style.cursor = 'pointer';
                
                // Navigate to section
                if (window.activateSection) {
                    window.activateSection(section);
                } else {
                    const navLink = document.querySelector(`[data-section="${section}"]`);
                    if (navLink) navLink.click();
                }
            }
        });
        
        // Add hover effects
        card.style.cursor = 'pointer';
    });
}

/**
 * Calculates trend indicators for KPI cards.
 * In a real app, this would compare current vs previous period data.
 */
function calculateTrends(sellersCount, customersCount, productsCount, revenue) {
    // Mock trend data - in real app, get from analytics/historical data
    const trends = {
        sellers: sellersCount > 0 ? { 
            direction: 'up', 
            icon: '↗', 
            text: '+2 this week',
            percentage: Math.floor(Math.random() * 20) + 5
        } : null,
        customers: customersCount > 2 ? { 
            direction: 'up', 
            icon: '↗', 
            text: '+5 this week',
            percentage: Math.floor(Math.random() * 25) + 8
        } : customersCount > 0 ? { 
            direction: 'up', 
            icon: '↗', 
            text: '+1 this week',
            percentage: Math.floor(Math.random() * 15) + 3
        } : null,
        products: productsCount > 3 ? { 
            direction: 'up', 
            icon: '↗', 
            text: '+3 this week',
            percentage: Math.floor(Math.random() * 18) + 6
        } : productsCount > 0 ? { 
            direction: 'up', 
            icon: '↗', 
            text: '+1 this week',
            percentage: Math.floor(Math.random() * 12) + 2
        } : null,
        revenue: revenue > 100 ? { 
            direction: 'up', 
            icon: '↗', 
            text: '+12% this week',
            percentage: Math.floor(Math.random() * 30) + 10
        } : revenue > 0 ? { 
            direction: 'up', 
            icon: '↗', 
            text: 'First sales!',
            percentage: 100
        } : null
    };

    return trends;
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
                <td colspan="5" class="empty-state">
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
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn-action btn-info btn-sm" onclick="viewSellerDetails('${s.id}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn-action btn-edit btn-sm" onclick="editSeller('${s.id}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * View seller details - navigate to sellers section and highlight the seller
 */
window.viewSellerDetails = function(sellerId) {
    // Navigate to sellers section
    const sellersLink = document.querySelector('[data-section="sellers"]');
    if (sellersLink) {
        sellersLink.click();
        // Highlight the seller row after a short delay
        setTimeout(() => {
            const sellerRow = document.querySelector(`[data-seller-id="${sellerId}"]`);
            if (sellerRow) {
                sellerRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                sellerRow.style.backgroundColor = 'var(--green-light-bg)';
                setTimeout(() => {
                    sellerRow.style.backgroundColor = '';
                }, 2000);
            }
        }, 300);
    }
};

/**
 * Edit seller - open edit modal (assumes openEditSellerModal exists)
 */
window.editSeller = function(sellerId) {
    if (window.openEditSellerModal) {
        window.openEditSellerModal(sellerId);
    } else {
        // Fallback: navigate to sellers section
        const sellersLink = document.querySelector('[data-section="sellers"]');
        if (sellersLink) sellersLink.click();
    }
};


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
                    <button class="btn-outline-green" onclick="if(window.activateSection) window.activateSection('products'); else document.querySelector('[data-section=\\"products\\"]').click()">
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