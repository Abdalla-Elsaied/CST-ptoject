import {
    KEY_USERS,
    KEY_PRODUCTS,
    KEY_ORDERS,
    KEY_CURRENT_USER
} from '../Core/Constants.js';

import { getLS, setLS } from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';

// ─── DATA ACCESS ─────────────────────────────────────────────

export function getSellers() {
    const users = getLS(KEY_USERS) || [];
    return users.filter(u => u.role === ROLES.SELLER);
}

export function getProducts() {
    return getLS(KEY_PRODUCTS) || [];
}

export function getOrders() {
    return getLS(KEY_ORDERS) || [];
}

export function getUsers() {
    return getLS(KEY_USERS) || [];
}

export function getCurrentUser() {
    return getLS(KEY_CURRENT_USER) || null;
}

export function saveUsers(users) {
    setLS(KEY_USERS, users);
}

export function saveSellers(sellers) {
    const allUsers = getUsers().filter(u => u.role !== ROLES.SELLER);
    saveUsers([...allUsers, ...sellers]);
}

export function saveProducts(products) {
    setLS(KEY_PRODUCTS, products);
}

export function saveOrders(orders) {
    setLS(KEY_ORDERS, orders);
}


// ─── UI HELPERS ─────────────────────────────────────────────

/**
 * Returns a colored badge HTML string based on order status.
 */
export function statusBadge(status) {
    const map = {
        'Pending': { bg: '#f59e0b', color: '#fff' },
        'Processing': { bg: '#3b82f6', color: '#fff' },
        'Shipped': { bg: '#8b5cf6', color: '#fff' },
        'Delivered': { bg: '#22c55e', color: '#fff' },
        'Cancelled': { bg: '#ef4444', color: '#fff' },
        'Refunded': { bg: '#6b7280', color: '#fff' },
    };
    const style = map[status] || { bg: '#6b7280', color: '#fff' };
    return `<span class="status-badge" style="background:${style.bg};color:${style.color}">${status}</span>`;
}

/**
 * Returns a colored badge for product stock level.
 * Green = in stock, Orange = low stock, Red = out of stock.
 */
export function stockBadge(stock) {
    if (stock === 0) return `<span class="stock-badge stock-out">Out of Stock</span>`;
    if (stock <= 5) return `<span class="stock-badge stock-low">Low: ${stock}</span>`;
    return `<span class="stock-badge stock-ok">${stock} in stock</span>`;
}

/**
 * Returns a colored badge for active/inactive product status.
 */
export function activeBadge(isActive) {
    return isActive
        ? `<span class="active-badge active-yes">Active</span>`
        : `<span class="active-badge active-no">Inactive</span>`;
}

/**
 * Formats a number as a price string — e.g. 49.9 → "$49.90"
 */
export function formatPrice(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * Formats an ISO date string to a readable date — e.g. "2026-03-05"
 * Returns "N/A" if the date is missing (some seller objects have no createdAt).
 */
export function formatDate(isoString) {
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
export function showToast(message, type = 'success') {
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
export function showConfirm(message, onConfirm) {
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
export function getSellerName(sellerId) {
    const seller = getSellers().find(s => s.id == sellerId);
    return escapeHTML(seller ? seller.storeName : 'Unknown Seller');
}

/**
 * Returns customer's name by their id.
 * Used to show customer name in orders table.
 */
export function getCustomerName(customerId) {
    const user = getUsers().find(u => u.id == customerId);
    return escapeHTML(user ? (user.name || user.fullName || 'Unknown') : 'Unknown Customer');
}

/**
 * Escapes common HTML special characters to prevent XSS.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) return '—';
    const stringValue = String(str);
    if (!stringValue.trim()) return '—';

    const div = document.createElement('div');
    div.textContent = stringValue;
    return div.innerHTML;
}
