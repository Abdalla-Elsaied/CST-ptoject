// ============================================================
// admin-orders.js
// Handles the Orders section — Table, Filters, Change Status.
// Depends on: admin-helpers.js
// ============================================================

import {
    getOrders,
    saveOrders,
    getCustomerName,
    getSellerName,
    getCurrentUser,
    formatPrice,
    statusBadge,
    showToast,
    showConfirm,
    renderPagination,
    renderTableEmptyState,
    debounce
} from './admin-helpers.js';

import { getLS, setLS } from '../Core/Storage.js';
import { KEY_PRODUCTS } from '../Core/Constants.js';

import { 
    fetchOrders, 
    getFilteredOrders, 
    updateOrderStatus 
} from './admin-data-orders.js';

import { logAdminAction } from './admin-profile.js';

// Active filter state
const orderFilters = {
    search: '',
    status: 'All',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10
};


/**
 * Main entry point for the orders section.
 * Called every time the user clicks "Orders" in the sidebar.
 */
export function renderOrders() {
    // Fetch from service
    fetchOrders();

    // Reset filters on section load
    orderFilters.search = '';
    orderFilters.status = 'All';
    orderFilters.dateFrom = '';
    orderFilters.dateTo = '';
    orderFilters.page = 1;

    const searchInput = document.getElementById('orderSearchInput');
    const statusFilter = document.getElementById('orderStatusFilter');
    const dateFrom = document.getElementById('orderDateFrom');
    const dateTo = document.getElementById('orderDateTo');

    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'All';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';

    renderOrdersTable();
    bindOrdersEvents();
}


// ─── TABLE RENDERING ─────────────────────────────────────────

/**
 * Renders the orders table based on current orderFilters.
 * Applies search, status, and date range filters simultaneously.
 */
