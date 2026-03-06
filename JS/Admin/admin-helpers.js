// ============================================================
// admin-helpers.js
// Shared functions used by ALL admin JS files.
// This file must be loaded FIRST before any other admin JS.
// ============================================================


// ─── LOCAL STORAGE KEYS ─────────────────────────────────────
// Centralized keys — change here once, affects everything
const LS_SELLERS = 'sellers';       // teammate's key (do NOT change)
const LS_PRODUCTS = 'ls_products';
const LS_ORDERS = 'ls_orders';
const LS_USERS = 'ls_users';
const LS_CURRENT = 'ls_currentUser';


// ─── LOCAL STORAGE READERS ──────────────────────────────────

/** Get all sellers from localStorage */
const getSellers = () => JSON.parse(localStorage.getItem(LS_SELLERS) || '[]');

/** Get all products from localStorage */
const getProducts = () => JSON.parse(localStorage.getItem(LS_PRODUCTS) || '[]');

/** Get all orders from localStorage */
const getOrders = () => JSON.parse(localStorage.getItem(LS_ORDERS) || '[]');

/** Get all users (customers) from localStorage */
const getUsers = () => JSON.parse(localStorage.getItem(LS_USERS) || '[]');

/** Get the currently logged-in admin user */
const getCurrentUser = () => JSON.parse(localStorage.getItem(LS_CURRENT) || 'null');


// ─── LOCAL STORAGE WRITERS ──────────────────────────────────

/** Save sellers array to localStorage */
const saveSellers = (data) => localStorage.setItem(LS_SELLERS, JSON.stringify(data));

/** Save products array to localStorage */
const saveProducts = (data) => localStorage.setItem(LS_PRODUCTS, JSON.stringify(data));

/** Save orders array to localStorage */
const saveOrders = (data) => localStorage.setItem(LS_ORDERS, JSON.stringify(data));

/** Save users array to localStorage */
const saveUsers = (data) => localStorage.setItem(LS_USERS, JSON.stringify(data));


// ─── UI HELPERS ─────────────────────────────────────────────

/**
 * Returns a colored badge HTML string based on order status.
 * Used in orders table and dashboard recent orders.
 */
function statusBadge(status) {
    const map = {
        'Pending': { bg: '#f59e0b', color: '#fff' },
        'Processing': { bg: '#3b82f6', color: '#fff' },
        'Shipped': { bg: '#8b5cf6', color: '#fff' },
        'Delivered': { bg: '#22c55e', color: '#fff' },
        'Cancelled': { bg: '#ef4444', color: '#fff' },
    };
    const style = map[status] || { bg: '#6b7280', color: '#fff' };
    return `<span class="status-badge" style="background:${style.bg};color:${style.color}">${status}</span>`;
}

/**
 * Returns a colored badge for product stock level.
 * Green = in stock, Orange = low stock, Red = out of stock.
 */
function stockBadge(stock) {
    if (stock === 0) return `<span class="stock-badge stock-out">Out of Stock</span>`;
    if (stock <= 5) return `<span class="stock-badge stock-low">Low: ${stock}</span>`;
    return `<span class="stock-badge stock-ok">${stock} in stock</span>`;
}

/**
 * Returns a colored badge for active/inactive product status.
 */
function activeBadge(isActive) {
    return isActive
        ? `<span class="active-badge active-yes">Active</span>`
        : `<span class="active-badge active-no">Inactive</span>`;
}

/**
 * Formats a number as a price string — e.g. 49.9 → "$49.90"
 */
function formatPrice(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * Formats an ISO date string to a readable date — e.g. "2026-03-05"
 * Returns "N/A" if the date is missing (some seller objects have no createdAt).
 */
function formatDate(isoString) {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Shows a toast notification at the bottom-right of the screen.
 * @param {string} message - Text to display
 * @param {'success'|'error'|'info'} type - Controls the color
 */
function showToast(message, type = 'success') {
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#3b82f6'
    };

    // Remove any existing toast first
    const existing = document.getElementById('adminToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 22px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        transition: opacity 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Shows a reusable confirm modal instead of the browser's ugly window.confirm().
 * @param {string} message - Question shown to the user
 * @param {Function} onConfirm - Function called when user clicks Confirm
 */
function showConfirm(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;

    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmBtn = document.getElementById('confirmActionBtn');

    // Remove previous listener to prevent stacking
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
        modal.hide();
        onConfirm();
    });

    modal.show();
}

/**
 * Returns seller's storeName by their id.
 * Used to show seller name in products and orders tables.
 * Falls back to 'Unknown Seller' if not found.
 */
function getSellerName(sellerId) {
    const seller = getSellers().find(s => s.id == sellerId); // == because id is Number
    return seller ? seller.storeName : 'Unknown Seller';
}

/**
 * Returns customer's name by their id.
 * Used to show customer name in orders table.
 */
function getCustomerName(customerId) {
    const user = getUsers().find(u => u.id == customerId);
    return user ? (user.name || user.fullName || 'Unknown') : 'Unknown Customer';
}
