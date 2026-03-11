// ============================================================
// admin-categories.js
// Handles Category Suggestions from Sellers
// Depends on: admin-helpers.js, Constants.js
// ============================================================

import { KEY_CATEGORIES } from '../Core/Constants.js';
import { showToast, showConfirm, escapeHTML } from './admin-helpers.js';

/**
 * Main entry point for category requests.
 */
export function renderCategories() {
    renderCategoryRequestsTable();
    renderAllCategoriesTable();
    bindCategoryEvents();
}

/**
 * Utility to safely load categories from LocalStorage
 */
function getCategories() {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY_CATEGORIES));
        if (Array.isArray(parsed)) return parsed;
    } catch (e) { }
    return [];
}

/**
 * Utility to save categories back
 */
function saveCategories(cats) {
    localStorage.setItem(KEY_CATEGORIES, JSON.stringify(cats));
}

/**
 * Renders the table of all categories (active, hidden, draft)
 */
function renderAllCategoriesTable() {
    const categories = getCategories();
    const tbody = document.getElementById('allCategoriesTableBody');
    if (!tbody) return;

    if (!categories.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="bi bi-collection fs-1 text-muted d-block mb-2"></i>
                    No categories found. Sellers can suggest new ones from their dashboard.
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
            <td><strong>${escapeHTML(cat.name || '')}</strong></td>
            <td>${typeof cat.products === 'number' ? cat.products : 0}</td>
            <td>${visibilityBadge(cat.visibility)}</td>
            <td>${escapeHTML(cat.updated || '—')}</td>
            <td class="text-center">
                <div class="d-flex gap-2 justify-content-center flex-wrap">
                    <button class="btn-action btn-edit" data-id="${cat.id}" data-action="edit-cat" title="Edit name & description">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    ${cat.visibility !== 'active' ? `
                    <button class="btn-action btn-success" data-id="${cat.id}" data-action="set-active" title="Set Active">
                        <i class="bi bi-eye"></i> Activate
                    </button>` : ''}
                    ${cat.visibility !== 'hidden' ? `
                    <button class="btn-action btn-warn" data-id="${cat.id}" data-action="set-hidden" title="Hide from storefront">
                        <i class="bi bi-eye-slash"></i> Hide
                    </button>` : ''}
                    ${cat.visibility !== 'draft' ? `
                    <button class="btn-action btn-view" data-id="${cat.id}" data-action="set-draft" title="Mark as draft">
                        <i class="bi bi-file-earmark-text"></i> Draft
                    </button>` : ''}
                    <button class="btn-action btn-delete" data-id="${cat.id}" data-action="delete-cat" title="Delete category">
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
    const categories = getCategories();
    // 'draft' visibility is used for pending approval from sellers
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

    const wasDraft = categories[idx].visibility === 'draft';

    categories[idx].name = name;
    categories[idx].description = description;
    if (wasDraft) {
        categories[idx].visibility = 'active';
    }
    saveCategories(categories);

    bootstrap.Modal.getInstance(document.getElementById('editCategoryModal')).hide();
    showToast(`Category "${name}" updated${wasDraft ? ' and approved' : ''}!`, 'success');
    renderCategoryRequestsTable();
    renderAllCategoriesTable();
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
            const categories = getCategories();
            const catIndex = categories.findIndex(c => c.id === id);

            if (catIndex === -1) return;

            if (action === 'approve-cat') {
                showConfirm(`Approve category "${categories[catIndex].name}"? It will go live immediately.`, () => {
                    categories[catIndex].visibility = 'active';
                    saveCategories(categories);
                    showToast('Category approved successfully!', 'success');
                    renderCategoryRequestsTable();
                });
            } else if (action === 'reject-cat') {
                showConfirm(`Reject and delete category suggestion "${categories[catIndex].name}"?`, () => {
                    categories.splice(catIndex, 1);
                    saveCategories(categories);
                    showToast('Category suggestion rejected.', 'error');
                    renderCategoryRequestsTable();
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
            const categories = getCategories();
            const idx = categories.findIndex(c => c.id === id);
            if (idx === -1) return;

            const cat = categories[idx];

            if (action === 'edit-cat') {
                openEditCategoryModal(cat);
            } else if (action === 'set-active') {
                showConfirm(`Set category "${cat.name}" to Active?`, () => {
                    categories[idx].visibility = 'active';
                    saveCategories(categories);
                    showToast('Category set to Active.', 'success');
                    renderCategoryRequestsTable();
                    renderAllCategoriesTable();
                });
            } else if (action === 'set-hidden') {
                showConfirm(`Hide category "${cat.name}" from storefront?`, () => {
                    categories[idx].visibility = 'hidden';
                    saveCategories(categories);
                    showToast('Category hidden from storefront.', 'warning');
                    renderCategoryRequestsTable();
                    renderAllCategoriesTable();
                });
            } else if (action === 'set-draft') {
                showConfirm(`Mark category "${cat.name}" as Draft?`, () => {
                    categories[idx].visibility = 'draft';
                    saveCategories(categories);
                    showToast('Category marked as Draft.', 'info');
                    renderCategoryRequestsTable();
                    renderAllCategoriesTable();
                });
            } else if (action === 'delete-cat') {
                showConfirm(`Delete category "${cat.name}"? Products using this category will keep the old name.`, () => {
                    categories.splice(idx, 1);
                    saveCategories(categories);
                    showToast('Category deleted.', 'error');
                    renderCategoryRequestsTable();
                    renderAllCategoriesTable();
                });
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

// Expose for modal button
window.saveEditCategoryAndApprove = saveEditCategoryAndApprove;
