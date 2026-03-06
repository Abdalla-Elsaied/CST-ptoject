
import { KEY_USERS } from '../Core/Constants.js';   
import { getLS, updateItem, deleteItem } from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';

function getSellers() {
    const users = getLS(KEY_USERS) || [];
    return users.filter(user => user.role === ROLES.SELLER);
}

// Helper: update a single seller in the users array
function updateSeller(id, updates) {
    updateItem(KEY_USERS, id, updates);
}

// Helper: delete a seller from users array
function deleteSellerById(id) {
    deleteItem(KEY_USERS, id);
}

// Get initials from name
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}

// Truncate text
function truncate(text, maxLen) {
    if (!text) return '—';
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

// Update KPI cards
function updateKPIs() {
    const sellers = getSellers();

    // Total sellers
    const totalEl = document.getElementById('kpiTotalSellers');
    if (totalEl) totalEl.textContent = sellers.length;

    // Total stores (unique store names)
    const storesEl = document.getElementById('kpiTotalStores');
    if (storesEl) {
        const uniqueStores = new Set(sellers.map(s => s.storeName).filter(Boolean));
        storesEl.textContent = uniqueStores.size;
    }

    // Cities covered
    const citiesEl = document.getElementById('kpiCities');
    if (citiesEl) {
        const uniqueCities = new Set(sellers.map(s => s.city).filter(Boolean));
        citiesEl.textContent = uniqueCities.size;
    }

    // Payment methods used
    const paymentsEl = document.getElementById('kpiPayments');
    if (paymentsEl) {
        const uniquePayments = new Set(sellers.map(s => s.paymentMethod).filter(Boolean));
        paymentsEl.textContent = uniquePayments.size;
    }
}

// Populate filter dropdowns dynamically
function populateFilters() {
    const sellers = getSellers();

    // City filter
    const citySelect = document.getElementById('filterCity');
    if (citySelect) {
        const cities = [...new Set(sellers.map(s => s.city).filter(Boolean))].sort();
        citySelect.innerHTML = '<option value="">All Cities</option>';
        cities.forEach(city => {
            citySelect.innerHTML += `<option value="${city}">${city}</option>`;
        });
    }

    // Payment method filter
    const paymentSelect = document.getElementById('filterPayment');
    if (paymentSelect) {
        const methods = [...new Set(sellers.map(s => s.paymentMethod).filter(Boolean))].sort();
        paymentSelect.innerHTML = '<option value="">All Payment Methods</option>';
        methods.forEach(method => {
            paymentSelect.innerHTML += `<option value="${method}">${method}</option>`;
        });
    }
}

// Render the sellers table
function renderTable() {
    const sellers = getSellers();
    const tbody = document.getElementById('sellersBody');
    const countEl = document.getElementById('sellerCount');
    if (!tbody) return;

    tbody.innerHTML = '';  // clear previous rows

    // Read current filter values
    const nameFilter   = (document.getElementById('filterName')?.value || '').toLowerCase();
    const cityFilter   = document.getElementById('filterCity')?.value || '';
    const paymentFilter = document.getElementById('filterPayment')?.value || '';

    const filtered = sellers.filter(seller => {
        const matchName = !nameFilter ||
            (seller.name        && seller.name.toLowerCase().includes(nameFilter)) ||
            (seller.email       && seller.email.toLowerCase().includes(nameFilter)) ||
            (seller.storeName   && seller.storeName.toLowerCase().includes(nameFilter));
        const matchCity    = !cityFilter   || seller.city === cityFilter;
        const matchPayment = !paymentFilter || seller.paymentMethod === paymentFilter;
        return matchName && matchCity && matchPayment;
    });

    // Update count
    if (countEl) {
        countEl.textContent = `${filtered.length} vendor${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        const hasFilters = nameFilter || cityFilter || paymentFilter;
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-icon">${hasFilters ? '<i class="bi bi-search"></i>' : '<i class="bi bi-people"></i>'}</div>
                    <p>${hasFilters
                        ? 'No vendors match the applied filters.'
                        : 'No vendors have been registered yet.'}</p>
                    ${hasFilters
                        ? '<button class="btn-reset-filters" onclick="resetAllFilters()"><i class="bi bi-x-lg"></i> Clear Filters</button>'
                        : '<a href="/Html/Admin/AddSeller.html"><i class="bi bi-plus-lg"></i> Onboard your first vendor</a>'}
                </td>
            </tr>`;
        return;
    }

    // ────────────────────────────────────────────────
    // Create rows + attach listeners dynamically
    // ────────────────────────────────────────────────
    filtered.forEach((seller, index) => {
        const initials = getInitials(seller.name || '');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span style="color: var(--text-muted); font-size: 12px; font-weight: 600;">
                    ${index + 1}
                </span>
            </td>
            <td class="text-start">
                <div class="table-user-cell">
                    <div class="table-avatar">${initials}</div>
                    <div>
                        <div class="user-name">${seller.name || '—'}</div>
                        <div class="user-email">${seller.email || '—'}</div>
                    </div>
                </div>
            </td>
            <td>${seller.phone || '—'}</td>
            <td>
                <span style="font-weight:600;">${seller.storeName || '—'}</span>
            </td>
            <td>
                <span class="stock-badge stock-ok">${seller.city || '—'}</span>
            </td>
            <td>
                <span class="status-badge status-active">${seller.paymentMethod || '—'}</span>
            </td>
            <td>
                <div class="actions-col">
                    <button class="btn-action btn-edit" title="Edit">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn-action btn-delete" title="Delete">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;

        // ─── Find the buttons we just created ───────────────────────────────
        const editBtn   = tr.querySelector('.btn-edit');
        const deleteBtn = tr.querySelector('.btn-delete');

        // ─── Attach click listeners ─────────────────────────────────────────
        if (editBtn) {
            editBtn.addEventListener('click', () => openUpdate(seller.id));
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                confirmDelete(seller.id, seller.name || 'this vendor');
            });
        }

        tbody.appendChild(tr);
    });
}

