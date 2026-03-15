// ============================================================
// admin-requests.js
// Handles the Seller Requests section — table, approve, reject.
// Depends on: admin-helpers.js, Auth.js
// ============================================================

import {
    getAllCustomerToApproved,
    acceptCustomerSellerRequest,
    rejectCustomerSellerRequest
} from '../Core/Auth.js';

import { getLS, setLS } from '../Core/Storage.js';
import { KEY_APPROVAL, KEY_SELLER_OUTCOMES } from '../Core/Constants.js';

import {
    showToast,
    showConfirm,
    escapeHTML,
    getCustomerName,
    getCustomerEmail
} from './admin-helpers.js';

import { logAdminAction } from './admin-profile.js';

/**
 * Main entry point for the seller requests section.
 * Called every time the user clicks "Seller Requests" in the sidebar.
 */
export function renderRequests() {
    renderRequestsTable();
    bindRequestsEvents();
}

/**
 * Renders the pending seller requests table.
 */
export function renderRequestsTable() {
    const requests = getAllCustomerToApproved();
    const tbody = document.getElementById('requestsTableBody');
    const countEl = document.getElementById('requestsCount');
    const selectAll = document.getElementById('selectAllRequests');

    if (!tbody) return;

    // Reset select all checkbox
    if (selectAll) selectAll.checked = false;

    // Update count label
    if (countEl) {
        countEl.textContent = requests.length === 0
            ? 'No pending applications'
            : `${requests.length} pending application${requests.length !== 1 ? 's' : ''}`;
    }

    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="bi bi-check-circle fs-1 text-success d-block mb-2"></i>
                    <strong>All caught up!</strong> No pending seller applications.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = requests.map(req => `
        <tr>
            <td>
                <input type="checkbox" class="request-check-item" value="${escapeHTML(req.id)}">
            </td>
            <td><strong>${escapeHTML(req.storeName)}</strong></td>
            <td>
                <div class="d-flex flex-column">
                    <span>${getCustomerName(req.userId)}</span>
                    <small class="text-muted">${getCustomerEmail(req.userId)}</small>
                </div>
            </td>
            <td>${escapeHTML(req.city)}</td>
            <td>${escapeHTML(req.category)}</td>
            <td>${escapeHTML(req.phone)}</td>
            <td>${escapeHTML(req.paymentMethod)}</td>
            <td class="text-center">
                <div class="d-flex gap-2 justify-content-center">
                    <button class="btn-action btn-edit" data-id="${req.id}" data-action="approve">
                        <i class="bi bi-check-lg"></i> Approve
                    </button>
                    <button class="btn-action btn-delete" data-id="${req.id}" data-action="reject">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Binds events for the requests section.
 */
function bindRequestsEvents() {
    // Select All logic
    const selectAll = document.getElementById('selectAllRequests');
    if (selectAll) {
        selectAll.onclick = () => {
            const checks = document.querySelectorAll('.request-check-item');
            checks.forEach(c => c.checked = selectAll.checked);
        };
    }

    // Action buttons (Approve/Reject)
    const tbody = document.getElementById('requestsTableBody');
    if (tbody) {
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'approve') {
                showConfirm(`Approve this seller application?`, () => {
                    acceptCustomerSellerRequest(id);
                    const requests = getAllCustomerToApproved();
                    const req = requests.find(r => r.id === id); // Re-find if needed for logging
                    if (req) {
                        logAdminAction('approved_seller', req.storeName || req.fullName || 'Unknown', id);
                    }
                    showToast('Seller request approved!', 'success');
                    renderRequests();
                    // Update main panel badges
                    if (window.updateSidebarBadges) window.updateSidebarBadges();
                });
            } else if (action === 'reject') {
                showConfirm(`Reject and delete this application?`, () => {
                    const requests = getAllCustomerToApproved();
                    const req = requests.find(r => r.id === id);
                    rejectCustomerSellerRequest(id);
                    if (req) {
                        logAdminAction('rejected_seller', req.storeName || req.fullName || 'Unknown', id);
                    }
                    showToast('Application rejected.', 'error');
                    renderRequests();
                    // Update main panel badges
                    if (window.updateSidebarBadges) window.updateSidebarBadges();
                });
            }
        };
    }

    // Bulk actions
    const bulkApprove = document.getElementById('bulkApproveBtn');
    if (bulkApprove) {
        bulkApprove.onclick = () => {
            const selected = Array.from(document.querySelectorAll('.request-check-item:checked')).map(c => c.value);
            if (selected.length === 0) return showToast('Please select at least one request', 'warning');

            showConfirm(`Approve ${selected.length} selected applications?`, () => {
                selected.forEach(id => acceptCustomerSellerRequest(id));
                showToast('Selected applications approved!', 'success');
                renderRequests();
                if (window.updateSidebarBadges) window.updateSidebarBadges();
            });
        };
    }

    const bulkReject = document.getElementById('bulkRejectBtn');
    if (bulkReject) {
        bulkReject.onclick = () => {
            const selected = Array.from(document.querySelectorAll('.request-check-item:checked')).map(c => c.value);
            if (selected.length === 0) return showToast('Please select at least one request', 'warning');

            showConfirm(`Reject and delete ${selected.length} selected applications?`, () => {
                selected.forEach(id => rejectCustomerSellerRequest(id));
                showToast('Selected applications rejected.', 'error');
                renderRequests();
                if (window.updateSidebarBadges) window.updateSidebarBadges();
            });
        };
    }
}
