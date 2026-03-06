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

        // 3. Date Filter
        let matchDate = true;
        if (o.date && (fromDateObj || toDateObj)) {
            const orderDateObj = new Date(o.date);
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
    // we take the seller of the first item for display brevity, or 'Mixed' if multiple.
    tbody.innerHTML = filtered.map((o, i) => {
        let sellerText = '—';
        if (o.items && o.items.length > 0) {
            const uniqueSellerIds = [...new Set(o.items.map(item => item.sellerId))];
            if (uniqueSellerIds.length > 1) sellerText = 'Multiple Sellers';
            else sellerText = getSellerName(uniqueSellerIds[0]);
        }

        // Dropdown to change order status
        const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
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
                <td>${formatDate(o.date)}</td>
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
 * Prompts user before changing order status.
 * Reverts the dropdown if the user cancels.
 * @param {string|number} orderId 
 * @param {string} newStatus 
 * @param {HTMLSelectElement} selectElement 
 */
export function confirmChangeOrderStatus(orderId, newStatus, selectElement) {
    const orders = getOrders();
    const index = orders.findIndex(o => String(o.id) === String(orderId));
    if (index === -1) return;

    const currentStatus = orders[index].status;

    showConfirm(`Change order #${orderId} status from ${currentStatus} to ${newStatus}?`, () => {
        // Confirmed
        orders[index].status = newStatus;
        saveOrders(orders);
        renderOrdersTable();
        showToast(`Order #${orderId} marked as ${newStatus}.`, 'success');

        // Refresh dashboard KPIs in case revenue/recent orders changed
        const dashboardEl = document.getElementById('dashboardSection');
        if (dashboardEl && dashboardEl.style.display !== 'none') {
            import('./admin-dashboard.js').then(m => m.renderDashboard());
        }
    });

    // Handle cancellation by resetting the dropdown if user closed modal without confirming
    // Since showConfirm doesn't have a direct "onCancel" callback, we watch the modal hidden event
    // or just reset it, and let renderOrdersTable fix the view when confirmed.
    const modalEl = document.getElementById('confirmModal');
    if (modalEl) {
        const resetDropdown = () => {
            if (selectElement) {
                selectElement.value = currentStatus;
            }
            modalEl.removeEventListener('hidden.bs.modal', resetDropdown);
        };
        modalEl.addEventListener('hidden.bs.modal', resetDropdown);

        // Remove listener safely if confirmed (renderOrdersTable will recreate DOM anyway)
    }
}

// Ensure global accessibility for any dynamically created calls (though not strictly needed for this layout)
window.confirmChangeOrderStatus = confirmChangeOrderStatus;
