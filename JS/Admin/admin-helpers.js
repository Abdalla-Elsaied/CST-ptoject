// ============================================================
// admin-helpers.js
// Shared utilities used across all admin section files.
//
// FIXES:
//   getCustomerName() → returns '—' instead of 'Unknown Customer'
//   getSellerName()   → returns '—' instead of 'Unknown Seller'
//   saveSellers()     → uses updateItem() per seller, no full array POST
// ============================================================

import {
    KEY_USERS,
    KEY_PRODUCTS,
    KEY_ORDERS,
    KEY_CATEGORIES,
    KEY_CURRENT_USER
} from '../Core/Constants.js';

import {
    getLS,
    setLS,
    updateItem,
    deleteItem
} from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';

// Memory caches for O(1) name lookup
let _sellersMapCache = null;
let _usersMapCache   = null;


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

/**
 * Save sellers back.
 * FIX: Old version merged sellers into full array and called
 *      setLS(KEY_USERS, fullArray) → POST all users → duplicates.
 *      New version uses updateItem() per seller → PUT only.
 */
export function saveSellers(sellers) {
    sellers.forEach(seller => {
        updateItem(KEY_USERS, seller.id, seller);
    });
    // Invalidate cache so next getSellers() reflects changes
    invalidateCaches();
}

export function saveProducts(products) {
    setLS(KEY_PRODUCTS, products);
}

export function saveOrders(orders) {
    setLS(KEY_ORDERS, orders);
}

/**
 * Resets memoized Maps.
 * Call after bulk data changes or after initUsers() + patchSeedSellers().
 */
export function invalidateCaches() {
    _sellersMapCache = null;
    _usersMapCache   = null;
}


// ─── NAME LOOKUP ─────────────────────────────────────────────

/**
 * Returns seller's storeName by id.
 * Uses Map cache for O(1) lookup after first call.
 * FIX: Returns '—' instead of 'Unknown Seller' when not found.
 */
export function getSellerName(sellerId) {
    if (!sellerId) return '—';
    if (!_sellersMapCache) {
        const sellers = getSellers();
        _sellersMapCache = new Map(sellers.map(s => [String(s.id), s]));
    }
    const seller = _sellersMapCache.get(String(sellerId));
    return escapeHTML(seller ? (seller.storeName || seller.name || '—') : '—');
}

/**
 * Returns customer's display name by id.
 * Uses Map cache for O(1) lookup after first call.
 * FIX: Returns '—' instead of 'Unknown Customer' when not found.
 */
export function getCustomerName(customerId) {
    if (!customerId) return '—';
    if (!_usersMapCache) {
        const users = getUsers();
        _usersMapCache = new Map(users.map(u => [String(u.id), u]));
    }
    const user = _usersMapCache.get(String(customerId));
    return escapeHTML(user ? (user.name || user.fullName || '—') : '—');
}

/**
 * Returns customer's email by id.
 */
export function getCustomerEmail(customerId) {
    if (!customerId) return '—';
    if (!_usersMapCache) {
        const users = getUsers();
        _usersMapCache = new Map(users.map(u => [String(u.id), u]));
    }
    const user = _usersMapCache.get(String(customerId));
    return escapeHTML(user ? user.email : '—');
}


// ─── BADGE HELPERS ───────────────────────────────────────────

/**
 * Returns a colored HTML badge for order status.
 */
export function statusBadge(status) {
    const map = {
        'Pending':    { bg: '#f59e0b', color: '#fff' },
        'Processing': { bg: '#3b82f6', color: '#fff' },
        'Shipped':    { bg: '#8b5cf6', color: '#fff' },
        'Delivered':  { bg: '#22c55e', color: '#fff' },
        'Cancelled':  { bg: '#ef4444', color: '#fff' },
        'Refunded':   { bg: '#6b7280', color: '#fff' },
    };
    const style = map[status] || { bg: '#6b7280', color: '#fff' };
    return `<span class="status-badge" style="background:${style.bg};color:${style.color}">${escapeHTML(status || 'Unknown')}</span>`;
}

