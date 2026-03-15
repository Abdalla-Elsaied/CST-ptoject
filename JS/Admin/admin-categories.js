// ============================================================
// admin-categories.js
// Handles Category Suggestions from Sellers
// Depends on: admin-helpers.js, Constants.js
// ============================================================

import { getLS, setLS } from '../Core/Storage.js';
import { KEY_CATEGORIES, KEY_PRODUCTS, KEY_CURRENT_USER } from '../Core/Constants.js';
import {
    showToast,
    showConfirm,
    escapeHTML,
    renderTableEmptyState
} from './admin-helpers.js';

const MAX_CATEGORY_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

const getCategories = () => getLS(KEY_CATEGORIES) || [];
const saveCategories = (cats) => setLS(KEY_CATEGORIES, cats);
const getProducts = () => getLS(KEY_PRODUCTS) || [];
const saveProducts = (prods) => setLS(KEY_PRODUCTS, prods);
const getCurrentAdmin = () => getLS(KEY_CURRENT_USER);

/**
 * ✅ FIX: Calculate actual product count for each category
 */
function syncCategoryProductCounts() {
    const categories = getCategories();
    const products = getProducts();
    
    categories.forEach(cat => {
        const count = products.filter(p => 
            (p.category === cat.name || p.productCategory === cat.name)
        ).length;
        cat.products = count;
    });
    
    saveCategories(categories);
}

/**
 * ✅ FIX: Ensure all categories have proper source tracking
 */
function ensureCategoryMetadata() {
    const categories = getCategories();
    const admin = getCurrentAdmin();
    let changed = false;
    
    const updated = categories.map(cat => {
        if (!cat.source) {
            changed = true;
            return {
                ...cat,
                source: 'admin',
                suggestedBy: null,
                createdBy: admin?.id || 'system',
                createdAt: cat.createdAt || new Date().toISOString()
            };
        }
        return cat;
    });
    
    if (changed) {
        saveCategories(updated);
    }
}

/**
 * ✅ FIX: Validate category name with proper rules
 */
function validateCategoryName(name, excludeId = null) {
    const trimmed = (name || '').trim();
    
    if (!trimmed) {
        return { valid: false, error: 'Category name is required' };
    }
    
    if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
        return { valid: false, error: `Name must be ${MAX_CATEGORY_NAME_LENGTH} characters or less` };
    }
    
    if (!/^[a-zA-Z0-9\s&\-_]+$/.test(trimmed)) {
        return { valid: false, error: 'Name can only contain letters, numbers, spaces, &, -, and _' };
    }
    
    const categories = getCategories();
    const duplicate = categories.find(c => 
        c.name.toLowerCase() === trimmed.toLowerCase() && 
        c.id !== excludeId
    );
    
    if (duplicate) {
        return { valid: false, error: 'A category with this name already exists' };
    }
    
    return { valid: true, value: trimmed };
}

export function renderCategories() {
    // ✅ FIX: Sync product counts and metadata before rendering
    syncCategoryProductCounts();
    ensureCategoryMetadata();
    
    renderCategoryRequestsTable();
    renderAllCategoriesTable();
    bindCategoryEvents();
}

/**
 * ✅ FIX: Render all categories with accurate product counts and better UI
 */
