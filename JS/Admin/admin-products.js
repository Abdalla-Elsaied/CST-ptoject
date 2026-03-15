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
    debounce,
    formatDate,
    getCurrentUser,
    applyTableCardLabels
} from './admin-helpers.js';

import { getLS, setLS } from '../Core/Storage.js';
import { KEY_USERS, KEY_PRODUCTS } from '../Core/Constants.js';

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

/**
 * Normalizes product image source.
 * Checks all known field names including Cloudinary arrays.
 */
function getProductImageSrc(product) {
    if (product.imageUrl)    return product.imageUrl;
    if (product.image)       return product.image;
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images[0]?.url ||
               product.images[0]?.secure_url ||
               (typeof product.images[0] === 'string' ? product.images[0] : null);
    }
    if (product.thumbnail)   return product.thumbnail;
    if (product.photo)       return product.photo;
    return null;
}

/**
 * Normalizes product stock level.
 * Checks all known field names.
 */
function getProductStock(product) {
    const stock = product.stock          ??
                  product.quantity       ??
                  product.stockQuantity  ??
                  product.inStock        ??
                  product.availableQuantity ?? 0;
    return Number(stock) || 0;
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
        const imgSrc  = getProductImageSrc(p);
        const imgCell = imgSrc
            ? `<img src="${escapeHTML(imgSrc)}" class="product-thumb"
                    alt="${escapeHTML(p.name || p.productName || '')}"
                    onerror="this.outerHTML='<div class=\\'no-img\\'><i class=\\'bi bi-image\\'></i></div>'">`
            : `<div class="no-img"><i class="bi bi-image"></i></div>`;

        const catHtml = `<span class="prod-cat-pill">${escapeHTML(p.category || p.productCategory || '—')}</span>`;
        const isActive = p.isActive !== false;
        const sellerName = getSellerName(p.sellerId);
        const stock = getProductStock(p);

        return `
        <tr data-product-id="${p.id}">
            <td class="col-num hide-tablet" data-label="#"><span class="text-muted small fw-bold">${startIdx + i + 1}</span></td>
            <td class="col-thumb" data-label="Image">${imgCell}</td>
            <td class="col-name" data-label="Product">
                <div class="product-name-cell">
                    <div class="name">${escapeHTML(p.name || p.productName || '—')}</div>
                    <div class="pid">ID: ${String(p.id).slice(-8)}</div>
                </div>
            </td>
            <td class="col-seller hide-tablet" data-label="Seller" style="font-size:12px;">${escapeHTML(sellerName)}</td>
            <td class="col-category hide-tablet" data-label="Category">${catHtml}</td>
            <td class="col-price" data-label="Price"><span class="prod-price">${formatPrice(p.price)}</span></td>
            <td class="col-stock hide-mobile-lg" data-label="Stock">
                <div class="stock-cell">
                    ${stockBadge(stock)}
                    <button class="btn-action btn-edit" style="width:26px;height:26px;font-size:11px;" title="Adjust Stock" data-id="${p.id}" data-action="editStock">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </div>
            </td>
            <td class="col-toggle" data-label="Active">
                <div class="form-check form-switch d-flex justify-content-center mb-0">
                    <input class="form-check-input product-status-toggle" type="checkbox" role="switch"
                           data-id="${p.id}"
                           ${isActive ? 'checked' : ''}
                           style="cursor:pointer;width:40px;height:20px;"
                           title="${isActive ? 'Click to deactivate' : 'Click to activate'}">
                </div>
            </td>
            <td class="col-actions" data-label="Actions">
                <div class="um-action-cell">
                    <button class="um-btn-primary" data-id="${p.id}" data-action="view">
                        <i class="bi bi-eye"></i> View
                    </button>
                    <div class="um-overflow-wrap">
                        <button class="um-btn-more" data-id="${p.id}" aria-label="More actions" aria-expanded="false">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <div class="um-dropdown" role="menu">
                            <button class="um-drop-item" data-id="${p.id}" data-action="editStock" role="menuitem">
                                <i class="bi bi-pencil-square"></i> Adjust Stock
                            </button>
                            ${isActive
                                ? `<button class="um-drop-item um-drop-warn" data-id="${p.id}" data-action="deactivate" role="menuitem">
                                        <i class="bi bi-toggle-off"></i> Deactivate
                                   </button>`
                                : `<button class="um-drop-item um-drop-success" data-id="${p.id}" data-action="activate" role="menuitem">
                                        <i class="bi bi-toggle-on"></i> Activate
                                   </button>`
                            }
                            <div class="um-drop-divider"></div>
                            <button class="um-drop-item um-drop-danger" data-id="${p.id}" data-action="delete" role="menuitem">
                                <i class="bi bi-trash"></i> Delete Product
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`; }).join('');

    applyTableCardLabels('productsTable');

    // Bind toggle switches
    document.querySelectorAll('.product-status-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const isActive = e.target.checked;
            if (isActive) {
                toggleProductStatus(id, true);
            } else {
                confirmDeactivateProduct(id, e.target);
            }
        });
    });

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
        tbody.addEventListener('click', (e) => {
            // Handle ⋯ toggle
            const moreBtn = e.target.closest('.um-btn-more');
            if (moreBtn) {
                e.stopPropagation();
                const wrap = moreBtn.closest('.um-overflow-wrap');
                const dropdown = wrap.querySelector('.um-dropdown');
                const isOpen = dropdown.classList.contains('open');

                document.querySelectorAll('.um-dropdown.open').forEach(d => {
                    d.classList.remove('open');
                    d.closest('.um-overflow-wrap')?.querySelector('.um-btn-more')?.setAttribute('aria-expanded', 'false');
                });

                if (!isOpen) {
                    dropdown.classList.add('open');
                    moreBtn.setAttribute('aria-expanded', 'true');
                }
                return;
            }

            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            document.querySelectorAll('.um-dropdown.open').forEach(d => {
                d.classList.remove('open');
                d.closest('.um-overflow-wrap')?.querySelector('.um-btn-more')?.setAttribute('aria-expanded', 'false');
            });

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'view') openProductDetailsModal(id);
            if (action === 'editStock') openStockAdjustmentModal(id);
            if (action === 'activate') toggleProductStatus(id, true);
            if (action === 'deactivate') confirmDeactivateProduct(id, document.querySelector(`.product-status-toggle[data-id="${id}"]`));
            if (action === 'delete') confirmDeleteProduct(id);
        });
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
 * @param {string|number} id - product id
 * @param {HTMLElement} toggleElement - the toggle switch element to revert if cancelled
 */