/**
 * Returns a colored badge for product stock level.
 */
export function stockBadge(stock) {
    const n = Number(stock);
    if (isNaN(n) || n === 0) return `<span class="stock-badge stock-out">Out of Stock</span>`;
    if (n <= 5)               return `<span class="stock-badge stock-low">Low: ${n}</span>`;
    return `<span class="stock-badge stock-ok">${n} in stock</span>`;
}

/**
 * Returns a colored badge for active/inactive product status.
 */
export function activeBadge(isActive) {
    return isActive
        ? `<span class="active-badge active-yes">Active</span>`
        : `<span class="active-badge active-no">Inactive</span>`;
}


// ─── FORMATTING ──────────────────────────────────────────────

/**
 * Formats a number as price — e.g. 49.9 → "$49.90"
 */
export function formatPrice(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * Formats an ISO date string — e.g. "2026-03-05T..." → "Mar 5, 2026"
 * Returns "N/A" if date is missing.
 */
export function formatDate(isoString) {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleDateString('en-US', {
            year:  'numeric',
            month: 'short',
            day:   'numeric'
        });
    } catch {
        return 'N/A';
    }
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
export function escapeHTML(text) {
    if (!text && text !== 0) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, char => map[char]);
}


// ─── UI HELPERS ──────────────────────────────────────────────

/**
 * Shows a toast notification at bottom-right.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 */
export function showToast(message, type = 'success') {
    // Remove existing toast
    document.getElementById('adminToast')?.remove();

    const config = {
        success: { bg: 'linear-gradient(135deg,#065f46,#047857)', border: '#10b981', icon: 'bi-check-circle-fill' },
        error:   { bg: 'linear-gradient(135deg,#7f1d1d,#991b1b)', border: '#ef4444', icon: 'bi-x-circle-fill'    },
        warning: { bg: 'linear-gradient(135deg,#78350f,#92400e)', border: '#f59e0b', icon: 'bi-exclamation-triangle-fill' },
        info:    { bg: 'linear-gradient(135deg,#1e3a5f,#1e40af)', border: '#3b82f6', icon: 'bi-info-circle-fill'  }
    };
    const c = config[type] || config.info;

    const toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.innerHTML = `
        <i class="bi ${c.icon}" style="font-size:18px;flex-shrink:0;"></i>
        <span style="flex:1;line-height:1.4;">${escapeHTML(message)}</span>
        <button onclick="this.parentElement.remove()"
            style="background:none;border:none;color:rgba(255,255,255,0.7);
                   cursor:pointer;padding:0;font-size:16px;line-height:1;
                   flex-shrink:0;">✕</button>
    `;
    toast.style.cssText = `
        position:       fixed;
        bottom:         28px;
        right:          28px;
        z-index:        99999;
        min-width:      320px;
        max-width:      480px;
        padding:        16px 20px;
        border-radius:  12px;
        font-family:    'Inter', sans-serif;
        font-size:      14px;
        font-weight:    600;
        color:          #ffffff;
        background:     ${c.bg};
        border-left:    4px solid ${c.border};
        box-shadow:     0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
        display:        flex;
        align-items:    center;
        gap:            12px;
        animation:      toastSlideIn 0.35s cubic-bezier(0.16,1,0.3,1);
        overflow:       hidden;
    `;

    // Progress bar at bottom
    const progress = document.createElement('div');
    progress.style.cssText = `
        position:   absolute;
        bottom:     0;
        left:       0;
        height:     3px;
        width:      100%;
        background: ${c.border};
        opacity:    0.6;
        animation:  toastProgress 3s linear forwards;
    `;
    toast.appendChild(progress);
    toast.style.position = 'fixed'; // ensure position is set for absolute child

    // Add keyframes once
    if (!document.getElementById('toastKeyframes')) {
        const style = document.createElement('style');
        style.id = 'toastKeyframes';
        style.textContent = `
            @keyframes toastSlideIn {
                from { transform: translateX(110%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
            }
            @keyframes toastProgress {
                from { width: 100%; }
                to   { width: 0%;   }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            toast.style.cssText += `
                @keyframes toastSlideOut {
                    to { transform: translateX(110%); opacity: 0; }
                }
            `;
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
}

/**
 * Shows a reusable confirm modal.
 * @param {string} message
 * @param {Function} onConfirm
 * @param {Function} [onCancel]
 */
export function showConfirm(message, onConfirm, onCancel) {
    const msgEl = document.getElementById('confirmMessage');
    if (msgEl) msgEl.textContent = message;

    const modalEl   = document.getElementById('confirmModal');
    const modal     = new bootstrap.Modal(modalEl);
    const confirmBtn = document.getElementById('confirmActionBtn');

    // Clone to remove previous listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
        modal.hide();
        onConfirm();
    });

    if (onCancel) {
        const handleCancel = () => {
            onCancel();
            modalEl.removeEventListener('hidden.bs.modal', handleCancel);
        };
        modalEl.addEventListener('hidden.bs.modal', handleCancel);
        newBtn.addEventListener('click', () => {
            modalEl.removeEventListener('hidden.bs.modal', handleCancel);
        }, { once: true });
    }

    modal.show();
}

/**
 * Shows a loading spinner on an element or the full page.
 */
export function showLoading(targetId = null, message = 'Loading...') {
    const loaderId = targetId ? `loader-${targetId}` : 'globalLoader';
    document.getElementById(loaderId)?.remove();

    const loader = document.createElement('div');
    loader.id        = loaderId;
    loader.className = targetId ? 'local-loader' : 'global-loader';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="loader-message mt-2">${escapeHTML(message)}</div>
        </div>`;

    if (targetId) {
        const target = document.getElementById(targetId);
        if (target) {
            target.style.position = 'relative';
            target.appendChild(loader);
        }
    } else {
        document.body.appendChild(loader);
    }
}

/**
 * Hides a loading spinner.
 */
export function hideLoading(targetId = null) {
    const loaderId = targetId ? `loader-${targetId}` : 'globalLoader';
    const loader   = document.getElementById(loaderId);
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 200);
    }
}

