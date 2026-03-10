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
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No category suggestions pending.</td></tr>`;
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
                // We use a simple JS prompt for quick editing
                const newName = prompt("Edit category name before approving:", categories[catIndex].name);
                if (newName && newName.trim()) {
                    categories[catIndex].name = newName.trim();
                    categories[catIndex].visibility = 'active';
                    saveCategories(categories);
                    showToast(`Category updated to "${newName.trim()}" and approved!`, 'success');
                    renderCategoryRequestsTable();
                }
            }
        };
    }
}