// ── Delete logic ────────────────────────────────────────────────────────────────

let pendingDeleteId = null;

function confirmDelete(id, name) {
    pendingDeleteId = id;
    const nameEl = document.getElementById('deleteSellerName');
    if (nameEl) nameEl.textContent = name || 'this vendor';
    new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

function executeDelete() {
    if (!pendingDeleteId) return;

    deleteSellerById(pendingDeleteId);

    pendingDeleteId = null;
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();

    showToast('Vendor record deleted successfully.', 'success');
    refreshAll();
}

// ── Update modal ────────────────────────────────────────────────────────────────

function openUpdate(id) {
    const users = getLS(KEY_USERS) || [];
    const seller = users.find(u => u.id === id && u.role === ROLES.SELLER);
    if (!seller) return;

    document.getElementById('editId').value = seller.id;
    document.getElementById('editFullName').value = seller.name || '';
    document.getElementById('editEmail').value = seller.email || '';
    document.getElementById('editPhone').value = seller.phone || '';
    document.getElementById('editStoreName').value = seller.storeName || '';
    document.getElementById('editCity').value = seller.city || '';
    document.getElementById('editDescription').value = seller.storeDescription || '';
    document.getElementById('editPaymentMethod').value = seller.paymentMethod || '';

    new bootstrap.Modal(document.getElementById('updateModal')).show();
}

window.saveUpdate = saveUpdate;

function saveUpdate() {
    const id = document.getElementById('editId').value;

    const updates = {
        name:           document.getElementById('editFullName').value.trim(),
        email:          document.getElementById('editEmail').value.trim(),
        phone:          document.getElementById('editPhone').value.trim(),
        storeName:      document.getElementById('editStoreName').value.trim(),
        city:           document.getElementById('editCity').value.trim(),
        storeDescription: document.getElementById('editDescription').value.trim(),
        paymentMethod:  document.getElementById('editPaymentMethod').value.trim()
    };

    updateSeller(id, updates);

    bootstrap.Modal.getInstance(document.getElementById('updateModal')).hide();
    showToast('Vendor profile updated successfully!', 'success');
    refreshAll();
}

// ── Toast ───────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
    document.querySelectorAll('.admin-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    const icon = type === 'success' ? '<i class="bi bi-check-circle-fill"></i>' :
                 type === 'error'   ? '<i class="bi bi-x-circle-fill"></i>' :
                 '<i class="bi bi-exclamation-triangle-fill"></i>';
    toast.innerHTML = `<span>${icon}</span> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── Reset filters ───────────────────────────────────────────────────────────────

function resetAllFilters() {
    ['filterName', 'filterCity', 'filterPayment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderTable();
}

// ── Refresh everything ──────────────────────────────────────────────────────────

function refreshAll() {
    updateKPIs();
    populateFilters();
    renderTable();
}

// ── Initialization ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    refreshAll();

    // Filter listeners
    document.getElementById('filterName')?.addEventListener('input', renderTable);
    document.getElementById('filterCity')?.addEventListener('change', renderTable);
    document.getElementById('filterPayment')?.addEventListener('change', renderTable);

    document.getElementById('resetFilters')?.addEventListener('click', resetAllFilters);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', executeDelete);

    

    // Optional: global search sync
    document.getElementById('globalSearch')?.addEventListener('input', function () {
        const nameFilter = document.getElementById('filterName');
        if (nameFilter) {
            nameFilter.value = this.value;
            renderTable();
        }
    });
});