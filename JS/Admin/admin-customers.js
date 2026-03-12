// ============================================================
// admin-customers.js
// Handles the Customers section — view, delete, reset password.
// Depends on: admin-helpers.js
// ============================================================

import {
    getUsers,
    saveUsers,
    getOrders,
    getSellers,
    saveSellers,
    getCurrentUser,
    formatDate,
    formatPrice,
    showConfirm,
    showToast,
    escapeHTML,
    statusBadge,
    renderPagination,
    renderTableEmptyState
} from './admin-helpers.js';

import { getLS } from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';
import { logAdminAction } from './admin-profile.js';

// Current search and filter state
let customerSearchQuery = '';
let customerStatusFilter = 'All';
let customerRoleFilter = 'All';
let customerPagination = { page: 1, limit: 10 };


/**
 * Main entry point for the customers section.
 */
export function renderCustomers() {
    customerSearchQuery = '';
    customerStatusFilter = 'All';
    customerRoleFilter = 'All';
    customerPagination.page = 1;

    const searchInput = document.getElementById('customerSearchInput');
    const statusFilter = document.getElementById('customerStatusFilter');
    const roleFilter = document.getElementById('customerRoleFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'All';
    if (roleFilter) roleFilter.value = 'All';
    
    setupStatusFilter();
    renderCustomersTable();
    bindCustomersEvents();
}

/**
 * Setup status filter dropdown
 */
function setupStatusFilter() {
    // Status filter
    const statusFilter = document.getElementById('customerStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            customerStatusFilter = e.target.value;
            customerPagination.page = 1;
            renderCustomersTable();
        });
    }
    
    // Role filter
    const roleFilter = document.getElementById('customerRoleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', (e) => {
            customerRoleFilter = e.target.value;
            customerPagination.page = 1;
            renderCustomersTable();
        });
    }
}

/**
 * Normalize customer object with default fields
 */
function normalizeCustomer(rawCustomer) {
    return {
        ...rawCustomer,
        isBanned: rawCustomer.isBanned ?? false,
        bannedAt: rawCustomer.bannedAt ?? null,
        bannedReason: rawCustomer.bannedReason ?? null,
        bannedBy: rawCustomer.bannedBy ?? null,
        lastLoginAt: rawCustomer.lastLoginAt ?? null,
        accountLog: rawCustomer.accountLog ?? []
    };
}


// ─── TABLE RENDERING ─────────────────────────────────────────

/**
 * Renders the customers table from ls_users filtered by role='customer'.
 * Also shows sellers so admin can manage all users and change roles.
 */
