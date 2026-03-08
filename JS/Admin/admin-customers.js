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
    showConfirm,
    showToast,
    escapeHTML
} from '../Admin/admin-helpers.js';

import { getLS } from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';

// Current search filter
let customerSearchQuery = '';


/**
 * Main entry point for the customers section.
 */
export function renderCustomers() {
    customerSearchQuery = '';
    const searchInput = document.getElementById('customerSearchInput');
    if (searchInput) searchInput.value = '';
    renderCustomersTable();
    bindCustomersEvents();
}


// ─── TABLE RENDERING ─────────────────────────────────────────

/**
 * Renders the customers table from ls_users filtered by role='customer'.
 * Also shows sellers so admin can manage all users and change roles.
 */
export function renderCustomersTable() {
    const allUsers = getUsers();
    // Show all valid users so we can see admins (admins have protected UI state)
    const users = allUsers.filter(u => u.role === ROLES.CUSTOMER || u.role === ROLES.SELLER || u.role === 'admin');
    const query = customerSearchQuery.toLowerCase();
    const tbody = document.getElementById('customersTableBody');

    if (!tbody) return;

    // Filter by search query
    const filtered = users.filter(c => {
        const name = (c.name || c.fullName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const role = (c.role || '').toLowerCase();
        return name.includes(query) || email.includes(query) || role.includes(query);
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
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    ${users.length === 0
                ? 'No users registered yet.'
                : 'No users match your search.'}
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((c, i) => {
        const isSuspended = c.isSuspended || false;
        const isAdmin = c.role === 'admin';
        const isSeller = c.role === ROLES.SELLER;
        const isCustomer = c.role === ROLES.CUSTOMER;

        const suspendBadge = isSuspended
            ? '<span class="badge bg-danger ms-2">SUSPENDED</span>'
            : '';
        const adminBadge = isAdmin
            ? '<span class="badge bg-dark ms-2">ADMIN</span>'
            : '';
        const roleBadge = isSeller
            ? '<span class="badge bg-info ms-2">SELLER</span>'
            : '';

        return `
        <tr class="${isSuspended ? 'table-danger' : isAdmin ? 'table-info' : ''}">
            <td><span class="text-muted small fw-bold">${i + 1}</span></td>
            <td>
                <div class="fw-bold">${escapeHTML(c.name || c.fullName)}${suspendBadge}${adminBadge}${roleBadge}</div>
            </td>
            <td>${escapeHTML(c.email)}</td>
            <td>
                ${isAdmin
                ? '<span class="badge bg-dark">Admin</span>'
                : isSeller
                    ? '<span class="badge bg-info">Seller</span>'
                    : '<span class="badge bg-secondary">Customer</span>'
            }
            </td>
            <td>${formatDate(c.createdAt)}</td>
            <td>${getCustomerOrderCount(c.id)}</td>
            <td class="text-center">
                ${isAdmin
                ? '<span class="text-muted small">Protected Account</span>'
                : `<div class="d-flex gap-2 justify-content-center flex-wrap">
                        ${isSuspended
                    ? `<button class="btn-action btn-success" title="Unsuspend"
                                    data-id="${c.id}" data-action="unsuspend">
                                <i class="bi bi-check-circle"></i> Unsuspend
                            </button>`
                    : `<button class="btn-action btn-warn" title="Suspend"
                                    data-id="${c.id}" data-action="suspend">
                                <i class="bi bi-ban"></i> Suspend
                            </button>`
                }
                        ${isSeller
                    ? `<button class="btn-action btn-info" title="Change to Customer"
                                    data-id="${c.id}" data-action="changeToCustomer">
                                <i class="bi bi-arrow-left-right"></i> To Customer
                            </button>`
                    : isCustomer
                        ? `<button class="btn-action btn-info" title="Change to Seller"
                                    data-id="${c.id}" data-action="changeToSeller">
                                <i class="bi bi-arrow-left-right"></i> To Seller
                            </button>`
                        : ''
                }
                        <button class="btn-action btn-info" title="Reset Password"
                                data-id="${c.id}" data-action="resetPassword">
                            <i class="bi bi-key"></i>
                        </button>
                        <button class="btn-action btn-delete" title="Delete"
                                data-id="${c.id}" data-action="delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>`
            }
            </td>
        </tr>
    `;
    }).join('');
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

function bindCustomersEvents() {
    const searchInput = document.getElementById('customerSearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            customerSearchQuery = e.target.value;
            renderCustomersTable();
        };
    }

    const tbody = document.getElementById('customersTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'suspend') confirmSuspendCustomer(id);
            if (action === 'unsuspend') confirmUnsuspendCustomer(id);
            if (action === 'changeToCustomer') confirmChangeToCustomer(id);
            if (action === 'changeToSeller') confirmChangeToSeller(id);
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


// ─── DELETE CUSTOMER ─────────────────────────────────────────

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
    if (type === 'customer') {
        const users = getUsers();
        const index = users.findIndex(u => String(u.id) === String(id));
        if (index === -1) return;
        users[index].password = newPass;
        saveUsers(users);

    } else if (type === 'seller') {
        const sellers = getSellers();
        const index = sellers.findIndex(s => String(s.id) === String(id));
        if (index === -1) return;
        sellers[index].password = newPass;
        saveSellers(sellers);
    }

    const modalEl = document.getElementById('resetPasswordModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showToast('Password reset successfully.', 'success');
}

// Global exposure
window.openResetPasswordModal = openResetPasswordModal;
window.saveResetPassword = saveResetPassword;
window.confirmDeleteCustomer = confirmDeleteCustomer;
window.confirmSuspendCustomer = confirmSuspendCustomer;
window.confirmUnsuspendCustomer = confirmUnsuspendCustomer;
