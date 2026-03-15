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

import {
    showToast,
    showConfirm,
    escapeHTML,
    getCustomerName,
    getCustomerEmail
} from './admin-helpers.js';

import { logAdminAction } from './admin-profile.js';
import { initUsers } from '../Core/Storage.js';

/**
 * Main entry point for the seller requests section.
 * Called every time the user clicks "Seller Requests" in the sidebar.
 */
export async function renderRequests() {
    await initUsers(); 
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
            <tr><td colspan="9">
                <div style="text-align:center;padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:8px;">
                    <i class="bi bi-check-circle" style="font-size:2.5rem;color:var(--text-muted);opacity:0.35;"></i>
                    <p style="font-weight:700;font-size:14px;color:var(--text-primary);margin:0;">All caught up!</p>
                    <p style="font-size:12px;color:var(--text-muted);margin:0;">No pending seller applications.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(req => {
        const customerName  = getCustomerName(req.userId);
        const customerEmail = getCustomerEmail(req.userId);
        const initial       = customerName.charAt(0).toUpperCase();
        const dateStr       = req.createdAt
            ? new Date(req.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : '—';
        const descPreview   = req.description
            ? escapeHTML(req.description.slice(0, 45)) + (req.description.length > 45 ? '…' : '')
            : '—';

        return `
        <tr>
            <td style="width:40px;padding:0 8px;">
                <input type="checkbox" class="form-check-input request-check-item" value="${escapeHTML(req.id)}">
            </td>
            <td><strong>${escapeHTML(req.storeName)}</strong></td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <span class="table-avatar customer-avatar" style="width:32px;height:32px;font-size:11px;">${initial}</span>
                    <div>
                        <div class="fw-semibold" style="font-size:12px;">${escapeHTML(customerName)}</div>
                        <div style="font-size:11px;color:var(--text-muted);">${escapeHTML(customerEmail)}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHTML(req.city)}</td>
            <td>${escapeHTML(req.category)}</td>
            <td>${escapeHTML(req.paymentMethod)}</td>
            <td>
                <span title="${escapeHTML(req.description || '')}" style="cursor:help;border-bottom:1px dashed var(--border);font-size:12px;color:var(--text-muted);">
                    ${descPreview}
                </span>
            </td>
            <td><small style="color:var(--text-muted);">${dateStr}</small></td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center flex-nowrap">
                    <button class="btn-action btn-success" data-id="${req.id}" data-action="approve" title="Approve"><i class="bi bi-check-lg"></i></button>
                    <button class="btn-action btn-delete" data-id="${req.id}" data-action="reject" title="Reject"><i class="bi bi-x-lg"></i></button>
                </div>
            </td>
        </tr>`; }).join('');
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

    // Individual checkbox → update selectAll indeterminate state
    const tbody = document.getElementById('requestsTableBody');
    if (tbody) {
        tbody.addEventListener('change', (e) => {
            if (e.target.classList.contains('request-check-item')) {
                const all     = document.querySelectorAll('.request-check-item');
                const checked = document.querySelectorAll('.request-check-item:checked');
                const sa      = document.getElementById('selectAllRequests');
                if (sa) {
                    sa.indeterminate = checked.length > 0 && checked.length < all.length;
                    sa.checked       = checked.length === all.length && all.length > 0;
                }
            }
        });

        // Action buttons (Approve/Reject)
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'approve') {
                showConfirm(`Approve this seller application?`, () => {
                    // 1. Get request data FIRST before it gets deleted
                    const allRequests = getAllCustomerToApproved();
                    const req = allRequests.find(r => r.id === id);

                    // 2. Now accept (removes request from list)
                    acceptCustomerSellerRequest(id);

                    // 3. Log with data we captured before deletion
                    if (req) {
                        logAdminAction('approved_seller', req.storeName || req.fullName || 'Unknown Store', id);
                    }
                    showToast('Seller request approved!', 'success');
                    renderRequests();
                    if (window.updateSidebarBadges) window.updateSidebarBadges();
                });
            } else if (action === 'reject') {
                showConfirm(`Reject and delete this application?`, () => {
                    // 1. Get data FIRST
                    const allRequests = getAllCustomerToApproved();
                    const req = allRequests.find(r => r.id === id);

                    // 2. Reject
                    rejectCustomerSellerRequest(id);

                    // 3. Log
                    if (req) {
                        logAdminAction('rejected_seller', req.storeName || req.fullName || 'Unknown Store', id);
                    }
                    showToast('Application rejected.', 'error');
                    renderRequests();
                    if (window.updateSidebarBadges) window.updateSidebarBadges();
                });
            }
        };
    }

    // Bulk actions
    const bulkApprove = document.getElementById('bulkApproveBtn');
    if (bulkApprove) {
        bulkApprove.onclick = async () => {
            const selected = Array.from(document.querySelectorAll('.request-check-item:checked')).map(c => c.value);
            if (selected.length === 0) return showToast('Please select at least one request.', 'warning');

            showConfirm(`Approve ${selected.length} selected application(s)?`, async () => {
                let succeeded = 0;
                let failed    = 0;

                for (const id of selected) {
                    try {
                        const allReqs = getAllCustomerToApproved();
                        const req     = allReqs.find(r => r.id === id);
                        acceptCustomerSellerRequest(id);
                        if (req) logAdminAction('approved_seller', req.storeName || 'Unknown', id);
                        succeeded++;
                    } catch (err) {
                        console.error(`[REQUESTS] Failed to approve ${id}:`, err);
                        failed++;
                    }
                }

                if (failed > 0) {
                    showToast(`${succeeded} approved, ${failed} failed.`, 'warning');
                } else {
                    showToast(`${succeeded} application(s) approved!`, 'success');
                }

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