export function renderCustomersTable() {
    const allUsers = getUsers();
    // Show all valid users so we can see admins (admins have protected UI state)
    const users = allUsers.filter(u => u.role === ROLES.CUSTOMER || u.role === ROLES.SELLER || u.role === 'admin')
        .map(u => normalizeCustomer(u));
    
    const query = customerSearchQuery.toLowerCase();
    const tbody = document.getElementById('customersTableBody');

    if (!tbody) return;

    // Filter by search query, status, and role
    const filtered = users.filter(c => {
        const name = (c.name || c.fullName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const role = (c.role || '').toLowerCase();
        const matchesSearch = name.includes(query) || email.includes(query) || role.includes(query);
        
        // Status filter
        let matchesStatus = true;
        if (customerStatusFilter === 'Active') {
            matchesStatus = !c.isBanned;
        } else if (customerStatusFilter === 'Banned') {
            matchesStatus = c.isBanned;
        }
        
        // Role filter
        let matchesRole = true;
        if (customerRoleFilter !== 'All') {
            matchesRole = c.role === customerRoleFilter;
        }
        
        return matchesSearch && matchesStatus && matchesRole;
    });

    // Update count label
    const countEl = document.getElementById('customersCount');
    if (countEl) {
        const customerCount = filtered.filter(u => u.role === ROLES.CUSTOMER).length;
        const sellerCount = filtered.filter(u => u.role === ROLES.SELLER).length;
        countEl.textContent = `${customerCount} customer${customerCount !== 1 ? 's' : ''}, ${sellerCount} seller${sellerCount !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filtered.length === 0) {
        tbody.innerHTML = renderTableEmptyState(9, 'No users match your filters.', 'bi-people');
        renderPagination(0, customerPagination.limit, 1, 'customersPagination', () => {});
        return;
    }

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / customerPagination.limit);
    if (customerPagination.page > totalPages) customerPagination.page = Math.max(1, totalPages);

    const start = (customerPagination.page - 1) * customerPagination.limit;
    const paginated = filtered.slice(start, start + customerPagination.limit);

    tbody.innerHTML = paginated.map((c, i) => {
        const isBanned = c.isBanned;
        const isAdmin = c.role === 'admin';
        const isSeller = c.role === ROLES.SELLER;
        const isCustomer = c.role === ROLES.CUSTOMER;

        const statusBadge = isBanned
            ? `<span class="status-badge status-cancelled" title="Banned: ${escapeHTML(c.bannedReason || 'No reason provided')}">
                <i class="bi bi-ban"></i> Banned
               </span>`
            : '<span class="status-badge status-active"><i class="bi bi-check-circle"></i> Active</span>';

        const roleBadge = isAdmin
            ? '<span class="status-badge bg-dark text-white"><i class="bi bi-shield-lock"></i> Admin</span>'
            : isSeller
                ? '<span class="status-badge status-shipped"><i class="bi bi-shop"></i> Seller</span>'
                : '<span class="status-badge status-pending"><i class="bi bi-person"></i> Customer</span>';

        const rowClass = isBanned ? 'banned-row' : '';
        
        // Get user initials for avatar
        const initials = (c.name || c.fullName || c.email)
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('')
            .substring(0, 2);

        return `
        <tr class="${rowClass}" data-user-id="${c.id}">
            <td>
                ${isAdmin ? '' : `<input type="checkbox" class="form-check-input user-checkbox" value="${c.id}">`}
            </td>
            <td>
                <span class="text-muted small fw-bold">${start + i + 1}</span>
            </td>
            <td>
                <div class="d-flex align-items-center gap-3">
                    <div class="user-avatar ${isBanned ? 'banned' : ''}" style="background: ${isBanned ? '#ef4444' : 'linear-gradient(135deg, var(--green-primary), #10b981)'}">
                        ${initials}
                    </div>
                    <div class="user-info">
                        <div class="user-name">${escapeHTML(c.name || c.fullName || 'Unknown')}</div>
                        <div class="user-role-text text-muted">${c.role === 'admin' ? 'System Administrator' : c.role === ROLES.SELLER ? 'Marketplace Seller' : 'Customer'}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="contact-info">
                    <div class="user-email">
                        <i class="bi bi-envelope text-muted me-1"></i>
                        ${escapeHTML(c.email)}
                    </div>
                    ${c.phone ? `
                        <div class="user-phone text-muted small">
                            <i class="bi bi-telephone me-1"></i>
                            ${escapeHTML(c.phone)}
                        </div>
                    ` : ''}
                </div>
            </td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="date-info">
                    <div class="join-date">${formatDate(c.createdAt)}</div>
                    ${c.lastLoginAt ? `
                        <div class="last-login text-muted small">
                            Last: ${formatDate(c.lastLoginAt)}
                        </div>
                    ` : '<div class="text-muted small">Never logged in</div>'}
                </div>
            </td>
            <td>
                <div class="orders-info text-center">
                    <span class="fw-bold">${getCustomerOrderCount(c.id)}</span>
                    <div class="text-muted small">orders</div>
                </div>
            </td>
            <td class="text-center">
                ${isAdmin
                ? '<span class="text-muted small"><i class="bi bi-shield-lock"></i> Protected</span>'
                : `<div class="action-buttons d-flex gap-1 justify-content-center flex-wrap">
                        <button class="btn-action btn-info btn-sm" title="View Details"
                                data-id="${c.id}" data-action="viewDetails">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${isBanned
                    ? `<button class="btn-action btn-success btn-sm" title="Unban Account"
                                    data-id="${c.id}" data-action="unban">
                                <i class="bi bi-check-circle"></i>
                            </button>`
                    : `<button class="btn-action btn-warn btn-sm" title="Ban Account"
                                    data-id="${c.id}" data-action="ban">
                                <i class="bi bi-ban"></i>
                            </button>`
                }
                        <button class="btn-action btn-edit btn-sm" title="Reset Password"
                                data-id="${c.id}" data-action="resetPassword">
                            <i class="bi bi-key"></i>
                        </button>
                        <button class="btn-action btn-delete btn-sm" title="Delete Account"
                                data-id="${c.id}" data-action="delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>`
            }
            </td>
        </tr>
    `;
    }).join('');

    // Render Pagination
    renderPagination(totalItems, customerPagination.limit, customerPagination.page, 'customersPagination', (newPage) => {
        customerPagination.page = newPage;
        renderCustomersTable();
        document.getElementById('customersSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

function bindCustomersEvents() {
    const searchInput = document.getElementById('customerSearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            customerSearchQuery = e.target.value;
            customerPagination.page = 1;
            renderCustomersTable();
        };
    }

    // Bulk selection
    const selectAllCheckbox = document.getElementById('selectAllUsers');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateBulkActionsVisibility();
        });
    }

    // Individual checkbox changes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('user-checkbox')) {
            updateBulkActionsVisibility();
            
            // Update select all checkbox state
            const checkboxes = document.querySelectorAll('.user-checkbox');
            const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
            const selectAll = document.getElementById('selectAllUsers');
            
            if (selectAll) {
                selectAll.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
                selectAll.checked = checkedBoxes.length === checkboxes.length && checkboxes.length > 0;
            }
        }
    });

    const tbody = document.getElementById('customersTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'viewDetails') openCustomerDetailsModal(id);
            if (action === 'ban') banCustomer(id);
            if (action === 'unban') unbanCustomer(id);
            if (action === 'resetPassword') {
                const users = getUsers();
                const user = users.find(u => String(u.id) === String(id));
                const type = user && user.role === ROLES.SELLER ? 'seller' : 'customer';
                openResetPasswordModal(id, type);
            }
            if (action === 'delete') confirmDeleteCustomer(id);
        };
    }
}

/**
 * Update bulk actions button visibility
 */
function updateBulkActionsVisibility() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const bulkBtn = document.getElementById('bulkActionsBtn');
    
    if (bulkBtn) {
        if (checkedBoxes.length > 0) {
            bulkBtn.style.display = 'inline-flex';
            bulkBtn.textContent = `Bulk Actions (${checkedBoxes.length})`;
        } else {
            bulkBtn.style.display = 'none';
        }
    }
}


// ─── SUSPEND / UNSUSPEND CUSTOMER ────────────────────────────

/**
 * Suspends a customer account - blocks login.
 */
export function confirmSuspendCustomer(id) {
    const users = getUsers();
    const customer = users.find(u => String(u.id) === String(id));
    if (!customer) return;

    showConfirm(
        `Suspend customer "${customer.name || customer.fullName || customer.email}"? They will not be able to login.`,
        () => {
            const index = users.findIndex(u => String(u.id) === String(id));
            if (index === -1) return;

            users[index].isSuspended = true;
            users[index].suspendedAt = new Date().toISOString();
            users[index].suspendedBy = getCurrentUser()?.id;
            saveUsers(users);
            renderCustomersTable();

            console.log(`[AUDIT] Customer ${customer.email} suspended by admin`);
            showToast('Customer account suspended.', 'warning');
        }
    );
}

/**
 * Unsuspends a customer account - allows login again.
 */
export function confirmUnsuspendCustomer(id) {
    const users = getUsers();
    const customer = users.find(u => String(u.id) === String(id));
    if (!customer) return;

    showConfirm(
        `Unsuspend customer "${customer.name || customer.fullName || customer.email}"? They will be able to login again.`,
        () => {
            const index = users.findIndex(u => String(u.id) === String(id));
            if (index === -1) return;

            users[index].isSuspended = false;
            users[index].unsuspendedAt = new Date().toISOString();
            users[index].unsuspendedBy = getCurrentUser()?.id;
            saveUsers(users);
            renderCustomersTable();

            console.log(`[AUDIT] Customer ${customer.email} unsuspended by admin`);
            showToast('Customer account unsuspended.', 'success');
        }
    );
}


// ─── HELPERS ─────────────────────────────────────────────────

/**
 * Returns how many orders a customer has placed.
 */
export function getCustomerOrderCount(customerId) {
    const count = getOrders().filter(o => String(o.customerId) === String(customerId)).length;
    return count === 0
        ? '<span class="text-muted small">0 orders</span>'
        : `<span class="badge" style="background:var(--green-light-bg); color:var(--green-dark)">${count} order${count !== 1 ? 's' : ''}</span>`;
}


// ─── ROLE CHANGE ─────────────────────────────────────────────

/**
 * Changes a seller's role to customer.
 * Validates that seller has no active products before allowing change.
 */
export function confirmChangeToCustomer(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user || user.role !== ROLES.SELLER) return;

    // Check if seller has ANY products (active or inactive)
    const products = getLS('ls_products') || [];
    const sellerProducts = products.filter(p => String(p.sellerId) === String(id));

    if (sellerProducts.length > 0) {
        showToast(`Cannot change role. Seller still has ${sellerProducts.length} product(s) in the catalog. Please delete them first.`, 'error');
        return;
    }

    showConfirm(
        `Change "${user.name || user.fullName || user.email}" from Seller to Customer? All seller-specific data will be removed.`,
        () => {
            const index = users.findIndex(u => String(u.id) === String(id));
            if (index === -1) return;

            // Change role and remove seller-specific fields
            users[index].role = ROLES.CUSTOMER;
            delete users[index].storeName;
            delete users[index].storeDescription;
            delete users[index].description;
            delete users[index].city;
            delete users[index].phone;
            delete users[index].paymentMethod;
            delete users[index].isApproved;

            users[index].roleChangedAt = new Date().toISOString();
            users[index].roleChangedBy = getCurrentUser()?.id;
            users[index].previousRole = ROLES.SELLER;

            saveUsers(users);
            renderCustomersTable();

            console.log(`[AUDIT] User ${user.email} role changed from Seller to Customer by admin`);
            showToast('User role changed to Customer successfully.', 'success');
        }
    );
}

/**
 * Changes a customer's role to seller.
 * Opens a modal to collect seller-specific information.
 */
export function confirmChangeToSeller(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user || user.role !== ROLES.CUSTOMER) return;

    showConfirm(
        `Change "${user.name || user.fullName || user.email}" from Customer to Seller? They will need to provide store information.`,
        () => {
            openSellerInfoModal(id);
        }
    );
}

/**
 * Opens modal to collect seller information when changing customer to seller.
 */
function openSellerInfoModal(userId) {
    // Create modal HTML if it doesn't exist
    let modal = document.getElementById('sellerInfoModal');
    if (!modal) {
        const modalHTML = `
            <div class="modal fade" id="sellerInfoModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Seller Information Required</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="sellerInfoUserId">
                            <div class="mb-3">
                                <label class="form-label">Store Name <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sellerInfoStoreName" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">City <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sellerInfoCity" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Phone <span class="text-danger">*</span></label>
                                <input type="tel" class="form-control" id="sellerInfoPhone" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Payment Method <span class="text-danger">*</span></label>
                                <select class="form-select" id="sellerInfoPayment" required>
                                    <option value="">Select...</option>
                                    <option>Bank Transfer</option>
                                    <option>Vodafone Cash</option>
                                    <option>InstaPay</option>
                                    <option>PayPal</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Store Description</label>
                                <textarea class="form-control" id="sellerInfoDescription" rows="3"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn-primary-green" onclick="saveSellerInfo()">Save & Change Role</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('sellerInfoModal');
    }

    // Set user ID and show modal
    document.getElementById('sellerInfoUserId').value = userId;
    document.getElementById('sellerInfoStoreName').value = '';
    document.getElementById('sellerInfoCity').value = '';
    document.getElementById('sellerInfoPhone').value = '';
    document.getElementById('sellerInfoPayment').value = '';
    document.getElementById('sellerInfoDescription').value = '';

    new bootstrap.Modal(modal).show();
}

/**
 * Saves seller information and completes role change from customer to seller.
 */
window.saveSellerInfo = function () {
    const userId = document.getElementById('sellerInfoUserId').value;
    const storeName = document.getElementById('sellerInfoStoreName').value.trim();
    const city = document.getElementById('sellerInfoCity').value.trim();
    const phone = document.getElementById('sellerInfoPhone').value.trim();
    const payment = document.getElementById('sellerInfoPayment').value;
    const description = document.getElementById('sellerInfoDescription').value.trim();

    // Validation
    if (!storeName || !city || !phone || !payment) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    const users = getUsers();
    const index = users.findIndex(u => String(u.id) === String(userId));
    if (index === -1) return;

    // Change role and add seller-specific fields
    users[index].role = ROLES.SELLER;
    users[index].storeName = storeName;
    users[index].city = city;
    users[index].phone = phone;
    users[index].paymentMethod = payment;
    users[index].description = description;
    users[index].storeDescription = description;
    users[index].isApproved = true; // Admin-approved seller
    users[index].roleChangedAt = new Date().toISOString();
    users[index].roleChangedBy = getCurrentUser()?.id;
    users[index].previousRole = ROLES.CUSTOMER;

    saveUsers(users);

    // Close modal
    const modalEl = document.getElementById('sellerInfoModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    renderCustomersTable();

    console.log(`[AUDIT] User ${users[index].email} role changed from Customer to Seller by admin`);
    showToast('User role changed to Seller successfully.', 'success');
};


/**
 * Opens customer details modal showing comprehensive user information
 */
function openCustomerDetailsModal(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return;

    const orders = getOrders().filter(o => String(o.customerId) === String(id));
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || Number(o.totalPrice) || 0), 0);

    // Create modal if it doesn't exist
    if (!document.getElementById('customerDetailsModal')) {
        const modalHTML = `
            <div class="modal fade" id="customerDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">User Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="customerDetailsBody">
                            <!-- Content will be populated here -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Populate modal content
    const modalBody = document.getElementById('customerDetailsBody');
    modalBody.innerHTML = `
        <div class="row g-4">
            <div class="col-md-6">
                <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Personal Information</h6>
                <div class="mb-2"><strong>Name:</strong> ${escapeHTML(user.name || user.fullName || 'Not provided')}</div>
                <div class="mb-2"><strong>Email:</strong> ${escapeHTML(user.email)}</div>
                <div class="mb-2"><strong>Role:</strong> 
                    <span class="badge ${user.role === 'admin' ? 'bg-dark' : user.role === ROLES.SELLER ? 'bg-info' : 'bg-secondary'}">
                        ${user.role}
                    </span>
                </div>
                <div class="mb-2"><strong>Status:</strong> 
                    <span class="badge ${user.isBanned ? 'bg-danger' : 'bg-success'}">
                        ${user.isBanned ? 'Banned' : 'Active'}
                    </span>
                </div>
                ${user.isBanned ? `<div class="mb-2"><strong>Ban Reason:</strong> ${escapeHTML(user.bannedReason || 'No reason provided')}</div>` : ''}
            </div>
            <div class="col-md-6">
                <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Account Information</h6>
                <div class="mb-2"><strong>Member Since:</strong> ${formatDate(user.createdAt)}</div>
                <div class="mb-2"><strong>Last Login:</strong> ${user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</div>
                <div class="mb-2"><strong>Total Orders:</strong> ${orders.length}</div>
                <div class="mb-2"><strong>Total Spent:</strong> ${formatPrice(totalSpent)}</div>
            </div>
        </div>
        
        ${user.role === ROLES.SELLER ? `
            <hr class="my-4">
            <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Seller Information</h6>
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="mb-2"><strong>Store Name:</strong> ${escapeHTML(user.storeName || 'Not provided')}</div>
                    <div class="mb-2"><strong>City:</strong> ${escapeHTML(user.city || 'Not provided')}</div>
                </div>
                <div class="col-md-6">
                    <div class="mb-2"><strong>Phone:</strong> ${escapeHTML(user.phone || 'Not provided')}</div>
                    <div class="mb-2"><strong>Payment Method:</strong> ${escapeHTML(user.paymentMethod || 'Not provided')}</div>
                </div>
                ${user.description ? `<div class="col-12"><div class="mb-2"><strong>Description:</strong> ${escapeHTML(user.description)}</div></div>` : ''}
            </div>
        ` : ''}
        
        ${orders.length > 0 ? `
            <hr class="my-4">
            <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Recent Orders</h6>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.slice(-5).reverse().map(order => `
                            <tr>
                                <td class="order-id">${order.id}</td>
                                <td>${formatDate(order.createdAt || order.orderDate)}</td>
                                <td>${formatPrice(order.subtotal || order.total || order.totalPrice)}</td>
                                <td>${statusBadge(order.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
    `;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('customerDetailsModal'));
    modal.show();
}

/**
 * Ban a customer account with reason
 */
function banCustomer(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return;

    if (user.role === 'admin') {
        showToast('Cannot ban admin accounts.', 'error');
        return;
    }

    // Create ban reason modal if it doesn't exist
    if (!document.getElementById('banReasonModal')) {
        const modalHTML = `
            <div class="modal fade" id="banReasonModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Ban User Account</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>You are about to ban <strong id="banUserName"></strong></p>
                            <div class="mb-3">
                                <label class="form-label">Reason for ban (optional)</label>
                                <textarea class="form-control" id="banReason" rows="3" placeholder="Enter reason for banning this user..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmBanBtn">Ban User</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Populate and show modal
    document.getElementById('banUserName').textContent = user.name || user.fullName || user.email;
    document.getElementById('banReason').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('banReasonModal'));
    modal.show();

    // Handle ban confirmation
    document.getElementById('confirmBanBtn').onclick = () => {
        const reason = document.getElementById('banReason').value.trim();
        
        const userIndex = users.findIndex(u => String(u.id) === String(id));
        if (userIndex !== -1) {
            users[userIndex].isBanned = true;
            users[userIndex].bannedAt = new Date().toISOString();
            users[userIndex].bannedReason = reason || 'No reason provided';
            users[userIndex].bannedBy = getCurrentUser()?.id;
            
            saveUsers(users);
            logAdminAction('banned_user', user.name || user.fullName || user.email, id);
            renderCustomersTable();
            showToast('User account banned successfully.', 'success');
        }
        
        modal.hide();
    };
}

/**
 * Unban a customer account
 */
function unbanCustomer(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return;

    showConfirm(
        `Unban "${user.name || user.fullName || user.email}"? They will be able to access their account again.`,
        () => {
            const userIndex = users.findIndex(u => String(u.id) === String(id));
            if (userIndex !== -1) {
                users[userIndex].isBanned = false;
                users[userIndex].unbannedAt = new Date().toISOString();
                users[userIndex].unbannedBy = getCurrentUser()?.id;
                delete users[userIndex].bannedReason;
                
                saveUsers(users);
                logAdminAction('unbanned_user', user.name || user.fullName || user.email, id);
                renderCustomersTable();
                showToast('User account unbanned successfully.', 'success');
            }
        }
    );
}

/**
 * Shows confirm dialog then removes customer from ls_users.
 * Prevents deletion of admin accounts.
 */
export function confirmDeleteCustomer(id) {
    const users = getUsers();
    const customer = users.find(u => String(u.id) === String(id));
    if (!customer) return;

    // Prevent admin deletion
    if (customer.role === 'admin') {
        showToast('Cannot delete admin accounts from UI.', 'error');
        return;
    }

    const orderCount = getOrders().filter(o => String(o.customerId) === String(id)).length;
    const warning = orderCount > 0
        ? ` This customer has ${orderCount} order(s) — those orders will remain in the system.`
        : '';

    showConfirm(
        `Delete customer "${customer.name || customer.fullName || customer.email}"?${warning}`,
        () => {
            const updated = users.filter(u => String(u.id) !== String(id));
            saveUsers(updated);
            logAdminAction('deleted_user', customer.name || customer.fullName || customer.email, id);
            renderCustomersTable();
            showToast('Customer account deleted.', 'info');
        }
    );
}


// ─── RESET PASSWORD ──────────────────────────────────────────

/**
 * Opens the reset password modal for a given user id.
 * Works for both customers (ls_users) and sellers ('sellers' key).
 */
export function openResetPasswordModal(id, type) {
    document.getElementById('resetPasswordUserId').value = id;
    document.getElementById('resetPasswordUserType').value = type;
    document.getElementById('resetPasswordNew').value = '';
    document.getElementById('resetPasswordConfirm').value = '';
    const errEl = document.getElementById('resetPasswordError');
    if (errEl) errEl.textContent = '';

    new bootstrap.Modal(document.getElementById('resetPasswordModal')).show();
}

/**
 * Saves the new password for the user.
 */
export function saveResetPassword() {
    const id = document.getElementById('resetPasswordUserId').value;
    const type = document.getElementById('resetPasswordUserType').value;
    const newPass = document.getElementById('resetPasswordNew').value.trim();
    const confirm = document.getElementById('resetPasswordConfirm').value.trim();
    const errorEl = document.getElementById('resetPasswordError');

    // Validation
    if (newPass.length < 6) {
        if (errorEl) errorEl.textContent = 'Password must be at least 6 characters.';
        return;
    }
    if (newPass !== confirm) {
        if (errorEl) errorEl.textContent = 'Passwords do not match.';
        return;
    }

    // Update in the correct LS array
    let userEmail = '';
    if (type === 'customer') {
        const users = getUsers();
        const index = users.findIndex(u => String(u.id) === String(id));
        if (index === -1) return;
        userEmail = users[index].email;
        users[index].password = newPass;
        saveUsers(users);

    } else if (type === 'seller') {
        const sellers = getSellers();
        const index = sellers.findIndex(s => String(s.id) === String(id));
        if (index === -1) return;
        userEmail = sellers[index].email;
        sellers[index].password = newPass;
        saveSellers(sellers);
    }

    logAdminAction('reset_password', userEmail, id);

    const modalEl = document.getElementById('resetPasswordModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showToast('Password reset successfully.', 'success');
}

/**
 * Export users data to CSV
 */
function exportUsersData() {
    const users = getUsers();
    const csvData = [
        ['ID', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Last Login', 'Orders', 'Ban Reason']
    ];
    
    users.forEach(user => {
        const orderCount = getOrders().filter(o => String(o.customerId) === String(user.id)).length;
        csvData.push([
            user.id,
            user.name || user.fullName || '',
            user.email,
            user.role,
            user.isBanned ? 'Banned' : 'Active',
            formatDate(user.createdAt),
            user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never',
            orderCount,
            user.bannedReason || ''
        ]);
    });
    
    const csvContent = csvData.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Users data exported successfully!', 'success');
}

/**
 * Reset all user filters
 */
function resetUserFilters() {
    customerSearchQuery = '';
    customerStatusFilter = 'All';
    customerRoleFilter = 'All';
    
    const searchInput = document.getElementById('customerSearchInput');
    const statusFilter = document.getElementById('customerStatusFilter');
    const roleFilter = document.getElementById('customerRoleFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'All';
    if (roleFilter) roleFilter.value = 'All';
    
    renderCustomersTable();
}

// Global exposure
window.openResetPasswordModal = openResetPasswordModal;
window.saveResetPassword = saveResetPassword;
window.confirmDeleteCustomer = confirmDeleteCustomer;
window.confirmSuspendCustomer = confirmSuspendCustomer;
window.confirmUnsuspendCustomer = confirmUnsuspendCustomer;
window.openCustomerDetailsModal = openCustomerDetailsModal;
window.banCustomer = banCustomer;
window.unbanCustomer = unbanCustomer;
window.exportUsersData = exportUsersData;
window.resetUserFilters = resetUserFilters;
window.updateBulkActionsVisibility = updateBulkActionsVisibility;