/**
 * Renders a standard empty state row for tables.
 */
export function renderTableEmptyState(colspan, message, icon = 'bi-search') {
    return `
        <tr>
            <td colspan="${colspan}" class="empty-state">
                <div class="empty-content py-5">
                    <i class="bi ${icon} mb-3"
                       style="font-size:2rem;color:var(--text-muted);opacity:0.5;display:block;">
                    </i>
                    <p class="empty-title mb-1">${escapeHTML(message)}</p>
                    <p class="empty-sub small">Try adjusting your filters or search terms.</p>
                </div>
            </td>
        </tr>`;
}

/**
 * Debounce utility for search inputs.
 */
export function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Renders a full pagination component.
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
    const endIdx   = Math.min(currentPage * itemsPerPage, totalItems);

    let startPage = Math.max(1, currentPage - 2);
    let endPage   = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    startPage = Math.max(1, startPage);

    let html = `
        <div class="pagination-info">
            Showing <strong>${startIdx}</strong> to <strong>${endIdx}</strong>
            of <strong>${totalItems}</strong> entries
        </div>
        <div class="pagination-controls">
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''}
                data-page="${currentPage - 1}">
                <i class="bi bi-chevron-left"></i>
            </button>`;

    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) html += `<span class="pagination-dots">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        html += `<button class="page-btn ${p === currentPage ? 'active' : ''}"
                    data-page="${p}">${p}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-dots">...</span>`;
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `
            <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''}
                data-page="${currentPage + 1}">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>`;

    container.innerHTML = html;

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
