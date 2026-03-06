// ============================================================
// admin-sellers.js
// Handles the Sellers section — table, search, edit, delete.
// Depends on: admin-helpers.js
// ============================================================

import {
    getSellers,
    saveSellers,
    showToast,
    showConfirm
} from '../Admin/admin-helpers.js';

// Current search filter value — kept outside function so it persists
// while the user stays on the sellers section
let sellerSearchQuery = '';


/**
 * Main entry point for the sellers section.
 * Called every time the user clicks "Sellers" in the sidebar.
 */
export function renderSellers() {
    sellerSearchQuery = '';
    const searchInput = document.getElementById('sellerSearchInput');
    if (searchInput) searchInput.value = '';
    renderSellersTable();
    bindSellersEvents();
}


// ─── TABLE RENDERING ─────────────────────────────────────────

/**
 * Renders the sellers table, filtered by the current search query.
 * Called on initial load AND every time the search input changes.
 */
export function renderSellersTable() {
    const sellers = getSellers();
    const query = sellerSearchQuery.toLowerCase();
    const tbody = document.getElementById('sellersTableBody');

    if (!tbody) return;

    // Filter sellers by name, store, or city
    const filtered = sellers.filter(s =>
        (s.fullName || '').toLowerCase().includes(query) ||
        (s.storeName || '').toLowerCase().includes(query) ||
        (s.city || '').toLowerCase().includes(query)
    );

    // Update count label
    const countEl = document.getElementById('sellersCount');
    if (countEl) {
        countEl.textContent = `${filtered.length} seller${filtered.length !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    ${sellers.length === 0
                ? 'No sellers registered yet. <a href="/Html/Admin/AddSeller.html">Add one now.</a>'
                : 'No sellers match your search.'}
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${s.fullName}</td>
            <td>${s.email}</td>
            <td>${s.phone}</td>
            <td>${s.storeName}</td>
            <td>${s.city}</td>
            <td>${s.paymentMethod}</td>
            <td class="actions-col text-center">
                <div class="d-flex gap-2 justify-content-center">
                    <button class="btn-action btn-edit"
                            data-id="${s.id}" data-action="edit">Edit</button>
                    <button class="btn-action btn-warn"
                            data-id="${s.id}" data-action="resetPassword">Reset Password</button>
                    <button class="btn-action btn-delete"
                            data-id="${s.id}" data-action="delete">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

/**
 * Binds all events for the sellers section.
 * Uses event delegation on the table — one listener handles all rows.
 * Called once when the section loads.
 */
function bindSellersEvents() {
    // Search input — filter table on every keystroke
    const searchInput = document.getElementById('sellerSearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            sellerSearchQuery = e.target.value;
            renderSellersTable();
        };
    }

    // Table action buttons (Edit / Delete) via event delegation
    const tbody = document.getElementById('sellersTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'edit') openSellerEditModal(id);
            if (action === 'resetPassword') {
                if (window.openResetPasswordModal) {
                    window.openResetPasswordModal(id, 'seller');
                } else {
                    console.error('Reset Password module not loaded yet.');
                }
            }
            if (action === 'delete') confirmDeleteSeller(id);
        };
    }
}


// ─── EDIT SELLER ─────────────────────────────────────────────

/**
 * Opens the edit modal and fills it with the seller's current data.
 * @param {string|number} id - seller.id
 */
export function openSellerEditModal(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    // Fill modal fields
    document.getElementById('editSellerId').value = seller.id;
    document.getElementById('editSellerFullName').value = seller.fullName;
    document.getElementById('editSellerEmail').value = seller.email;
    document.getElementById('editSellerPhone').value = seller.phone || '';
    document.getElementById('editSellerStoreName').value = seller.storeName;
    document.getElementById('editSellerCity').value = seller.city;
    document.getElementById('editSellerDescription').value = seller.description || '';
    document.getElementById('editSellerPayment').value = seller.paymentMethod;

    new bootstrap.Modal(document.getElementById('editSellerModal')).show();
}

/**
 * Saves the edited seller data from the modal back to localStorage.
 * Called by the "Save Changes" button inside the edit modal.
 */
export function saveSellerEdit() {
    const id = document.getElementById('editSellerId').value;
    const sellers = getSellers();
    const index = sellers.findIndex(s => s.id == id);
    if (index === -1) return;

    // Merge updated fields into existing seller object
    sellers[index] = {
        ...sellers[index],
        fullName: document.getElementById('editSellerFullName').value.trim(),
        email: document.getElementById('editSellerEmail').value.trim(),
        phone: document.getElementById('editSellerPhone').value.trim(),
        storeName: document.getElementById('editSellerStoreName').value.trim(),
        city: document.getElementById('editSellerCity').value.trim(),
        description: document.getElementById('editSellerDescription').value.trim(),
        paymentMethod: document.getElementById('editSellerPayment').value,
    };

    saveSellers(sellers);
    const modalEl = document.getElementById('editSellerModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    renderSellersTable();
    showToast('Seller updated successfully.', 'success');
}


// ─── DELETE SELLER ───────────────────────────────────────────

/**
 * Shows a confirm dialog then deletes the seller from localStorage.
 * @param {string|number} id - seller.id
 */
export function confirmDeleteSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    showConfirm(
        `Are you sure you want to delete seller "${seller.fullName}" (${seller.storeName})?`,
        () => {
            const updated = getSellers().filter(s => s.id != id);
            saveSellers(updated);
            renderSellersTable();
            showToast('Seller deleted.', 'error');
        }
    );
}

// Global exposure for non-module integration (modals)
window.saveSellerEdit = saveSellerEdit;
window.confirmDeleteSeller = confirmDeleteSeller;
window.openSellerEditModal = openSellerEditModal;
