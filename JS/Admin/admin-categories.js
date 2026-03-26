// ============================================================
// admin-categories.js
// Handles Category Suggestions from Sellers
// Depends on: admin-helpers.js, Constants.js
// ============================================================

import { getLS, setLS } from '../Core/Storage.js';
import { KEY_CATEGORIES, KEY_PRODUCTS, KEY_CURRENT_USER, KEY_USERS } from '../Core/Constants.js';
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
    
    // REMOVED: ASCII-only regex that blocked Arabic/Unicode names
    // Egyptian marketplace must support Arabic category names

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

    // ✅ FIX BUG 1: Prevent duplicate "Add Category" button
    renderCategoryRequestsTable();
    renderAllCategoriesTable();
    bindCategoryEvents();
}

/**
 * ✅ FIX: Render all categories with accurate product counts and better UI
 */
function renderAllCategoriesTable() {
    const categories = getCategories().filter(c => c.visibility !== 'draft');
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

    tbody.innerHTML = categories.map(cat => {
        const visHtml = cat.visibility === 'active'
            ? '<span class="status-pill status-active">● Active</span>'
            : '<span class="status-pill status-hidden">● Hidden</span>';

        const dateStr = cat.createdAt
            ? new Date(cat.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : escapeHTML(cat.updated || '—');

        return `
        <tr>
            <td>
                <div class="fw-semibold">${escapeHTML(cat.name || '')}</div>
                ${cat.description ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${escapeHTML(cat.description.slice(0,60))}${cat.description.length>60?'…':''}</div>` : ''}
            </td>
            <td>
                <span style="background:var(--page-bg);border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600;color:var(--text-secondary);">
                    ${cat.products || 0} products
                </span>
            </td>
            <td>${visHtml}</td>
            <td><small style="color:var(--text-muted);">${dateStr}</small></td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center flex-nowrap">
                    <button class="btn-action btn-edit" data-id="${cat.id}" data-action="edit-cat" title="Edit"><i class="bi bi-pencil"></i></button>
                    ${cat.visibility === 'active'
                        ? `<button class="btn-action btn-warn" data-id="${cat.id}" data-action="set-hidden" title="Hide"><i class="bi bi-eye-slash"></i></button>`
                        : `<button class="btn-action btn-success" data-id="${cat.id}" data-action="set-active" title="Make Active"><i class="bi bi-eye"></i></button>`}
                    <button class="btn-action btn-delete" data-id="${cat.id}" data-action="delete-cat" title="Delete"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>`; }).join('');
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
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="bi bi-inbox fs-1 text-muted d-block mb-2"></i>No category suggestions pending. Sellers can suggest new categories from their dashboard.</td></tr>`;
        return;
    }

    tbody.innerHTML = pendingCats.map(cat => {
        const sourceHtml = cat.source === 'seller'
            ? `<span class="status-pill status-processing" style="font-size:10px;"><i class="bi bi-shop me-1"></i>Seller</span>`
            : `<span class="status-pill status-active" style="font-size:10px;"><i class="bi bi-shield-check me-1"></i>Admin</span>`;

        const suggestedBy = cat.suggestedBy
            ? (() => {
                const users = getLS(KEY_USERS) || [];
                const u = users.find(u => String(u.id) === String(cat.suggestedBy));
                const name = u ? (u.storeName || u.name || u.email || cat.suggestedBy) : cat.suggestedBy;
                return `<small style="color:var(--text-muted);">${escapeHTML(name)}</small>`;
              })()
            : `<small style="color:var(--text-muted);">Admin</small>`;

        const dateStr = cat.createdAt
            ? new Date(cat.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : escapeHTML(cat.updated || '—');

        return `
        <tr>
            <td>
                <div class="fw-semibold">${escapeHTML(cat.name)}</div>
                ${cat.description ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${escapeHTML(cat.description.slice(0,60))}${cat.description.length>60?'…':''}</div>` : ''}
            </td>
            <td>${escapeHTML(cat.description || '—')}</td>
            <td>${sourceHtml}</td>
            <td>${suggestedBy}</td>
            <td><small style="color:var(--text-muted);">${dateStr}</small></td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center flex-nowrap">
                    <button class="btn-action btn-success" data-id="${cat.id}" data-action="approve-cat" title="Approve"><i class="bi bi-check-lg"></i></button>
                    <button class="btn-action btn-edit" data-id="${cat.id}" data-action="edit-approve-cat" title="Edit & Approve"><i class="bi bi-pencil"></i></button>
                    <button class="btn-action btn-delete" data-id="${cat.id}" data-action="reject-cat" title="Reject"><i class="bi bi-x-lg"></i></button>
                </div>
            </td>
        </tr>`; }).join('');
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
    // Reset fields
    const nameInput = document.getElementById('newCategoryName');
    const descInput = document.getElementById('newCategoryDesc');
    
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (nameInput) nameInput.classList.remove('is-invalid');

    // Bind save button if not already bound
    const saveBtn = document.getElementById('saveNewCategoryBtn');
    if (saveBtn && !saveBtn.hasAttribute('data-bound')) {
        saveBtn.addEventListener('click', saveNewCategory);
        saveBtn.setAttribute('data-bound', 'true');
    }

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
                const products = getLS(KEY_PRODUCTS) || [];
                const affectedCount = products.filter(p =>
                    p.category === cat.name || p.productCategory === cat.name
                ).length;

                const warningText = affectedCount > 0
                    ? `\n\n⚠️ ${affectedCount} product(s) reference this category. They will be set to "Uncategorized".`
                    : '';

                showConfirm(
                    `Delete category "${cat.name}"?${warningText}`,
                    () => {
                        categories.splice(idx, 1);
                        setLS(KEY_CATEGORIES, categories);

                        if (affectedCount > 0) {
                            const updatedProducts = products.map(p => {
                                if (p.category === cat.name || p.productCategory === cat.name) {
                                    return { ...p, category: 'Uncategorized', productCategory: 'Uncategorized' };
                                }
                                return p;
                            });
                            saveProducts(updatedProducts);
                        }

                        showToast(`Category deleted.${affectedCount > 0 ? ` ${affectedCount} product(s) set to Uncategorized.` : ''}`, 'success');
                        renderCategoryRequestsTable();
                        renderAllCategoriesTable();
                    }
                );
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

        // Clone to remove any previously stacked listeners
        const newTabSuggestions = tabSuggestions.cloneNode(true);
        const newTabAll = tabAll.cloneNode(true);
        tabSuggestions.replaceWith(newTabSuggestions);
        tabAll.replaceWith(newTabAll);

        newTabSuggestions.onclick = () => activateTab('suggestions');
        newTabAll.onclick = () => activateTab('all');
    }
}

// Expose for modal buttons and HTML onclick handlers
window.saveEditCategoryAndApprove = saveEditCategoryAndApprove;
window.openAddCategoryModal = openAddCategoryModal;
window.saveNewCategory = saveNewCategory;
window.submitAddCategory = saveNewCategory; // Alias for HTML onclick