function renderAllCategoriesTable() {
    const categories = getCategories().filter(c => 
        c.visibility !== 'draft' || c.source === 'admin'
    );
    const tbody = document.getElementById('allCategoriesTableBody');
    if (!tbody) return;

    if (!categories.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="bi bi-collection fs-1 text-muted d-block mb-2"></i>
                    <strong>No Categories Yet</strong>
                    <p class="text-muted mb-0">Create a category or approve seller suggestions.</p>
                </td>
            </tr>`;
        return;
    }

    const visibilityBadge = (vis) => {
        if (vis === 'active') return '<span class="badge bg-success">Active</span>';
        if (vis === 'hidden') return '<span class="badge bg-secondary">Hidden</span>';
        return '<span class="badge bg-warning text-dark">Draft</span>';
    };

    tbody.innerHTML = categories.map(cat => `
        <tr>
            <td>
                <strong>${escapeHTML(cat.name || '')}</strong>
                ${cat.source === 'seller' ? '<small class="text-muted d-block">From Seller</small>' : ''}
            </td>
            <td><span class="badge bg-light text-dark">${cat.products || 0}</span></td>
            <td>${visibilityBadge(cat.visibility)}</td>
            <td><small>${escapeHTML(cat.updated || '—')}</small></td>
            <td class="text-center">
                <div class="d-flex gap-2 justify-content-center flex-wrap">
                    <button class="btn-action btn-edit btn-sm" data-id="${cat.id}" data-action="edit-cat" title="Edit category">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    ${cat.visibility === 'active' ? `
                    <button class="btn-action btn-warn btn-sm" data-id="${cat.id}" data-action="set-hidden" title="Hide from storefront">
                        <i class="bi bi-eye-slash"></i> Hide
                    </button>` : `
                    <button class="btn-action btn-success btn-sm" data-id="${cat.id}" data-action="set-active" title="Make active">
                        <i class="bi bi-eye"></i> Activate
                    </button>`}
                    <button class="btn-action btn-delete btn-sm" data-id="${cat.id}" data-action="delete-cat" title="Delete category">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Renders the table of pending category suggestions
 */
export function renderCategoryRequestsTable() {
    const categories  = getCategories();
    const pendingCats = categories.filter(c => c.visibility === 'draft');

    const countEl = document.getElementById('categoryRequestsCount');
    if (countEl) {
        countEl.textContent = pendingCats.length === 0
            ? 'No pending suggestions'
            : `${pendingCats.length} pending suggestion${pendingCats.length !== 1 ? 's' : ''}`;
    }

    const tbody = document.getElementById('categoryRequestsTableBody');
    if (!tbody) return;

    if (pendingCats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="bi bi-inbox fs-1 text-muted d-block mb-2"></i>No category suggestions pending. Sellers can suggest new categories from their dashboard.</td></tr>`;
        return;
    }

    tbody.innerHTML = pendingCats.map(cat => `
        <tr>
            <td><strong>${escapeHTML(cat.name)}</strong></td>
            <td>${escapeHTML(cat.description || '—')}</td>
            <td>${escapeHTML(cat.updated)}</td>
            <td class="text-center">
                <div class="d-flex gap-2 justify-content-center">
                    <button class="btn-action btn-success" data-id="${cat.id}" data-action="approve-cat" title="Approve">
                        <i class="bi bi-check-lg"></i> Approve
                    </button>
                    <button class="btn-action btn-edit" data-id="${cat.id}" data-action="edit-approve-cat" title="Edit and Approve">
                        <i class="bi bi-pencil"></i> Edit & Approve
                    </button>
                    <button class="btn-action btn-delete" data-id="${cat.id}" data-action="reject-cat" title="Reject">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Opens Edit Category modal for Edit & Approve flow
 */
function openEditCategoryModal(cat) {
    document.getElementById('editCategoryId').value = cat.id || '';
    document.getElementById('editCategoryName').value = cat.name || '';
    document.getElementById('editCategoryDesc').value = cat.description || '';
    new bootstrap.Modal(document.getElementById('editCategoryModal')).show();
}

/**
 * Saves edited category and approves it
 */
function saveEditCategoryAndApprove() {
    const id = document.getElementById('editCategoryId').value;
    const name = (document.getElementById('editCategoryName').value || '').trim();
    const description = (document.getElementById('editCategoryDesc').value || '').trim();

    if (!name) {
        showToast('Please enter a category name.', 'error');
        return;
    }

    const categories = getCategories();
    const idx = categories.findIndex(c => c.id === id);
    if (idx === -1) return;

    const cat = categories[idx];
    categories[idx].name = name;
    categories[idx].description = description;
    categories[idx].updated = new Date().toLocaleDateString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric'
    });

    if (cat.visibility === 'draft') {
        categories[idx].visibility = 'active';
        categories[idx].approvedAt = new Date().toISOString();
        showToast(`Suggestion "${name}" updated and approved!`, 'success');
    } else {
        showToast(`Category "${name}" updated successfully.`, 'success');
    }

    saveCategories(categories);

    bootstrap.Modal.getInstance(document.getElementById('editCategoryModal')).hide();
    renderCategoryRequestsTable();
    renderAllCategoriesTable();
}

/**
 * Opens modal to add a new category (saves as draft)
 */
export function openAddCategoryModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('addCategoryModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="addCategoryModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-tags"></i> Add New Category
                            </h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">
                                    Category Name <span class="text-danger">*</span>
                                </label>
                                <input type="text" class="form-control"
                                    id="newCategoryName"
                                    placeholder="e.g. Sports & Fitness">
                                <div class="invalid-feedback">
                                    Please enter a category name.
                                </div>
                            </div>
                            <div class="mb-2">
                                <label class="form-label">
                                    Description
                                    <span class="text-muted small">(optional)</span>
                                </label>
                                <textarea class="form-control"
                                    id="newCategoryDesc"
                                    rows="3"
                                    placeholder="Short description..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn-primary-green"
                                id="saveNewCategoryBtn">
                                <i class="bi bi-send"></i> Submit for Review
                            </button>
                        </div>
                    </div>
                </div>
            </div>`);

        document.getElementById('saveNewCategoryBtn')
            .addEventListener('click', saveNewCategory);
    }

    // Reset fields
    document.getElementById('newCategoryName').value = '';
    document.getElementById('newCategoryDesc').value = '';
    document.getElementById('newCategoryName').classList.remove('is-invalid');

    new bootstrap.Modal(document.getElementById('addCategoryModal')).show();
}

/**
 * Saves new category as draft
 */
export function saveNewCategory() {
    const name = (document.getElementById('newCategoryName').value || '').trim();
    const desc = (document.getElementById('newCategoryDesc').value || '').trim();

    // Validate name
    if (!name) {
        document.getElementById('newCategoryName').classList.add('is-invalid');
        return;
    }

    const categories = getCategories();

    // Block duplicate name
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        showToast(`Category "${name}" already exists.`, 'error');
        return;
    }

    // Save as draft → will appear in Suggestions tab for review
    const newCategory = {
        id:          'cat-' + Date.now().toString(36),
        name,
        description: desc,
        visibility:  'draft',    // ← goes to Suggestions tab
        products:    0,
        updated:     new Date().toLocaleDateString('en-US', {
            month: 'short', day: '2-digit', year: 'numeric'
        })
    };

    categories.push(newCategory);
    saveCategories(categories);

    // Close modal
    bootstrap.Modal.getInstance(
        document.getElementById('addCategoryModal')
    )?.hide();

    showToast(`"${name}" added to suggestions for review.`, 'success');

    // Re-render — new category appears in Suggestions tab immediately
    renderCategoryRequestsTable();

    // Update sidebar badge
    window.updateSidebarBadges?.();
}

/**
 * Attaches click event listeners for the action buttons
 */
function bindCategoryEvents() {
    const tbody = document.getElementById('categoryRequestsTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;
            const categories = getLS(KEY_CATEGORIES) || [];
            const catIndex = categories.findIndex(c => c.id === id);

            if (catIndex === -1) return;

            if (action === 'approve-cat') {
                showConfirm(`Approve category "${categories[catIndex].name}"? It will go live immediately.`, () => {
                    categories[catIndex].visibility = 'active';
                    categories[catIndex].approvedAt = new Date().toISOString();
                    categories[catIndex].updated = new Date().toLocaleDateString('en-US', {
                        month: 'short', day: '2-digit', year: 'numeric'
                    });

                    setLS(KEY_CATEGORIES, categories);
                    showToast('Category approved successfully!', 'success');
                    renderCategoryRequestsTable();
                    renderAllCategoriesTable();
                    window.updateSidebarBadges?.();
                });
            } else if (action === 'reject-cat') {
                showConfirm(`Reject and delete category suggestion "${categories[catIndex].name}"?`, () => {
                    categories.splice(catIndex, 1);
                    setLS(KEY_CATEGORIES, categories);
                    showToast('Category suggestion rejected.', 'error');
                    renderCategoryRequestsTable();
                    window.updateSidebarBadges?.();
                });
            } else if (action === 'edit-approve-cat') {
                openEditCategoryModal(categories[catIndex]);
            }
        };
    }

    const allTbody = document.getElementById('allCategoriesTableBody');
    if (allTbody) {
        allTbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;
            const categories = getLS(KEY_CATEGORIES) || [];
            const idx = categories.findIndex(c => c.id === id);
            if (idx === -1) return;

            const cat = categories[idx];

            if (action === 'edit-cat') {
                openEditCategoryModal(cat);
            } else if (action === 'set-active') {
                showConfirm(`Set category "${cat.name}" to Active?`, () => {
                    categories[idx].visibility = 'active';
                    setLS(KEY_CATEGORIES, categories);
                    showToast('Category set to Active.', 'success');
                    renderCategoryRequestsTable();
                    renderAllCategoriesTable();
                });
            } else if (action === 'set-hidden') {
                showConfirm(`Hide category "${cat.name}" from storefront?`, () => {
                    categories[idx].visibility = 'hidden';
                    setLS(KEY_CATEGORIES, categories);
                    showToast('Category hidden from storefront.', 'warning');
                    renderCategoryRequestsTable();
                    renderAllCategoriesTable();
                });
            } else if (action === 'delete-cat') {
                // ✅ MINOR: Check if products exist in this category before deletion
                const products = getLS(KEY_PRODUCTS) || [];
                const productsInCategory = products.filter(p => 
                    (p.category === cat.name || p.productCategory === cat.name)
                );
                
                if (productsInCategory.length > 0) {
                    showConfirm(
                        `Category "${cat.name}" has ${productsInCategory.length} product(s). Delete anyway? Products will keep their category name but it won't be in the category list.`,
                        () => {
                            categories.splice(idx, 1);
                            setLS(KEY_CATEGORIES, categories);
                            showToast('Category deleted. Products retain their category name.', 'info');
                            renderCategoryRequestsTable();
                            renderAllCategoriesTable();
                        }
                    );
                } else {
                    showConfirm(`Delete category "${cat.name}"? This category has no products.`, () => {
                        categories.splice(idx, 1);
                        setLS(KEY_CATEGORIES, categories);
                        showToast('Category deleted.', 'success');
                        renderCategoryRequestsTable();
                        renderAllCategoriesTable();
                    });
                }
            }
        };
    }

    // Tabs for Suggestions / All
    const tabSuggestions = document.getElementById('catTabSuggestions');
    const tabAll = document.getElementById('catTabAll');
    const suggestionsCard = document.getElementById('categorySuggestionsCard');
    const allCard = document.getElementById('allCategoriesCard');

    if (tabSuggestions && tabAll && suggestionsCard && allCard) {
        const activateTab = (target) => {
            if (target === 'suggestions') {
                suggestionsCard.style.display = 'block';
                allCard.style.display = 'none';
                tabSuggestions.classList.add('active');
                tabAll.classList.remove('active');
            } else {
                suggestionsCard.style.display = 'none';
                allCard.style.display = 'block';
                tabSuggestions.classList.remove('active');
                tabAll.classList.add('active');
            }
        };

        tabSuggestions.onclick = () => activateTab('suggestions');
        tabAll.onclick = () => activateTab('all');
    }
}

// Expose for modal buttons and HTML onclick handlers
window.saveEditCategoryAndApprove = saveEditCategoryAndApprove;
window.openAddCategoryModal = openAddCategoryModal;
window.saveNewCategory = saveNewCategory;
