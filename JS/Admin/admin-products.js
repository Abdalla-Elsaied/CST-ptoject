// ============================================================
// admin-products.js
// Handles the Products section — view, filter, activate/deactivate, delete.
// Depends on: admin-helpers.js
// ============================================================

import {
    getProducts,
    saveProducts,
    getOrders,
    getSellerName,
    formatPrice,
    stockBadge,
    activeBadge,
    showToast,
    showConfirm,
    escapeHTML
} from '../Admin/admin-helpers.js';

// Active filter state — persists while user stays on products section
let productFilters = {
    search: '',
    category: 'All',
    status: 'All'
};


/**
 * Main entry point for the products section.
 * Called every time the user clicks "Products" in the sidebar.
 */
export function renderProducts() {
    // Reset filters on section load
    productFilters = { search: '', category: 'All', status: 'All' };

    const searchInput = document.getElementById('productSearchInput');
    const catFilter = document.getElementById('productCategoryFilter');
    const statFilter = document.getElementById('productStatusFilter');

    if (searchInput) searchInput.value = '';
    if (catFilter) catFilter.value = 'All';
    if (statFilter) statFilter.value = 'All';

    renderProductsTable();
    bindProductsEvents();
}


// ─── TABLE RENDERING ─────────────────────────────────────────

/**
 * Renders the products table based on current productFilters.
 * Called on load and whenever any filter changes.
 */
export function renderProductsTable() {
    const products = getProducts();
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    // Apply all 3 filters together
    const filtered = products.filter(p => {
        const pName = (p.name || '').toLowerCase();
        const matchSearch = pName.includes(productFilters.search.toLowerCase());
        const matchCategory = productFilters.category === 'All' || p.category === productFilters.category;
        const matchStatus = productFilters.status === 'All' ||
            (productFilters.status === 'Active' && p.isActive) ||
            (productFilters.status === 'Inactive' && !p.isActive);
        return matchSearch && matchCategory && matchStatus;
    });

    // Update count label
    const countEl = document.getElementById('productsCount');
    if (countEl) {
        countEl.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    No products match the selected filters.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((p, i) => {
        // Better image fallback - use data URL placeholder if image fails
        const imageUrl = p.imageUrl || p.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect fill="%23e5e7eb" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%239ca3af"%3ENo Img%3C/text%3E%3C/svg%3E';

        return `
        <tr>
            <td><span class="text-muted small fw-bold">${i + 1}</span></td>
            <td>
                <img src="${imageUrl}"
                     alt="${p.name}"
                     class="product-thumb rounded shadow-sm"
                     style="width: 40px; height: 40px; object-fit: cover;"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Crect fill=%22%23e5e7eb%22 width=%2240%22 height=%2240%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2212%22 fill=%22%239ca3af%22%3ENo Img%3C/text%3E%3C/svg%3E'">
            </td>
            <td><div class="fw-bold">${escapeHTML(p.name)}</div></td>
            <td>${getSellerName(p.sellerId)}</td>
            <td><span class="badge bg-light text-dark border">${escapeHTML(p.category)}</span></td>
            <td class="fw-bold">${formatPrice(p.price)}</td>
            <td>${stockBadge(p.stock)}</td>
            <td>${activeBadge(p.isActive)}</td>
            <td class="text-center">
                <div class="d-flex gap-2 justify-content-center">
                    ${p.isActive
                ? `<button class="btn-action btn-warn" title="Deactivate"
                                   data-id="${p.id}" data-action="deactivate"><i class="bi bi-eye-slash"></i></button>`
                : `<button class="btn-action btn-info" title="Activate"
                                   data-id="${p.id}" data-action="activate"><i class="bi bi-eye"></i></button>`
            }
                    <button class="btn-action btn-delete" title="Delete"
                            data-id="${p.id}" data-action="delete"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

/**
 * Binds all filter inputs and table action buttons.
 * Uses event delegation for table buttons.
 */
function bindProductsEvents() {
    // Search
    const searchInput = document.getElementById('productSearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            productFilters.search = e.target.value;
            renderProductsTable();
        };
    }

    // Category filter
    const catFilter = document.getElementById('productCategoryFilter');
    if (catFilter) {
        catFilter.onchange = (e) => {
            productFilters.category = e.target.value;
            renderProductsTable();
        };
    }

    // Status filter
    const statFilter = document.getElementById('productStatusFilter');
    if (statFilter) {
        statFilter.onchange = (e) => {
            productFilters.status = e.target.value;
            renderProductsTable();
        };
    }

    // Table buttons via event delegation
    const tbody = document.getElementById('productsTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;  // product.id may be string or number
            const action = btn.dataset.action;

            if (action === 'activate') toggleProductStatus(id, true);
            if (action === 'deactivate') confirmDeactivateProduct(id);
            if (action === 'delete') confirmDeleteProduct(id);
        };
    }
}


// ─── PRODUCT ACTIONS ─────────────────────────────────────────

/**
 * Sets a product's isActive field to the given value and saves.
 * @param {string|number} id - product id
 * @param {boolean} isActive - true = activate, false = deactivate
 */
export function toggleProductStatus(id, isActive) {
    const products = getProducts();
    const index = products.findIndex(p => p.id == id);
    if (index === -1) return;

    products[index].isActive = isActive;
    saveProducts(products);
    renderProductsTable();

    const action = isActive ? 'activated' : 'deactivated';
    showToast(`Product ${action} successfully.`, 'success');
}

/**
 * Shows confirm dialog before deactivating a product.
 * Deactivate = soft hide from catalog (isActive: false).
 */
export function confirmDeactivateProduct(id) {
    const product = getProducts().find(p => p.id == id);
    if (!product) return;

    showConfirm(
        `Deactivate "${product.name}"? It will be hidden from the catalog.`,
        () => toggleProductStatus(id, false)
    );
}

/**
 * Shows confirm dialog before permanently deleting a product.
 * Admin can hard-delete — unlike sellers who only soft-delete.
 * WARNING: only delete if no orders reference this product.
 */
export function confirmDeleteProduct(id) {
    const product = getProducts().find(p => p.id == id);
    if (!product) return;

    // Check if any order contains this product
    const hasOrders = getOrders().some(o =>
        o.items && o.items.some(item => (item.productId == id || item.id == id))
    );

    const message = hasOrders
        ? `"${product.name}" has existing orders. Deleting it will NOT remove those orders but the product name will show as missing. Are you sure?`
        : `Permanently delete "${product.name}"? This cannot be undone.`;

    showConfirm(message, () => {
        const updated = getProducts().filter(p => p.id != id);
        saveProducts(updated);
        renderProductsTable();
        showToast('Product deleted.', 'error');
    });
}

// Global exposure
window.toggleProductStatus = toggleProductStatus;
window.confirmDeactivateProduct = confirmDeactivateProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
