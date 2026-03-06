// ============================================================
// admin-customers.js
// Handles the Customers section — view, delete, reset password.
// Covers the requirement: "Manage user accounts (remove, reset password)"
// Depends on: admin-helpers.js
// ============================================================

import {
    getUsers,
    saveUsers,
    getOrders,
    getSellers,
    saveSellers,
    formatDate,
    showConfirm,
    showToast
} from '../Admin/admin-helpers.js';

import { ROLES } from '../Core/Auth.js';

// Current search filter
let customerSearchQuery = '';


/**
 * Main entry point for the customers section.
 * Called every time the user clicks "Customers" in the sidebar.
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
 * Called on load and on every search keystroke.
 */
export function renderCustomersTable() {
    // Read all users and keep only customers
    const allUsers = getUsers();
    const customers = allUsers.filter(u => u.role === ROLES.CUSTOMER);
    const query = customerSearchQuery.toLowerCase();
    const tbody = document.getElementById('customersTableBody');

    if (!tbody) return;

    // Filter by search query — name or email
    const filtered = customers.filter(c => {
        const name = (c.name || c.fullName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        return name.includes(query) || email.includes(query);
    });

    // Update count label
    const countEl = document.getElementById('customersCount');
    if (countEl) {
        countEl.textContent = `${filtered.length} customer${filtered.length !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    ${customers.length === 0
                ? 'No customers registered yet.'
                : 'No customers match your search.'}
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((c, i) => `
        <tr>
            <td><span class="text-muted small fw-bold">${i + 1}</span></td>
            <td>
                <div class="fw-bold">${c.name || c.fullName || '—'}</div>
            </td>
            <td>${c.email}</td>
            <td>${formatDate(c.createdAt)}</td>
            <td>${getCustomerOrderCount(c.id)}</td>
            <td class="text-center">
                <div class="d-flex gap-2 justify-content-center">
                    <button class="btn-action btn-info" title="Reset Password"
                            data-id="${c.id}" data-action="resetPassword">
                        <i class="bi bi-key"></i>
                    </button>
                    <button class="btn-action btn-delete" title="Delete"
                            data-id="${c.id}" data-action="delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

/**
 * Binds search input and table button events.
 * Uses event delegation on tbody — one listener handles all rows.
 */
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

            if (action === 'resetPassword') openResetPasswordModal(id, 'customer');
            if (action === 'delete') confirmDeleteCustomer(id);
        };
    }
}


// ─── HELPERS ─────────────────────────────────────────────────

/**
 * Returns how many orders a customer has placed.
 * Shown in the customers table as a quick reference.
 * @param {string} customerId
 */
export function getCustomerOrderCount(customerId) {
    const count = getOrders().filter(o => String(o.customerId) === String(customerId)).length;
    return count === 0
        ? '<span class="text-muted small">0 orders</span>'
        : `<span class="badge" style="background:var(--green-light-bg); color:var(--green-dark)">${count} order${count !== 1 ? 's' : ''}</span>`;
}


// ─── DELETE CUSTOMER ─────────────────────────────────────────

/**
 * Shows confirm dialog then removes customer from ls_users.
 * Their orders remain in ls_orders — we don't delete order history.
 * @param {string} id - customer id
 */
export function confirmDeleteCustomer(id) {
    const users = getUsers();
    const customer = users.find(u => String(u.id) === String(id));
    if (!customer) return;

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
            // Refresh dashboard KPIs to reflect new count if visible
            const dashboardEl = document.getElementById('dashboardSection');
            if (dashboardEl && dashboardEl.style.display !== 'none') {
                import('./admin-dashboard.js').then(m => m.renderDashboard());
            }
            showToast('Customer account deleted.', 'info');
        }
    );
}


// ─── RESET PASSWORD ──────────────────────────────────────────

/**
 * Opens the reset password modal for a given user id.
 * Works for both customers (ls_users) and sellers ('sellers' key).
 * @param {string} id   - user id
 * @param {'customer'|'seller'} type - which LS key to update
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
 * Reads userId and userType from hidden fields in the modal.
 * Called by the "Save" button inside the reset password modal.
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
