// ============================================================
// ShowSeller.js — Sellers Table with Filters, KPIs & Modals
// ============================================================

function getSellers() {
    return JSON.parse(localStorage.getItem('sellers') || '[]');
}

function saveSellers(sellers) {
    localStorage.setItem('sellers', JSON.stringify(sellers));
}

// Get initials from full name
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

// Populate filter dropdowns
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
    tbody.innerHTML = '';

    // Apply filters
    const nameFilter = (document.getElementById('filterName')?.value || '').toLowerCase();
    const cityFilter = document.getElementById('filterCity')?.value || '';
    const paymentFilter = document.getElementById('filterPayment')?.value || '';

    let filtered = sellers.filter(seller => {
        const matchName = !nameFilter ||
            (seller.fullName && seller.fullName.toLowerCase().includes(nameFilter)) ||
            (seller.email && seller.email.toLowerCase().includes(nameFilter)) ||
            (seller.storeName && seller.storeName.toLowerCase().includes(nameFilter));
        const matchCity = !cityFilter || seller.city === cityFilter;
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
                    <div class="empty-icon">${hasFilters ? '🔍' : '👥'}</div>
                    <p>${hasFilters
                ? 'No vendors match the applied filters.'
                : 'No vendors have been registered yet.'}</p>
                    ${hasFilters
                ? '<button class="btn-reset-filters" onclick="resetAllFilters()">✕ Clear Filters</button>'
                : '<a href="/Html/Admin/AddSeller.html">+ Onboard your first vendor</a>'}
                </td>
            </tr>`;
        return;
    }

    filtered.forEach((seller, index) => {
        const initials = getInitials(seller.fullName);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span style="color: var(--text-muted); font-size: 12px; font-weight: 600;">${index + 1}</span>
            </td>
            <td class="text-start">
                <div class="table-user-cell">
                    <div class="table-avatar">${initials}</div>
                    <div>
                        <div class="user-name">${seller.fullName}</div>
                        <div class="user-email">${seller.email}</div>
                    </div>
                </div>
            </td>
            <td>${seller.phone}</td>
            <td>
                <span style="font-weight:600;">${seller.storeName}</span>
            </td>
            <td>
                <span class="stock-badge stock-ok">${seller.city}</span>
            </td>
            <td>
                <span class="status-badge status-active">${seller.paymentMethod}</span>
            </td>
            <td>
                <div class="actions-col">
                    <button class="btn-action btn-edit" onclick="openUpdate(${seller.id})" title="Edit">
                        ✏️ Edit
                    </button>
                    <button class="btn-action btn-delete" onclick="confirmDelete(${seller.id}, '${seller.fullName.replace(/'/g, "\\'")}')" title="Delete">
                        🗑️ Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Delete with confirmation modal
let pendingDeleteId = null;

function confirmDelete(id, name) {
    pendingDeleteId = id;
    const nameEl = document.getElementById('deleteSellerName');
    if (nameEl) nameEl.textContent = name;
    new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

function executeDelete() {
    if (pendingDeleteId === null) return;
    const updated = getSellers().filter(s => s.id !== pendingDeleteId);
    saveSellers(updated);
    pendingDeleteId = null;
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();

    // Show success toast
    showToast('Vendor record deleted successfully.', 'success');

    refreshAll();
}

// Old delete function (fallback)
function deleteSeller(id) {
    confirmDelete(id, getSellers().find(s => s.id === id)?.fullName || 'this seller');
}

// Open update modal
function openUpdate(id) {
    const seller = getSellers().find(s => s.id === id);
    if (!seller) return;

    document.getElementById('editId').value = seller.id;
    document.getElementById('editFullName').value = seller.fullName;
    document.getElementById('editEmail').value = seller.email;
    document.getElementById('editPhone').value = seller.phone;
    document.getElementById('editStoreName').value = seller.storeName;
    document.getElementById('editCity').value = seller.city;
    document.getElementById('editDescription').value = seller.description;
    document.getElementById('editPaymentMethod').value = seller.paymentMethod;

    new bootstrap.Modal(document.getElementById('updateModal')).show();
}

// Save update
function saveUpdate() {
    const id = Number(document.getElementById('editId').value);
    const sellers = getSellers();
    const index = sellers.findIndex(s => s.id === id);
    if (index === -1) return;

    sellers[index] = {
        ...sellers[index],
        fullName: document.getElementById('editFullName').value,
        email: document.getElementById('editEmail').value,
        phone: document.getElementById('editPhone').value,
        storeName: document.getElementById('editStoreName').value,
        city: document.getElementById('editCity').value,
        description: document.getElementById('editDescription').value,
        paymentMethod: document.getElementById('editPaymentMethod').value
    };

    saveSellers(sellers);
    bootstrap.Modal.getInstance(document.getElementById('updateModal')).hide();

    // Show success toast
    showToast('Vendor profile updated successfully!', 'success');

    refreshAll();
}

// Toast notification
function showToast(message, type) {
    // Remove existing toasts
    document.querySelectorAll('.admin-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Reset all filters
function resetAllFilters() {
    const nameInput = document.getElementById('filterName');
    const citySelect = document.getElementById('filterCity');
    const paymentSelect = document.getElementById('filterPayment');

    if (nameInput) nameInput.value = '';
    if (citySelect) citySelect.value = '';
    if (paymentSelect) paymentSelect.value = '';

    renderTable();
}

// Refresh everything
function refreshAll() {
    updateKPIs();
    populateFilters();
    renderTable();
}

// ─── INITIALIZATION ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    // Initial render
    refreshAll();

    // Filter event listeners
    const filterName = document.getElementById('filterName');
    const filterCity = document.getElementById('filterCity');
    const filterPayment = document.getElementById('filterPayment');
    const resetBtn = document.getElementById('resetFilters');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const globalSearch = document.getElementById('globalSearch');

    if (filterName) filterName.addEventListener('input', renderTable);
    if (filterCity) filterCity.addEventListener('change', renderTable);
    if (filterPayment) filterPayment.addEventListener('change', renderTable);
    if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', executeDelete);

    // Global search in topbar
    if (globalSearch) {
        globalSearch.addEventListener('input', function () {
            if (filterName) {
                filterName.value = this.value;
                renderTable();
            }
        });
    }
});