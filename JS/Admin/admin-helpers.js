import {
    KEY_USERS,
    KEY_PRODUCTS,
    KEY_ORDERS,
    KEY_CATEGORIES,
    KEY_CURRENT_USER
} from '../Core/Constants.js';

import { getLS, setLS } from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';

// Memory caches for O(1) lookup
let _sellersMapCache = null;
let _usersMapCache = null;

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

export function getCategories() {
    return getLS(KEY_CATEGORIES) || [];
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

/**
 * Resets memoized maps. Call this after bulk data changes.
 */
export function invalidateCaches() {
    _sellersMapCache = null;
    _usersMapCache = null;
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
 * Escapes HTML special characters to prevent XSS attacks.
 * Converts &, <, >, ", ' to their HTML entity equivalents.
 */
export function escapeHTML(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, char => map[char]);
}

/**
 * Returns seller's storeName by their id — Optimized with Map cache.
 */
export function getSellerName(sellerId) {
    if (!_sellersMapCache) {
        const sellers = getSellers();
        _sellersMapCache = new Map(sellers.map(s => [String(s.id), s]));
    }
    const seller = _sellersMapCache.get(String(sellerId));
    return escapeHTML(seller ? seller.storeName : 'Unknown Seller');
}

/**
 * Returns customer's name by their id — Optimized with Map cache.
 */
export function getCustomerName(customerId) {
    if (!_usersMapCache) {
        const users = getUsers();
        _usersMapCache = new Map(users.map(u => [String(u.id), u]));
    }
    const user = _usersMapCache.get(String(customerId));
    return escapeHTML(user ? (user.name || user.fullName || 'Unknown') : 'Unknown Customer');
}

/**
 * Utility for debouncing frequent events like search input.
 */
export function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Reusable table empty state renderer.
 */
export function renderTableEmptyState(colspan, message, icon = 'bi-search') {
    return `
        <tr>
            <td colspan="${colspan}" class="empty-state">
                <div class="empty-content py-5">
                    <i class="bi ${icon} mb-3" style="font-size: 2rem; color: var(--text-muted); opacity: 0.5;"></i>
                    <p class="empty-title mb-1">${message}</p>
                    <p class="empty-sub small">Try adjusting your filters or search terms.</p>
                </div>
            </td>
        </tr>`;
}

/**
 * Renders a pagination component.
 * @param {number} totalItems - Total count of filtered items
 * @param {number} itemsPerPage - Number of items per page
 * @param {number} currentPage - Current active page (1-based)
 * @param {string} containerId - ID of the container element
 * @param {Function} onPageChange - Callback function when page changes
 */
export function renderPagination(totalItems, itemsPerPage, currentPage, containerId, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        container.classList.add('d-none');
        return;
    }
    container.classList.remove('d-none');
    container.classList.add('pagination-container');

    const startIdx = (currentPage - 1) * itemsPerPage + 1;
    const endIdx = Math.min(currentPage * itemsPerPage, totalItems);

    let html = `
        <div class="pagination-info">
            Showing <strong>${startIdx}</strong> to <strong>${endIdx}</strong> of <strong>${totalItems}</strong> entries
        </div>
        <div class="pagination-controls">
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
                <i class="bi bi-chevron-left"></i>
            </button>
    `;

    // Calculate range of pages to show (max 5 buttons)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    // Correct startPage if it went below 1
    startPage = Math.max(1, startPage);

    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) html += `<span class="pagination-dots">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-dots">...</span>`;
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `
            <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
    `;

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const page = parseInt(btn.dataset.page);
            if (page !== currentPage && page >= 1 && page <= totalPages) {
                onPageChange(page);
            }
        };
    });
}

