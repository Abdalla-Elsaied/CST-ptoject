// ============================================================
// admin-products.js
// Handles the Products section — view, filter, activate/deactivate, delete.
// Depends on: admin-helpers.js
// ============================================================

import {
    getProducts,
    saveProducts,
    getOrders,
    getCategories,
    getSellerName,
    formatPrice,
    stockBadge,
    activeBadge,
    showToast,
    showConfirm,
    escapeHTML,
    renderPagination,
    renderTableEmptyState,
    debounce
} from './admin-helpers.js';

import { 
    fetchProducts, 
    getFilteredProducts, 
    updateProductStatus, 
    deleteProduct,
    getCachedProducts
} from './admin-data-products.js';

import { logAdminAction } from './admin-profile.js';

// Active filter state — persists while user stays on products section
let productFilters = {
    search: '',
    category: 'All',
    status: 'All',
    page: 1,
    limit: 10
};


/**
 * Main entry point for the products section.
 * Called every time the user clicks "Products" in the sidebar.
 */
function loadCategoryOptions() {
    const categories = getCategories();
    return [...new Set(categories.map(c => c.name).filter(Boolean))].sort();
}

export async function renderProducts() {
    // Show skeleton loading state
    const tbody = document.getElementById('productsTableBody');
    if (tbody) {
        tbody.innerHTML = Array(5).fill(0).map(() => `
            <tr>
                <td><div class="skeleton skeleton-text" style="width: 20px;"></div></td>
                <td><div class="skeleton skeleton-img"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                <td class="text-center">
                    <div class="d-flex gap-2 justify-content-center">
                        <div class="skeleton skeleton-btn"></div>
                        <div class="skeleton skeleton-btn"></div>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Reset filters on section load
    productFilters = { search: '', category: 'All', status: 'All', page: 1, limit: 10 };

    // Fetch from service (syncs with API if needed)
    await fetchProducts(true); 

    const searchInput = document.getElementById('productSearchInput');
    const catFilter = document.getElementById('productCategoryFilter');
    const statFilter = document.getElementById('productStatusFilter');

    if (searchInput) searchInput.value = '';
    if (statFilter) statFilter.value = 'All';

    // Populate category filter
    if (catFilter) {
        const storedCats = loadCategoryOptions();
        const products = getCachedProducts();
        const productCats = [...new Set(products.map(p => p.category || p.productCategory).filter(Boolean))];
        const allCats = [...new Set([...storedCats, ...productCats])].sort();
        catFilter.innerHTML = '<option value="All">All Categories</option>' +
            allCats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
        catFilter.value = 'All';
    }

    renderProductsTable();
    bindProductsEvents();
}


// ─── TABLE RENDERING ─────────────────────────────────────────

/**
 * Renders the products table based on current productFilters.
 * Called on load and whenever any filter changes.
 */
export function renderProductsTable() {
    const { items, totalItems, currentPage } = getFilteredProducts(productFilters);
    productFilters.page = currentPage;

    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    // Update count label
    const countEl = document.getElementById('productsCount');
    if (countEl) {
        countEl.textContent = `${totalItems} product${totalItems !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (items.length === 0) {
        tbody.innerHTML = renderTableEmptyState(9, 'No products found matching your filters.');
        renderPagination(0, productFilters.limit, 1, 'productsPagination', () => {});
        return;
    }

    const startIdx = (productFilters.page - 1) * productFilters.limit;

    tbody.innerHTML = items.map((p, i) => {
        const imageUrl = p.imageUrl || p.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect fill="%23e5e7eb" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%239ca3af"%3ENo Img%3C/text%3E%3C/svg%3E';

        return `
        <tr>
            <td><span class="text-muted small fw-bold">${startIdx + i + 1}</span></td>
            <td>
                <img src="${imageUrl}"
                     alt="${escapeHTML(p.name || p.productName || 'Product')}"
                     class="product-thumb rounded shadow-sm"
                     style="width: 40px; height: 40px; object-fit: cover;"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Crect fill=%22%23e5e7eb%22 width=%2240%22 height=%2240%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2212%22 fill=%22%239ca3af%22%3ENo Img%3C/text%3E%3C/svg%3E'">
            </td>
            <td><div class="fw-bold">${escapeHTML(p.name || p.productName)}</div></td>
            <td>${getSellerName(p.sellerId)}</td>
            <td><span class="badge bg-light text-dark border">${escapeHTML(p.category || p.productCategory || '—')}</span></td>
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

    // Render pagination controls
    renderPagination(totalItems, productFilters.limit, productFilters.page, 'productsPagination', (newPage) => {
        productFilters.page = newPage;
        renderProductsTable();
        // Scroll to top of table or section
        document.getElementById('productsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
        searchInput.oninput = debounce((e) => {
            productFilters.search = e.target.value;
            productFilters.page = 1; 
            renderProductsTable();
        }, 300);
    }

    // Category filter
    const catFilter = document.getElementById('productCategoryFilter');
    if (catFilter) {
        catFilter.onchange = (e) => {
            productFilters.category = e.target.value;
            productFilters.page = 1; // Reset to first page
            renderProductsTable();
        };
    }

    // Status filter
    const statFilter = document.getElementById('productStatusFilter');
    if (statFilter) {
        statFilter.onchange = (e) => {
            productFilters.status = e.target.value;
            productFilters.page = 1; // Reset to first page
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
export async function toggleProductStatus(id, isActive) {
    try {
        await updateProductStatus(id, isActive);
        renderProductsTable();

        const action = isActive ? 'activated' : 'deactivated';
        showToast(`Product ${action} successfully.`, 'success');
    } catch (err) {
        showToast('Operation failed. Please try again.', 'error');
    }
}

/**
 * Shows confirm dialog before deactivating a product.
 * Deactivate = soft hide from catalog (isActive: false).
 */
export function confirmDeactivateProduct(id) {
    const product = getProducts().find(p => p.id == id);
    if (!product) return;

    showConfirm(
        `Deactivate "${product.name || product.productName}"? It will be hidden from the catalog.`,
        () => {
            toggleProductStatus(id, false);
            logAdminAction('deactivated_product', product.name || product.productName, id);
        }
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

    const productName = product.name || product.productName;
    // Check if any order contains this product
    const hasOrders = getOrders().some(o =>
        o.items && o.items.some(item => (item.productId == id || item.id == id))
    );

    const message = hasOrders
        ? `"${productName}" has existing orders. Deleting it will NOT remove those orders but the product name will show as missing. Are you sure?`
        : `Permanently delete "${productName}"? This cannot be undone.`;

    showConfirm(message, async () => {
        try {
            await deleteProduct(id);
            logAdminAction('deleted_product', productName, id);
            renderProductsTable();
            showToast('Product deleted.', 'success');
        } catch (err) {
            showToast('Failed to delete product.', 'error');
        }
    });
}

// Global exposure
window.toggleProductStatus = toggleProductStatus;
window.confirmDeactivateProduct = confirmDeactivateProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
