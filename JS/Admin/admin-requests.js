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
    formatDate,
    getCustomerName,
    getCustomerEmail,
    positionDropdown,
    getCustomerByEmail
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

    tbody.innerHTML = requests.map(req => {
        let name = getCustomerName(req.userId);
        if (name === '—') {
            const u = getCustomerByEmail(req.email);
            name = u ? (u.name || u.fullName || '—') : '—';
        }
        name = escapeHTML(name);
        const email = escapeHTML(req.email || getCustomerEmail(req.userId));

        const storeName   = escapeHTML(req.storeName   || '—');
        const city        = escapeHTML(req.city        || '—');
        const category    = escapeHTML(req.category    || '—');
        const phone       = escapeHTML(req.phone       || '—');
        const payment     = escapeHTML(req.paymentMethod || '—');
        const description = escapeHTML(req.description  || '—');
        const dateStr     = req.createdAt ? formatDate(req.createdAt) : '—';

        // Truncate long descriptions with a title tooltip
        const descPreview = (req.description || '').length > 40
            ? escapeHTML(req.description.slice(0, 40)) + '…'
            : description;

        return `
        <tr>
            <td class="col-check" data-label="">
                <input type="checkbox" class="request-check-item" value="${escapeHTML(req.id)}">
            </td>

            <td data-label="Store">
                <div class="req-store-cell">
                    <div class="req-store-icon"><i class="bi bi-shop"></i></div>
                    <div>
                        <div class="req-store-name">${storeName}</div>
                        <div class="req-store-city"><i class="bi bi-geo-alt"></i> ${city}</div>
                    </div>
                </div>
            </td>

            <td data-label="Applicant">
                <div class="req-user-cell">
                    <div class="req-user-avatar">${name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="req-user-name">${name}</div>
                        <div class="req-user-email">${email}</div>
                        <div class="req-user-phone"><i class="bi bi-telephone"></i> ${phone}</div>
                    </div>
                </div>
            </td>

            <td data-label="Category">
                <span class="req-cat-pill">${category}</span>
            </td>

            <td data-label="Payment">
                <span class="req-payment-pill"><i class="bi bi-credit-card"></i> ${payment}</span>
            </td>

            <td data-label="Description" class="priority-low">
                <span class="req-desc" title="${description}">${descPreview}</span>
            </td>

            <td data-label="Date" class="priority-low">
                <span class="req-date">${dateStr}</span>
            </td>

            <td data-label="Actions" class="col-actions">
                <div class="req-action-group">
                    <button class="req-btn-approve" data-id="${req.id}" data-action="approve">
                        <i class="bi bi-check-lg"></i> Approve
                    </button>
                    <button class="req-btn-reject" data-id="${req.id}" data-action="reject">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
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

    if (tbody && !tbody._dropdownBound) {
        tbody._dropdownBound = true;
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.um-btn-more');
            if (!btn) return;
            e.stopPropagation();
            const wrap = btn.closest('.um-overflow-wrap');
            const dropdown = wrap?.querySelector('.um-dropdown');
            if (!dropdown) return;
            const isOpen = dropdown.classList.contains('open');
            document.querySelectorAll('.um-dropdown.open').forEach(d => {
                d.classList.remove('open');
                d.closest('.um-overflow-wrap')?.querySelector('.um-btn-more')?.setAttribute('aria-expanded','false');
            });
            if (!isOpen) { dropdown.classList.add('open'); positionDropdown(btn, dropdown); btn.setAttribute('aria-expanded','true'); }
        });
        if (!window._requestsDropdownListenerAdded) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.um-dropdown.open').forEach(d => {
                    d.classList.remove('open');
                    d.closest('.um-overflow-wrap')?.querySelector('.um-btn-more')?.setAttribute('aria-expanded','false');
                });
            });
            window._requestsDropdownListenerAdded = true;
        }
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