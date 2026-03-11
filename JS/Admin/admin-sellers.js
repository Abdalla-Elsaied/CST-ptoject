// ============================================================
// admin-sellers.js
// Handles the Sellers section — table, search, edit, delete.
// Depends on: admin-helpers.js
// ============================================================

import {
    getSellers,
    saveSellers,
    getCurrentUser,
    getProducts,
    saveProducts,
    getUsers,
    saveUsers,
    showToast,
    showConfirm,
    escapeHTML
} from '../Admin/admin-helpers.js';

import { ROLES } from '../Core/Auth.js';

// Current search filter value
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
                <td colspan="9" class="empty-state">
                    ${sellers.length === 0
                ? 'No sellers registered yet. Use the button above to onboard a new vendor.'
                : 'No sellers match your search.'}
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((s, i) => {
        const isApproved = s.isApproved !== false; // default true for backward compatibility
        const isSuspended = s.isSuspended || false;

        let statusBadge = '';
        let rowClass = '';

        if (!isApproved) {
            statusBadge = '<span class="badge bg-warning text-dark ms-2">PENDING APPROVAL</span>';
            rowClass = 'table-warning';
        } else if (isSuspended) {
            statusBadge = '<span class="badge bg-danger ms-2">SUSPENDED</span>';
            rowClass = 'table-danger';
        }

        return `
        <tr class="${rowClass}">
            <td>${i + 1}</td>
            <td>${escapeHTML(s.fullName)}${statusBadge}</td>
            <td>${escapeHTML(s.email)}</td>
            <td>${escapeHTML(s.phone)}</td>
            <td>${escapeHTML(s.storeName)}</td>
            <td>${escapeHTML(s.city)}</td>
            <td>${escapeHTML(s.paymentMethod)}</td>
            <td class="actions-col text-center">
                <div class="d-flex gap-2 justify-content-center flex-wrap">
                    ${!isApproved
                ? `<button class="btn-action btn-success" title="Approve"
                                data-id="${s.id}" data-action="approve">
                            <i class="bi bi-check-circle"></i> Approve
                        </button>
                        <button class="btn-action btn-delete" title="Reject"
                                data-id="${s.id}" data-action="reject">
                            <i class="bi bi-x-circle"></i> Reject
                        </button>`
                : isSuspended
                    ? `<button class="btn-action btn-success" title="Unsuspend"
                                data-id="${s.id}" data-action="unsuspend">
                            <i class="bi bi-check-circle"></i> Unsuspend
                        </button>`
                    : `<button class="btn-action btn-warn" title="Suspend"
                                data-id="${s.id}" data-action="suspend">
                            <i class="bi bi-ban"></i> Suspend
                        </button>
                        <button class="btn-action btn-edit"
                                data-id="${s.id}" data-action="edit">Edit</button>`
            }
                    ${isApproved
                ? `<button class="btn-action btn-warn"
                                data-id="${s.id}" data-action="resetPassword">Reset Password</button>`
                : ''
            }
                    <button class="btn-action btn-delete"
                            data-id="${s.id}" data-action="delete">Delete</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

/**
 * Binds all events for the sellers section.
 */
function bindSellersEvents() {
    // Search input
    const searchInput = document.getElementById('sellerSearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            sellerSearchQuery = e.target.value;
            renderSellersTable();
        };
    }

    // Table action buttons via event delegation
    const tbody = document.getElementById('sellersTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'approve') confirmApproveSeller(id);
            if (action === 'reject') confirmRejectSeller(id);
            if (action === 'suspend') confirmSuspendSeller(id);
            if (action === 'unsuspend') confirmUnsuspendSeller(id);
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


// ─── ADD SELLER ──────────────────────────────────────────────

/**
 * Opens the Add Seller modal with empty form.
 */
export function openAddSellerModal() {
    // Reset form
    const form = document.getElementById('addSellerForm');
    if (form) {
        form.reset();
        form.classList.remove('was-validated');
    }

    // Clear all fields
    document.getElementById('addSellerFullName').value = '';
    document.getElementById('addSellerEmail').value = '';
    document.getElementById('addSellerPassword').value = '';
    document.getElementById('addSellerPhone').value = '';
    document.getElementById('addSellerStoreName').value = '';
    document.getElementById('addSellerCity').value = '';
    document.getElementById('addSellerDescription').value = '';
    document.getElementById('addSellerPayment').value = '';

    // Show modal
    new bootstrap.Modal(document.getElementById('addSellerModal')).show();
}

/**
 * Handles Add Seller form submission.
 */
export function submitAddSeller(e) {
    e.preventDefault();

    const form = document.getElementById('addSellerForm');

    // Validate form
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        return;
    }

    // Get form values
    const fullName = document.getElementById('addSellerFullName').value.trim();
    const email = document.getElementById('addSellerEmail').value.trim().toLowerCase();
    const password = document.getElementById('addSellerPassword').value;
    const phone = document.getElementById('addSellerPhone').value.trim();
    const storeName = document.getElementById('addSellerStoreName').value.trim();
    const city = document.getElementById('addSellerCity').value.trim();
    const description = document.getElementById('addSellerDescription').value.trim();
    const paymentMethod = document.getElementById('addSellerPayment').value;

    // Check for duplicate email
    const allUsers = getUsers();
    const emailExists = allUsers.some(u => (u.email || '').toLowerCase() === email);
    if (emailExists) {
        showToast('Email already exists. Please use a different email.', 'error');
        return;
    }

    // Check for duplicate store name
    const storeExists = allUsers.some(u => (u.storeName || '').toLowerCase() === storeName.toLowerCase());
    if (storeExists) {
        showToast('Store name is already taken. Please choose another.', 'error');
        return;
    }

    // Create seller object
    const sellerId = 'seller_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    const newSeller = {
        id: sellerId,
        fullName: fullName,
        name: fullName,
        email: email,
        password: password,
        phone: phone,
        role: ROLES.SELLER,
        storeName: storeName,
        storeDescription: description,
        description: description,
        city: city,
        paymentMethod: paymentMethod,
        isApproved: false,  // Requires admin approval
        createdAt: new Date().toISOString()
    };

    // Add to users array
    allUsers.push(newSeller);
    saveUsers(allUsers);

    // Close modal
    const modalEl = document.getElementById('addSellerModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Show success message
    showToast('Seller account created successfully. Pending admin approval.', 'success');

    // Refresh table
    renderSellersTable();

    console.log(`[AUDIT] New seller ${email} created - pending approval`);
}


// ─── APPROVE / REJECT SELLER ─────────────────────────────────

/**
 * Approves a seller registration - allows them to login and sell.
 */
export function confirmApproveSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    showConfirm(
        `Approve seller "${seller.fullName}" (${seller.storeName})? They will be able to login and start selling.`,
        () => {
            const sellers = getSellers();
            const index = sellers.findIndex(s => s.id == id);
            if (index === -1) return;

            sellers[index].isApproved = true;
            sellers[index].approvedAt = new Date().toISOString();
            sellers[index].approvedBy = getCurrentUser()?.id;
            saveSellers(sellers);
            renderSellersTable();

            console.log(`[AUDIT] Seller ${seller.email} approved by admin`);
            showToast('Seller approved successfully.', 'success');
        }
    );
}

/**
 * Rejects a seller registration - deletes their account.
 */
export function confirmRejectSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    showConfirm(
        `Reject seller "${seller.fullName}" (${seller.storeName})? Their account will be deleted.`,
        () => {
            const updated = getSellers().filter(s => s.id != id);
            saveSellers(updated);

            // Delete any products they might have created
            const products = getProducts();
            const updatedProducts = products.filter(p => String(p.sellerId) !== String(id));
            if (products.length !== updatedProducts.length) {
                saveProducts(updatedProducts);
            }

            renderSellersTable();

            console.log(`[AUDIT] Seller ${seller.email} rejected and deleted by admin`);
            showToast('Seller registration rejected.', 'error');
        }
    );
}


// ─── SUSPEND / UNSUSPEND SELLER ──────────────────────────────

/**
 * Suspends a seller - blocks login and hides ALL their products.
 */
export function confirmSuspendSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    const products = getProducts();
    const sellerProducts = products.filter(p => String(p.sellerId) === String(id));

    showConfirm(
        `Suspend seller "${seller.fullName}" (${seller.storeName})? They will not be able to login and all ${sellerProducts.length} of their products will be hidden.`,
        () => {
            const sellers = getSellers();
            const index = sellers.findIndex(s => s.id == id);
            if (index === -1) return;

            // Suspend seller
            sellers[index].isSuspended = true;
            sellers[index].suspendedAt = new Date().toISOString();
            sellers[index].suspendedBy = getCurrentUser()?.id;
            saveSellers(sellers);

            // Hide all seller's products
            sellerProducts.forEach(p => {
                const pIndex = products.findIndex(prod => prod.id === p.id);
                if (pIndex !== -1) {
                    products[pIndex].isActive = false;
                    products[pIndex].hiddenBySuspension = true;
                }
            });
            saveProducts(products);

            renderSellersTable();

            console.log(`[AUDIT] Seller ${seller.email} suspended by admin - ${sellerProducts.length} products hidden`);
            showToast(`Seller suspended. ${sellerProducts.length} products hidden.`, 'warning');
        }
    );
}

/**
 * Unsuspends a seller - allows login and restores their products.
 */
export function confirmUnsuspendSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    const products = getProducts();
    const hiddenProducts = products.filter(p =>
        String(p.sellerId) === String(id) && p.hiddenBySuspension
    );

    showConfirm(
        `Unsuspend seller "${seller.fullName}" (${seller.storeName})? They will be able to login again and ${hiddenProducts.length} products will be restored.`,
        () => {
            const sellers = getSellers();
            const index = sellers.findIndex(s => s.id == id);
            if (index === -1) return;

            // Unsuspend seller
            sellers[index].isSuspended = false;
            sellers[index].unsuspendedAt = new Date().toISOString();
            sellers[index].unsuspendedBy = getCurrentUser()?.id;
            saveSellers(sellers);

            // Restore products that were hidden by suspension
            hiddenProducts.forEach(p => {
                const pIndex = products.findIndex(prod => prod.id === p.id);
                if (pIndex !== -1) {
                    products[pIndex].isActive = true;
                    delete products[pIndex].hiddenBySuspension;
                }
            });
            saveProducts(products);

            renderSellersTable();

            console.log(`[AUDIT] Seller ${seller.email} unsuspended by admin - ${hiddenProducts.length} products restored`);
            showToast(`Seller unsuspended. ${hiddenProducts.length} products restored.`, 'success');
        }
    );
}


// ─── EDIT SELLER ─────────────────────────────────────────────

/**
 * Opens the edit modal and fills it with the seller's current data.
 */
export function openSellerEditModal(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

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
 * Saves the edited seller data from the modal.
 */
export function saveSellerEdit() {
    const id = document.getElementById('editSellerId').value;
    const sellers = getSellers();
    const index = sellers.findIndex(s => s.id == id);
    if (index === -1) return;

    const newStoreName = document.getElementById('editSellerStoreName').value.trim();
    // Check store name uniqueness (excluding current seller)
    const storeExists = getUsers().some(u =>
        u.role === ROLES.SELLER &&
        u.id !== id &&
        (u.storeName || '').toLowerCase() === newStoreName.toLowerCase()
    );
    if (storeExists) {
        showToast('Store name is already taken by another seller.', 'error');
        return;
    }

    sellers[index] = {
        ...sellers[index],
        fullName: document.getElementById('editSellerFullName').value.trim(),
        name: document.getElementById('editSellerFullName').value.trim(),
        email: document.getElementById('editSellerEmail').value.trim(),
        phone: document.getElementById('editSellerPhone').value.trim(),
        storeName: newStoreName,
        city: document.getElementById('editSellerCity').value.trim(),
        description: document.getElementById('editSellerDescription').value.trim(),
        storeDescription: document.getElementById('editSellerDescription').value.trim(),
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
 * Shows a confirm dialog then deletes the seller.
 */
export function confirmDeleteSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    showConfirm(
        `Are you sure you want to delete seller "${seller.fullName}" (${seller.storeName})?`,
        () => {
            const updated = getSellers().filter(s => s.id != id);
            saveSellers(updated);

            // Delete all their products to prevent dangling active items
            const products = getProducts();
            const updatedProducts = products.filter(p => String(p.sellerId) !== String(id));
            if (products.length !== updatedProducts.length) {
                saveProducts(updatedProducts);
            }

            renderSellersTable();
            showToast('Seller and their products deleted.', 'error');
        }
    );
}

// Global exposure
window.openAddSellerModal = openAddSellerModal;
window.saveSellerEdit = saveSellerEdit;
window.confirmDeleteSeller = confirmDeleteSeller;
window.openSellerEditModal = openSellerEditModal;
window.confirmApproveSeller = confirmApproveSeller;
window.confirmRejectSeller = confirmRejectSeller;
window.confirmSuspendSeller = confirmSuspendSeller;
window.confirmUnsuspendSeller = confirmUnsuspendSeller;

// Bind Add Seller form submission
document.addEventListener('DOMContentLoaded', () => {
    const addSellerForm = document.getElementById('addSellerForm');
    if (addSellerForm) {
        addSellerForm.addEventListener('submit', submitAddSeller);
    }
});
