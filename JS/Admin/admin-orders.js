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
    formatDate,
    statusBadge,
    showToast,
    showConfirm
} from '../Admin/admin-helpers.js';

// Active filter state
const orderFilters = {
    search: '',
    status: 'All',
    dateFrom: '',
    dateTo: ''
};


/**
 * Main entry point for the orders section.
 * Called every time the user clicks "Orders" in the sidebar.
 */
export function renderOrders() {
    // Reset filters on section load
    orderFilters.search = '';
    orderFilters.status = 'All';
    orderFilters.dateFrom = '';
    orderFilters.dateTo = '';

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
    const orders = getOrders();
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const { search, status, dateFrom, dateTo } = orderFilters;
    const query = search.toLowerCase().trim();

    // Parse filter dates (ignoring time for comparison)
    const fromDateObj = dateFrom ? new Date(dateFrom) : null;
    if (fromDateObj) fromDateObj.setHours(0, 0, 0, 0);

    const toDateObj = dateTo ? new Date(dateTo) : null;
    if (toDateObj) toDateObj.setHours(23, 59, 59, 999);

    const filtered = orders.filter(o => {
        // 1. Search Filter (Order ID or Customer Name)
        const custName = getCustomerName(o.customerId).toLowerCase();
        const orderIdStr = String(o.id).toLowerCase();
        const matchSearch = orderIdStr.includes(query) || custName.includes(query);

        // 2. Status Filter
        // Note: HTML select options might say "All Statuses", value might be "All"
        const filterVal = status === 'All Statuses' ? 'All' : status;
        const matchStatus = filterVal === 'All' || o.status === filterVal;

        // 3. Date Filter - handle both 'date' and 'createdAt' fields
        let matchDate = true;
        const orderDate = o.date || o.createdAt;
        if (orderDate && (fromDateObj || toDateObj)) {
            const orderDateObj = new Date(orderDate);
            if (fromDateObj && orderDateObj < fromDateObj) matchDate = false;
            if (toDateObj && orderDateObj > toDateObj) matchDate = false;
        }

        return matchSearch && matchStatus && matchDate;
    });

    // Update count label
    const countEl = document.getElementById('ordersCount');
    if (countEl) {
        countEl.textContent = `Displaying ${filtered.length} order${filtered.length !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    No orders match your filter criteria.
                </td>
            </tr>`;
        return;
    }

    // Since a single order can have multiple items from different sellers,
    // we take the seller of the first item for display brevity, or 'Multiple Sellers' if multiple.
    tbody.innerHTML = filtered.map((o, i) => {
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
                <td><span class="text-muted small fw-bold">${i + 1}</span></td>
                <td><span class="fw-bold">#${o.id}</span></td>
                <td>${getCustomerName(o.customerId)}</td>
                <td>${sellerText}</td>
                <td>${o.items ? o.items.length : 0} item(s)</td>
                <td><span class="fw-bold text-success">${formatPrice(o.totalPrice || o.total)}</span></td>
                <td>${statusBadge(o.status)}</td>
                <td>${formatDate(o.date || o.createdAt)}</td>
                <td>
                    <select class="form-select form-select-sm status-dropdown" 
                            data-id="${o.id}" 
                            data-original="${o.status}">
                        ${statusOptions}
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

/**
 * Binds all filter inputs and table action events.
 */
function bindOrdersEvents() {
    // 1. Live Search
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            orderFilters.search = e.target.value;
            renderOrdersTable();
        };
    }

    // 2. Status Filter
    const statusFilter = document.getElementById('orderStatusFilter');
    if (statusFilter) {
        statusFilter.onchange = (e) => {
            orderFilters.status = e.target.value;
            renderOrdersTable();
        };
    }

    // 3. Date Filters
    const dateFrom = document.getElementById('orderDateFrom');
    if (dateFrom) {
        dateFrom.onchange = (e) => {
            orderFilters.dateFrom = e.target.value;
            renderOrdersTable();
        };
    }

    const dateTo = document.getElementById('orderDateTo');
    if (dateTo) {
        dateTo.onchange = (e) => {
            orderFilters.dateTo = e.target.value;
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
        orders[index].status = newStatus;
        orders[index].statusUpdatedAt = new Date().toISOString();
        orders[index].statusUpdatedBy = getCurrentUser()?.id;
        
        if (newStatus === 'Refunded') {
            orders[index].refundedAt = new Date().toISOString();
            orders[index].refundedBy = getCurrentUser()?.id;
        }
        
        saveOrders(orders);
        renderOrdersTable();
        
        console.log(`[AUDIT] Order #${orderId} status changed from ${currentStatus} to ${newStatus}`);
        showToast(`Order #${orderId} marked as ${newStatus}.`, 'success');

        // Refresh dashboard KPIs in case revenue/recent orders changed
        const dashboardEl = document.getElementById('dashboardSection');
        if (dashboardEl && dashboardEl.style.display !== 'none') {
            import('./admin-dashboard.js').then(m => m.renderDashboard());
        }
    });

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

// Ensure global accessibility for any dynamically created calls (though not strictly needed for this layout)
window.confirmChangeOrderStatus = confirmChangeOrderStatus;