export function renderOrdersTable() {
    const { items, totalItems, currentPage } = getFilteredOrders(orderFilters);
    orderFilters.page = currentPage;

    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    // Update count label
    const countEl = document.getElementById('ordersCount');
    if (countEl) {
        countEl.textContent = `Displaying ${totalItems} order${totalItems !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (items.length === 0) {
        tbody.innerHTML = renderTableEmptyState(10, 'No orders match your filter criteria.', 'bi-receipt');
        renderPagination(0, orderFilters.limit, 1, 'ordersPagination', () => {});
        return;
    }

    const startIdx = (orderFilters.page - 1) * orderFilters.limit;

    // Since a single order can have multiple items from different sellers,
    // we take the seller of the first item for display brevity, or 'Multiple Sellers' if multiple.
    tbody.innerHTML = items.map((o, i) => {
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

        // Dropdown to change order status
        const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];
        const statusOptions = statuses.map(st =>
            `<option value="${st}" ${st === o.status ? 'selected' : ''}>${st}</option>`
        ).join('');

        return `
            <tr>
                <td><span class="text-muted small fw-bold">${startIdx + i + 1}</span></td>
                <td><span class="fw-bold">#${o.id}</span></td>
                <td>${getCustomerName(o.customerId)}</td>
                <td>${sellerText}</td>
                <td>${o.items ? o.items.length : 0} item(s)</td>
                <td><span class="fw-bold text-success">${formatPrice(o.totalPrice || o.total || o.subtotal)}</span></td>
                <td>${statusBadge(o.status)}</td>
                <td>${formatDate(o.date || o.createdAt)}</td>
                <td>
                    <select class="form-select form-select-sm status-dropdown" 
                            data-id="${o.id}" 
                            data-original="${o.status}">
                        ${statusOptions}
                    </select>
                </td>
                <td class="text-center">
                    <button class="btn-action btn-view" data-id="${o.id}" data-action="view">
                        <i class="bi bi-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Render Pagination
    renderPagination(totalItems, orderFilters.limit, orderFilters.page, 'ordersPagination', (newPage) => {
        orderFilters.page = newPage;
        renderOrdersTable();
        document.getElementById('ordersSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}


// ─── ORDER DETAIL MODAL ──────────────────────────────────────

function openOrderDetail(orderId) {
    const orders = getOrders();
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) return;

    const modalEl = document.getElementById('orderDetailModal');
    const titleEl = document.getElementById('orderDetailTitle');
    const bodyEl = document.getElementById('orderDetailBody');
    if (!modalEl || !bodyEl || !titleEl) return;

    titleEl.textContent = `Order #${order.id}`;

    const customerName = getCustomerName(order.customerId);

    // Sellers summary
    let sellerSummary = '—';
    if (order.items && order.items.length > 0) {
        const uniqueSellerIds = [...new Set(order.items.map(i => i.sellerId).filter(Boolean))];
        if (uniqueSellerIds.length === 0) {
            sellerSummary = '—';
        } else if (uniqueSellerIds.length > 1) {
            sellerSummary = 'Multiple Sellers';
        } else {
            sellerSummary = getSellerName(uniqueSellerIds[0]);
        }
    } else if (order.sellerId) {
        sellerSummary = getSellerName(order.sellerId);
    }

    const createdAt = formatDate(order.date || order.createdAt);
    const total = formatPrice(order.totalPrice || order.total || order.subtotal);

    const items = Array.isArray(order.items) ? order.items : [];

    const itemsRows = items.map((item, idx) => {
        const name = item.name || item.productName || item.product || `Item ${idx + 1}`;
        const qty = item.quantity || item.qty || 1;
        const price = Number(item.price) || 0;
        const lineTotal = price * qty;
        const seller = item.sellerId ? getSellerName(item.sellerId) : sellerSummary;
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${name}</td>
                <td>${seller}</td>
                <td>${qty}</td>
                <td>${formatPrice(price)}</td>
                <td>${formatPrice(lineTotal)}</td>
            </tr>
        `;
    }).join('') || `
        <tr>
            <td colspan="6" class="empty-state">No line items recorded for this order.</td>
        </tr>
    `;

    const shippingAddress = order.shippingAddress || order.address || order.fullAddress || null;
    const paymentMethod = order.paymentMethod || order.payment || 'Not specified';

    bodyEl.innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-md-6">
                <h6 class="fw-bold mb-1">Summary</h6>
                <p class="mb-1"><strong>Status:</strong> ${statusBadge(order.status)}</p>
                <p class="mb-1"><strong>Placed on:</strong> ${createdAt}</p>
                <p class="mb-1"><strong>Total:</strong> ${total}</p>
                <p class="mb-0"><strong>Payment:</strong> ${paymentMethod}</p>
            </div>
            <div class="col-md-6">
                <h6 class="fw-bold mb-1">Participants</h6>
                <p class="mb-1"><strong>Customer:</strong> ${customerName}</p>
                <p class="mb-0"><strong>Seller(s):</strong> ${sellerSummary}</p>
            </div>
        </div>

        <h6 class="fw-bold mb-2">Items</h6>
        <div class="table-responsive mb-3">
            <table class="table table-sm align-middle">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th>Seller</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>
        </div>

        ${shippingAddress ? `
        <h6 class="fw-bold mb-1">Shipping Address</h6>
        <p class="mb-0">${shippingAddress}</p>
        ` : ''}
    `;

    new bootstrap.Modal(modalEl).show();
}

// ─── EVENT LISTENERS ─────────────────────────────────────────

/**
 * Binds all filter inputs and table action events.
 */
function bindOrdersEvents() {
    // 1. Live Search
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.oninput = debounce((e) => {
            orderFilters.search = e.target.value;
            orderFilters.page = 1;
            renderOrdersTable();
        }, 300);
    }

    // 2. Status Filter
    const statusFilter = document.getElementById('orderStatusFilter');
    if (statusFilter) {
        statusFilter.onchange = (e) => {
            orderFilters.status = e.target.value;
            orderFilters.page = 1;
            renderOrdersTable();
        };
    }

    // 3. Date Filters
    const dateFrom = document.getElementById('orderDateFrom');
    if (dateFrom) {
        dateFrom.onchange = (e) => {
            orderFilters.dateFrom = e.target.value;
            orderFilters.page = 1;
            renderOrdersTable();
        };
    }

    const dateTo = document.getElementById('orderDateTo');
    if (dateTo) {
        dateTo.onchange = (e) => {
            orderFilters.dateTo = e.target.value;
            orderFilters.page = 1;
            renderOrdersTable();
        };
    }

    // 4. Change Status Event Delegation
    const tbody = document.getElementById('ordersTableBody');
    if (tbody) {
        tbody.onchange = (e) => {
            if (e.target.classList.contains('status-dropdown')) {
                const id = e.target.dataset.id;
                const newStatus = e.target.value;
                const oldStatus = e.target.dataset.original;

                // Only process if status actually changed
                if (newStatus !== oldStatus) {
                    confirmChangeOrderStatus(id, newStatus, e.target);
                }
            }
        };

        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'view') {
                openOrderDetail(btn.dataset.id);
            }
        };
    }
}


// ─── ORDER ACTIONS ───────────────────────────────────────────

/**
 * Prompts user before changing order status with business validation.
 * Prevents invalid status transitions.
 * @param {string|number} orderId 
 * @param {string} newStatus 
 * @param {HTMLSelectElement} selectElement 
 */
export function confirmChangeOrderStatus(orderId, newStatus, selectElement) {
    const orders = getOrders();
    const index = orders.findIndex(o => String(o.id) === String(orderId));
    if (index === -1) return;

    const currentStatus = orders[index].status;

    // Business Rule: Cannot change from Delivered, Cancelled, or Refunded
    if (currentStatus === 'Delivered' || currentStatus === 'Cancelled' || currentStatus === 'Refunded') {
        showToast(`Cannot change status from ${currentStatus}. Order is finalized.`, 'error');
        selectElement.value = currentStatus;
        return;
    }

    // Business Rule: Cannot skip directly to Delivered (must go through Shipped first)
    if (currentStatus === 'Pending' && newStatus === 'Delivered') {
        showToast('Cannot deliver directly from Pending. Process through Shipped first.', 'error');
        selectElement.value = currentStatus;
        return;
    }

    // Business Rule: Refunded can only be set from Delivered or Cancelled
    if (newStatus === 'Refunded' && currentStatus !== 'Delivered' && currentStatus !== 'Cancelled') {
        showToast('Refund can only be issued for Delivered or Cancelled orders.', 'error');
        selectElement.value = currentStatus;
        return;
    }

    // Business Rule: Cannot go backwards in the flow (except to Cancelled or Refunded)
    const statusFlow = ['Pending', 'Processing', 'Shipped', 'Delivered'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    const newIndex = statusFlow.indexOf(newStatus);
    
    if (newStatus !== 'Cancelled' && newStatus !== 'Refunded' && newIndex < currentIndex) {
        showToast(`Cannot move backwards from ${currentStatus} to ${newStatus}.`, 'error');
        selectElement.value = currentStatus;
        return;
    }

    const confirmMessage = newStatus === 'Refunded' 
        ? `Issue refund for order #${orderId}? This will mark the order as refunded and cannot be undone.`
        : `Change order #${orderId} status from ${currentStatus} to ${newStatus}?`;

    showConfirm(confirmMessage, () => {
        // Confirmed
        if (updateOrderStatus(orderId, newStatus)) {
            logAdminAction('changed_order_status', `Order #${orderId} (${currentStatus} → ${newStatus})`, orderId);
            
            // ✅ MAJOR: Restore inventory when order is cancelled or refunded
            if (newStatus === 'Cancelled' || newStatus === 'Refunded') {
                restoreOrderInventory(orderId);
            }
            
            renderOrdersTable();
            showToast(`Order #${orderId} marked as ${newStatus}.`, 'success');
        } else {
            showToast('Failed to update status.', 'error');
        }
    });

    // Refresh dashboard KPIs in case revenue/recent orders changed
    const dashboardEl = document.getElementById('dashboardSection');
    if (dashboardEl && dashboardEl.style.display !== 'none') {
        import('./admin-dashboard.js').then(m => m.renderDashboard());
    }


    // Handle cancellation by resetting the dropdown
    const modalEl = document.getElementById('confirmModal');
    if (modalEl) {
        const resetDropdown = () => {
            if (selectElement) {
                selectElement.value = currentStatus;
            }
            modalEl.removeEventListener('hidden.bs.modal', resetDropdown);
        };
        modalEl.addEventListener('hidden.bs.modal', resetDropdown);
    }
}

// ─── INVENTORY RESTORATION ───────────────────────────────────

/**
 * Restores product inventory when an order is cancelled or refunded.
 * Adds back the quantities that were deducted when the order was placed.
 * @param {string|number} orderId - The order ID
 */
function restoreOrderInventory(orderId) {
    try {
        const orders = getOrders();
        const order = orders.find(o => String(o.id) === String(orderId));
        
        if (!order || !order.items || order.items.length === 0) {
            return;
        }

        const products = getLS(KEY_PRODUCTS) || [];
        let restoredCount = 0;

        order.items.forEach(item => {
            const productId = item.productId || item.id;
            const quantity = item.quantity || item.qty || 1;
            
            const productIndex = products.findIndex(p => String(p.id) === String(productId));
            if (productIndex !== -1) {
                products[productIndex].stock = (products[productIndex].stock || 0) + quantity;
                restoredCount++;
                console.log(`[INVENTORY] Restored ${quantity} units to product ${productId} (Order #${orderId})`);
            }
        });

        if (restoredCount > 0) {
            setLS(KEY_PRODUCTS, products);
            console.log(`[INVENTORY] Restored inventory for ${restoredCount} product(s) from Order #${orderId}`);
        }
    } catch (err) {
        console.error('[INVENTORY] Error restoring inventory:', err);
    }
}

// Ensure global accessibility for any dynamically created calls (though not strictly needed for this layout)
window.confirmChangeOrderStatus = confirmChangeOrderStatus;
