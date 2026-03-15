// ============================================================
// admin-sellers.js
// Sellers section — table, search, add, edit, suspend, delete.
//
// FIX: Action buttons converted to compact icon-only row.
//      saveUsers() calls replaced with updateItem() via saveSellers().
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
    escapeHTML,
    invalidateCaches,
    debounce
} from './admin-helpers.js';

import { ROLES } from '../Core/Auth.js';

let sellerSearchQuery = '';


// ─── MAIN ENTRY POINT ────────────────────────────────────────

export function renderSellers() {
    sellerSearchQuery = '';
    const searchInput = document.getElementById('sellerSearchInput');
    if (searchInput) searchInput.value = '';
    renderSellersTable();
    bindSellersEvents();
}


// ─── TABLE RENDERING ─────────────────────────────────────────

export function renderSellersTable() {
    const sellers = getSellers();
    const query   = sellerSearchQuery.toLowerCase();
    const tbody   = document.getElementById('sellersTableBody');
    if (!tbody) return;

    const filtered = sellers.filter(s =>
        (s.fullName || '').toLowerCase().includes(query) ||
        (s.storeName || '').toLowerCase().includes(query) ||
        (s.city || '').toLowerCase().includes(query)
    );

    const countEl = document.getElementById('sellersCount');
    if (countEl) {
        countEl.textContent = `${filtered.length} seller${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-content py-5">
                        <i class="bi bi-shop mb-3" style="font-size:2rem;opacity:0.4;display:block;"></i>
                        <p class="empty-title mb-1">
                            ${sellers.length === 0
                                ? 'No sellers registered yet'
                                : 'No sellers match your search'}
                        </p>
                        ${sellers.length === 0
                            ? `<button class="btn-primary-green mt-3" onclick="openAddSellerModal()">
                                <i class="bi bi-plus-lg"></i> Onboard First Seller
                               </button>`
                            : ''}
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((s, i) => {
        const isApproved  = s.isApproved !== false;
        const isSuspended = s.isSuspended || false;
        const hasStore    = s.storeName && s.storeName.trim();

        let statusBadge = '';
        let rowClass    = '';

        if (!isApproved) {
            statusBadge = `<span class="badge bg-warning text-dark ms-2 small">PENDING</span>`;
            rowClass    = 'table-warning';
        } else if (isSuspended) {
            statusBadge = `<span class="badge bg-danger ms-2 small">SUSPENDED</span>`;
            rowClass    = 'table-danger';
        } else if (!hasStore) {
            statusBadge = `<span class="badge bg-secondary ms-2 small">⚠ Incomplete Profile</span>`;
        }

        // FIX: Icon-only compact buttons in a single flex row — never stacked
        const actionButtons = `
            <div class="d-flex gap-1 justify-content-center align-items-center flex-nowrap">
                ${!isApproved ? `
                    <button class="btn-action btn-success btn-sm"
                        data-id="${s.id}" data-action="approve"
                        title="Approve Seller">
                        <i class="bi bi-check-circle"></i>
                    </button>
                    <button class="btn-action btn-delete btn-sm"
                        data-id="${s.id}" data-action="reject"
                        title="Reject Seller">
                        <i class="bi bi-x-circle"></i>
                    </button>
                ` : isSuspended ? `
                    <button class="btn-action btn-success btn-sm"
                        data-id="${s.id}" data-action="unsuspend"
                        title="Unsuspend Seller">
                        <i class="bi bi-check-circle"></i>
                    </button>
                ` : `
                    <button class="btn-action btn-warn btn-sm"
                        data-id="${s.id}" data-action="suspend"
                        title="Suspend Seller">
                        <i class="bi bi-ban"></i>
                    </button>
                `}
                ${isApproved ? `
                    <button class="btn-action btn-edit btn-sm"
                        data-id="${s.id}" data-action="edit"
                        title="Edit Seller">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-action btn-info btn-sm"
                        data-id="${s.id}" data-action="resetPassword"
                        title="Reset Password">
                        <i class="bi bi-key"></i>
                    </button>
                ` : ''}
                <button class="btn-action btn-delete btn-sm"
                    data-id="${s.id}" data-action="delete"
                    title="Delete Seller">
                    <i class="bi bi-trash"></i>
                </button>
            </div>`;

        return `
            <tr class="${rowClass}" data-seller-id="${s.id}">
                <td>${i + 1}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span class="table-avatar"
                            style="${isSuspended
                                ? 'background:linear-gradient(135deg,#ef4444,#dc2626)'
                                : 'background:linear-gradient(135deg,var(--green-primary),#10b981)'}">
                            ${(s.fullName || s.name || '?').charAt(0).toUpperCase()}
                        </span>
                        <div>
                            <div class="fw-semibold">
                                ${escapeHTML(s.fullName || s.name || '—')}${statusBadge}
                            </div>
                        </div>
                    </div>
                </td>
                <td title="${escapeHTML(s.email || '')}">${escapeHTML(s.email || '—')}</td>
                <td>${escapeHTML(s.phone || '—')}</td>
                <td>${escapeHTML(s.storeName || '—')}</td>
                <td>${escapeHTML(s.city || '—')}</td>
                <td><small class="text-muted">${escapeHTML(s.paymentMethod || '—')}</small></td>
                <td class="text-center">${actionButtons}</td>
            </tr>`;
    }).join('');
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

function bindSellersEvents() {
    const searchInput = document.getElementById('sellerSearchInput');
    if (searchInput) {
        searchInput.oninput = debounce((e) => {
            sellerSearchQuery = e.target.value;
            renderSellersTable();
        }, 300);
    }

    const tbody = document.getElementById('sellersTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn    = e.target.closest('[data-action]');
            if (!btn) return;
            const id     = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'approve')        confirmApproveSeller(id);
            if (action === 'reject')         confirmRejectSeller(id);
            if (action === 'suspend')        confirmSuspendSeller(id);
            if (action === 'unsuspend')      confirmUnsuspendSeller(id);
            if (action === 'edit')           openSellerEditModal(id);
            if (action === 'resetPassword')  window.openResetPasswordModal?.(id, 'seller');
            if (action === 'delete')         confirmDeleteSeller(id);
        };
    }
}


// ─── ADD SELLER ──────────────────────────────────────────────

export function openAddSellerModal() {
    const form = document.getElementById('addSellerForm');
    if (form) {
        form.reset();
        form.classList.remove('was-validated');
    }
    new bootstrap.Modal(document.getElementById('addSellerModal')).show();
}

export function submitAddSeller(e) {
    e.preventDefault();
    const form = document.getElementById('addSellerForm');

    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        return;
    }

    const fullName      = document.getElementById('addSellerFullName').value.trim();
    const email         = document.getElementById('addSellerEmail').value.trim().toLowerCase();
    const password      = document.getElementById('addSellerPassword').value;
    const phone         = document.getElementById('addSellerPhone').value.trim();
    const storeName     = document.getElementById('addSellerStoreName').value.trim();
    const city          = document.getElementById('addSellerCity').value.trim();
    const description   = document.getElementById('addSellerDescription').value.trim();
    const paymentMethod = document.getElementById('addSellerPayment').value;
    const preApprove    = document.getElementById('addSellerPreApprove').checked;

    const allUsers = getUsers();

    // ✅ Block duplicate email — check ALL users not just sellers
    if (allUsers.some(u => (u.email || '').toLowerCase() === email)) {
        showToast('A user with this email already exists.', 'error');
        document.getElementById('addSellerEmail')?.classList.add('is-invalid');
        return;
    }

    // ✅ Block duplicate store name — check ALL users
    if (allUsers.some(u => (u.storeName || '').toLowerCase() === storeName.toLowerCase())) {
        showToast('This store name is already taken. Please choose another.', 'error');
        document.getElementById('addSellerStoreName')?.classList.add('is-invalid');
        return;
    }

    const newSeller = {
        id:               'seller_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        fullName,
        name:             fullName,
        email,
        password,
        phone,
        role:             ROLES.SELLER,
        storeName,
        storeDescription: description,
        description,
        city,
        paymentMethod,
        isApproved:       preApprove,
        createdAt:        new Date().toISOString(),
        ...(preApprove && {
            approvedAt:          new Date().toISOString(),
            approvedBy:          getCurrentUser()?.id,
            preApprovedByAdmin:  true
        })
    };

    // ✅ Pass ONLY the new seller — never the full array
    saveUsers([newSeller]);
    invalidateCaches();

    bootstrap.Modal.getInstance(document.getElementById('addSellerModal'))?.hide();

    showToast(
        preApprove
            ? 'Seller created and pre-approved. They can login immediately.'
            : 'Seller created. Pending approval.',
        'success'
    );

    renderSellersTable();
}


// ─── APPROVE / REJECT ────────────────────────────────────────

export function confirmApproveSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    showConfirm(
        `Approve seller "${seller.fullName}" (${seller.storeName || 'No store'})? They can login and start selling.`,
        () => {
            const sellers = getSellers();
            const idx     = sellers.findIndex(s => s.id == id);
            if (idx === -1) return;

            sellers[idx].isApproved  = true;
            sellers[idx].approvedAt  = new Date().toISOString();
            sellers[idx].approvedBy  = getCurrentUser()?.id;
            saveSellers(sellers);
            renderSellersTable();
            showToast('Seller approved successfully.', 'success');
        }
    );
}

export function confirmRejectSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    showConfirm(
        `Reject seller "${seller.fullName}"? Their account will be deleted.`,
        () => {
            const updated = getSellers().filter(s => s.id != id);
            saveSellers(updated);

            const products        = getProducts();
            const updatedProducts = products.filter(p => String(p.sellerId) !== String(id));
            if (products.length !== updatedProducts.length) saveProducts(updatedProducts);

            renderSellersTable();
            showToast('Seller registration rejected.', 'error');
        }
    );
}


// ─── SUSPEND / UNSUSPEND ─────────────────────────────────────

export function confirmSuspendSeller(id) {
    const seller   = getSellers().find(s => s.id == id);
    if (!seller) return;
    const products        = getProducts();
    const sellerProducts  = products.filter(p => String(p.sellerId) === String(id));

    showConfirm(
        `Suspend "${seller.fullName}" (${seller.storeName})? They cannot login and ${sellerProducts.length} products will be hidden.`,
        () => {
            const sellers = getSellers();
            const idx     = sellers.findIndex(s => s.id == id);
            if (idx === -1) return;

            sellers[idx].isSuspended  = true;
            sellers[idx].suspendedAt  = new Date().toISOString();
            sellers[idx].suspendedBy  = getCurrentUser()?.id;
            saveSellers(sellers);

            sellerProducts.forEach(p => {
                const pIdx = products.findIndex(x => x.id === p.id);
                if (pIdx !== -1) {
                    products[pIdx].isActive           = false;
                    products[pIdx].hiddenBySuspension = true;
                }
            });
            saveProducts(products);

            renderSellersTable();
            showToast(`Seller suspended. ${sellerProducts.length} products hidden.`, 'warning');
        }
    );
}

export function confirmUnsuspendSeller(id) {
    const seller        = getSellers().find(s => s.id == id);
    if (!seller) return;
    const products      = getProducts();
    const hiddenProducts = products.filter(p =>
        String(p.sellerId) === String(id) && p.hiddenBySuspension
    );

    showConfirm(
        `Unsuspend "${seller.fullName}"? They can login again and ${hiddenProducts.length} products will be restored.`,
        () => {
            const sellers = getSellers();
            const idx     = sellers.findIndex(s => s.id == id);
            if (idx === -1) return;

            sellers[idx].isSuspended    = false;
            sellers[idx].unsuspendedAt  = new Date().toISOString();
            sellers[idx].unsuspendedBy  = getCurrentUser()?.id;
            saveSellers(sellers);

            hiddenProducts.forEach(p => {
                const pIdx = products.findIndex(x => x.id === p.id);
                if (pIdx !== -1) {
                    products[pIdx].isActive = true;
                    delete products[pIdx].hiddenBySuspension;
                }
            });
            saveProducts(products);

            renderSellersTable();
            showToast(`Seller unsuspended. ${hiddenProducts.length} products restored.`, 'success');
        }
    );
}


// ─── EDIT SELLER ─────────────────────────────────────────────

export function openSellerEditModal(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    document.getElementById('editSellerId').value          = seller.id;
    document.getElementById('editSellerFullName').value    = seller.fullName || seller.name || '';
    document.getElementById('editSellerEmail').value       = seller.email || '';
    document.getElementById('editSellerPhone').value       = seller.phone || '';
    document.getElementById('editSellerStoreName').value   = seller.storeName || '';
    document.getElementById('editSellerCity').value        = seller.city || '';
    document.getElementById('editSellerDescription').value = seller.storeDescription || seller.description || '';
    document.getElementById('editSellerPayment').value     = seller.paymentMethod || '';

    new bootstrap.Modal(document.getElementById('editSellerModal')).show();
}

export function saveSellerEdit() {
    const id          = document.getElementById('editSellerId').value;
    const sellers     = getSellers();
    const index       = sellers.findIndex(s => s.id == id);
    if (index === -1) return;

    const newStoreName = document.getElementById('editSellerStoreName').value.trim();

    const storeExists = getUsers().some(u =>
        u.role === ROLES.SELLER &&
        u.id   !== id &&
        (u.storeName || '').toLowerCase() === newStoreName.toLowerCase()
    );
    if (storeExists) {
        showToast('Store name is already taken by another seller.', 'error');
        return;
    }

    const fullName = document.getElementById('editSellerFullName').value.trim();
    sellers[index] = {
        ...sellers[index],
        fullName,
        name:             fullName,
        email:            document.getElementById('editSellerEmail').value.trim(),
        phone:            document.getElementById('editSellerPhone').value.trim(),
        storeName:        newStoreName,
        city:             document.getElementById('editSellerCity').value.trim(),
        description:      document.getElementById('editSellerDescription').value.trim(),
        storeDescription: document.getElementById('editSellerDescription').value.trim(),
        paymentMethod:    document.getElementById('editSellerPayment').value,
    };

    saveSellers(sellers);
    invalidateCaches();

    bootstrap.Modal.getInstance(document.getElementById('editSellerModal'))?.hide();
    renderSellersTable();
    showToast('Seller updated successfully.', 'success');
}


// ─── DELETE SELLER ───────────────────────────────────────────

export function confirmDeleteSeller(id) {
    const seller = getSellers().find(s => s.id == id);
    if (!seller) return;

    showConfirm(
        `Delete seller "${seller.fullName}" (${seller.storeName || 'No store'})? This cannot be undone.`,
        () => {
            const updated = getSellers().filter(s => s.id != id);
            saveSellers(updated);
            invalidateCaches();

            const products        = getProducts();
            const updatedProducts = products.filter(p => String(p.sellerId) !== String(id));
            if (products.length !== updatedProducts.length) saveProducts(updatedProducts);

            renderSellersTable();
            showToast('Seller and their products deleted.', 'error');
        }
    );
}


// ─── GLOBAL EXPOSURE ─────────────────────────────────────────

window.openAddSellerModal      = openAddSellerModal;
window.saveSellerEdit          = saveSellerEdit;
window.confirmDeleteSeller     = confirmDeleteSeller;
window.openSellerEditModal     = openSellerEditModal;
window.openEditSellerModal     = openSellerEditModal; // alias
window.confirmApproveSeller    = confirmApproveSeller;
window.confirmRejectSeller     = confirmRejectSeller;
window.confirmSuspendSeller    = confirmSuspendSeller;
window.confirmUnsuspendSeller  = confirmUnsuspendSeller;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addSellerForm')
        ?.addEventListener('submit', submitAddSeller);
});