export function confirmDeactivateProduct(id, toggleElement) {
    const product = getProducts().find(p => p.id == id);
    if (!product) return;

    showConfirm(
        `Deactivate "${product.name || product.productName}"? It will be hidden from the catalog.`,
        () => {
            toggleProductStatus(id, false);
            logAdminAction('deactivated_product', product.name || product.productName, id);
        },
        () => {
            // On cancel, revert the toggle
            if (toggleElement) {
                toggleElement.checked = true;
            }
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
            
            // ✅ MAJOR: Clean up deleted product from all customer carts
            cleanupProductFromCarts(id);
            
            renderProductsTable();
            showToast('Product deleted.', 'success');
        } catch (err) {
            showToast('Failed to delete product.', 'error');
        }
    });
}


// ─── CART CLEANUP ────────────────────────────────────────────

/**
 * Removes a deleted product from all customer carts.
 * Prevents customers from having orphaned products in their cart.
 * @param {string|number} productId - The deleted product ID
 */
function cleanupProductFromCarts(productId) {
    try {
        const users = getLS(KEY_USERS) || [];
        let cleanedCount = 0;

        users.forEach(user => {
            if (user.cart && Array.isArray(user.cart)) {
                const originalLength = user.cart.length;
                user.cart = user.cart.filter(item => 
                    String(item.id) !== String(productId) && 
                    String(item.productId) !== String(productId)
                );
                
                if (user.cart.length < originalLength) {
                    cleanedCount++;
                }
            }
        });

        if (cleanedCount > 0) {
            setLS(KEY_USERS, users);
            console.log(`[CART CLEANUP] Removed product ${productId} from ${cleanedCount} cart(s)`);
        }
    } catch (err) {
        console.error('[CART CLEANUP] Error cleaning carts:', err);
    }
}


// ─── PRODUCT DETAILS MODAL ───────────────────────────────────

/**
 * Opens product details modal showing comprehensive product information
 */
function openProductDetailsModal(id) {
    const product = getProducts().find(p => p.id == id);
    if (!product) return;

    const sellerName = getSellerName(product.sellerId);
    const imageUrl = getProductImageSrc(product); // ✅ FIX: Use proper image resolver

    // Create modal if it doesn't exist
    if (!document.getElementById('productDetailsModal')) {
        const modalHTML = `
            <div class="modal fade" id="productDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Product Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="productDetailsBody">
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
    const modalBody = document.getElementById('productDetailsBody');
    modalBody.innerHTML = `
        <div class="row g-4">
            <div class="col-md-5">
                ${imageUrl ? `
                    <img src="${imageUrl}" 
                         alt="${escapeHTML(product.name || product.productName)}"
                         class="img-fluid rounded shadow-sm"
                         style="width: 100%; max-height: 300px; object-fit: cover;"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22300%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2224%22 fill=%22%239ca3af%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                ` : `
                    <div class="text-center p-5 bg-light rounded">
                        <i class="bi bi-image" style="font-size: 4rem; color: #9ca3af;"></i>
                        <p class="text-muted mt-2">No image available</p>
                    </div>
                `}
            </div>
            <div class="col-md-7">
                <h4 class="mb-3">${escapeHTML(product.name || product.productName)}</h4>
                
                <div class="mb-3">
                    <div class="d-flex gap-2 mb-2">
                        ${activeBadge(product.isActive)}
                        ${stockBadge(getProductStock(product))}
                    </div>
                </div>

                <div class="product-details-grid">
                    <div class="detail-row">
                        <span class="detail-label">Price:</span>
                        <span class="detail-value fw-bold" style="color: var(--green-dark); font-size: 1.25rem;">${formatPrice(product.price)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Category:</span>
                        <span class="detail-value">${escapeHTML(product.category || product.productCategory || '—')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Seller:</span>
                        <span class="detail-value">${sellerName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Stock:</span>
                        <span class="detail-value">${getProductStock(product)} units</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Product ID:</span>
                        <span class="detail-value text-muted">${product.id}</span>
                    </div>
                    ${product.createdAt ? `
                        <div class="detail-row">
                            <span class="detail-label">Added:</span>
                            <span class="detail-value">${formatDate(product.createdAt)}</span>
                        </div>
                    ` : ''}
                </div>

                ${product.description || product.productDescription ? `
                    <div class="mt-4">
                        <h6 class="mb-2" style="color: var(--green-dark); font-weight: 600;">Description</h6>
                        <p class="text-muted">${escapeHTML(product.description || product.productDescription)}</p>
                    </div>
                ` : ''}
            </div>
        </div>

        <style>
            .product-details-grid {
                display: grid;
                gap: 0.75rem;
            }
            .detail-row {
                display: flex;
                padding: 0.5rem 0;
                border-bottom: 1px solid #f3f4f6;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-label {
                font-weight: 600;
                color: #6b7280;
                min-width: 120px;
            }
            .detail-value {
                color: #111827;
            }
        </style>
    `;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('productDetailsModal'));
    modal.show();
}


// ─── STOCK ADJUSTMENT MODAL ──────────────────────────────────

/**
 * Opens stock adjustment modal for editing product stock
 */
function openStockAdjustmentModal(id) {
    const product = getProducts().find(p => p.id == id);
    if (!product) return;

    // Create modal if it doesn't exist
    if (!document.getElementById('stockAdjustmentModal')) {
        const modalHTML = `
            <div class="modal fade" id="stockAdjustmentModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Adjust Stock</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="stockProductId">
                            <div class="mb-3">
                                <label class="form-label">Product</label>
                                <input type="text" class="form-control" id="stockProductName" readonly>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Current Stock</label>
                                <input type="text" class="form-control" id="stockCurrentValue" readonly>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">New Stock <span class="text-danger">*</span></label>
                                <input type="number" class="form-control" id="stockNewValue" min="0" required>
                                <div class="form-text">Enter the new stock quantity (must be 0 or greater)</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Reason for Adjustment (optional)</label>
                                <textarea class="form-control" id="stockAdjustmentReason" rows="2" placeholder="e.g., Inventory recount, damaged items, etc."></textarea>
                            </div>
                            <div id="stockError" class="text-danger small"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn-primary-green" onclick="saveStockAdjustment()">Update Stock</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Populate modal
    document.getElementById('stockProductId').value = id;
    document.getElementById('stockProductName').value = product.name || product.productName;
    document.getElementById('stockCurrentValue').value = `${product.stock} units`;
    document.getElementById('stockNewValue').value = product.stock;
    document.getElementById('stockAdjustmentReason').value = '';
    document.getElementById('stockError').textContent = '';

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('stockAdjustmentModal'));
    modal.show();

    // Focus on new stock input
    setTimeout(() => {
        document.getElementById('stockNewValue').focus();
        document.getElementById('stockNewValue').select();
    }, 300);
}

/**
 * Saves the stock adjustment
 */
window.saveStockAdjustment = function() {
    const id = document.getElementById('stockProductId').value;
    const newStock = parseInt(document.getElementById('stockNewValue').value);
    const reason = document.getElementById('stockAdjustmentReason').value.trim();
    const errorEl = document.getElementById('stockError');

    // Validation
    if (isNaN(newStock) || newStock < 0) {
        errorEl.textContent = 'Please enter a valid stock quantity (0 or greater).';
        return;
    }

    const products = getProducts();
    const index = products.findIndex(p => p.id == id);
    if (index === -1) {
        errorEl.textContent = 'Product not found.';
        return;
    }

    const oldStock = products[index].stock;
    products[index].stock = newStock;
    
    // Add stock adjustment log
    if (!products[index].stockAdjustments) {
        products[index].stockAdjustments = [];
    }
    products[index].stockAdjustments.push({
        timestamp: new Date().toISOString(),
        adminId: getCurrentUser()?.id,
        oldStock: oldStock,
        newStock: newStock,
        reason: reason || 'Manual adjustment by admin'
    });

    saveProducts(products);
    logAdminAction('adjusted_stock', products[index].name || products[index].productName, id);

    // Close modal
    const modalEl = document.getElementById('stockAdjustmentModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    renderProductsTable();
    showToast(`Stock updated from ${oldStock} to ${newStock} units.`, 'success');
};

// Global exposure
window.toggleProductStatus = toggleProductStatus;
window.confirmDeactivateProduct = confirmDeactivateProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.openProductDetailsModal = openProductDetailsModal;
window.openStockAdjustmentModal = openStockAdjustmentModal;
