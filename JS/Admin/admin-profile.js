// ============================================================
// admin-profile.js
// Profile dropdown, edit profile, change password, activity log.
//
// FIX: saveProfileChanges() and savePasswordChange() now use
//      updateItem() → PUT to MockAPI instead of setLS(KEY_USERS)
//      which was causing full array POST → duplicates.
// ============================================================

import { getLS, setLS, updateItem } from '../Core/Storage.js';
import { KEY_USERS, KEY_CURRENT_USER, KEY_APPROVAL, KEY_CATEGORIES } from '../Core/Constants.js';
import { showToast, formatDate } from './admin-helpers.js';

let currentAdmin = null;


// ─── INIT ────────────────────────────────────────────────────

export function initAdminProfile() {
    currentAdmin = getLS(KEY_CURRENT_USER);
    if (!currentAdmin) return;

    setupProfileDropdown();
    setupChangePasswordModal();
    setupProfileModal();
    updateTopbarProfile();
    updateSidebarBadges();
}


// ─── SIDEBAR BADGES ──────────────────────────────────────────

export function updateSidebarBadges() {
    const requests        = getLS(KEY_APPROVAL) || [];
    const pendingRequests = requests.filter(r => r.status === 'pending').length;

    const categories        = getLS(KEY_CATEGORIES) || [];
    const pendingCategories = categories.filter(
        c => c.visibility === 'draft'
    ).length;

    const setBadge = (id, count) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (count > 0) {
            el.textContent = count > 99 ? '99+' : count;
            el.classList.remove('d-none');
        } else {
            el.classList.add('d-none');
        }
    };

    setBadge('requestsBadge',   pendingRequests);
    setBadge('categoriesBadge', pendingCategories);
}


// ─── PROFILE DROPDOWN ────────────────────────────────────────

function setupProfileDropdown() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    // Remove any existing dropdown to avoid duplicates
    topbarRight.querySelector('.topbar-profile-dropdown')?.remove();

    const profileDropdown = document.createElement('div');
    profileDropdown.className = 'topbar-profile-dropdown';
    profileDropdown.innerHTML = `
        <div class="profile-trigger" id="profileTrigger">
            <div class="profile-avatar" id="topbarProfileAvatar">
                ${getInitials(currentAdmin.fullName || currentAdmin.name || 'A')}
            </div>
            <div class="profile-info">
                <div class="profile-name" id="topbarProfileName">
                    ${currentAdmin.fullName || currentAdmin.name || 'Admin'}
                </div>
                <div class="profile-role">${currentAdmin.role || 'admin'}</div>
            </div>
            <i class="bi bi-chevron-down profile-arrow"></i>
        </div>
        <div class="profile-dropdown-menu" id="profileDropdownMenu">
            <div class="dropdown-item" data-action="profile">
                <i class="bi bi-person"></i>
                <span>My Profile</span>
            </div>
            <div class="dropdown-item" data-action="change-password">
                <i class="bi bi-lock"></i>
                <span>Change Password</span>
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" data-action="logout">
                <i class="bi bi-box-arrow-right"></i>
                <span>Logout</span>
            </div>
        </div>`;

    // Insert before logout button
    const logoutBtn = topbarRight.querySelector('#logoutBtn');
    if (logoutBtn) {
        topbarRight.insertBefore(profileDropdown, logoutBtn);
        logoutBtn.style.display = 'none';
    } else {
        topbarRight.appendChild(profileDropdown);
    }

    // Toggle dropdown
    const trigger = document.getElementById('profileTrigger');
    const menu    = document.getElementById('profileDropdownMenu');

    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    // Use a named handler stored on the element to prevent stacking
    if (profileDropdown._docClickHandler) {
        document.removeEventListener('click', profileDropdown._docClickHandler);
    }
    profileDropdown._docClickHandler = () => menu?.classList.remove('show');
    document.addEventListener('click', profileDropdown._docClickHandler);

    menu?.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.closest('.dropdown-item')?.dataset.action;
        if (action === 'profile')         openProfileModal();
        if (action === 'change-password') openChangePasswordModal();
        if (action === 'logout')          handleLogout();
        menu.classList.remove('show');
    });
}

function getInitials(fullName) {
    if (!fullName) return 'A';
    return (fullName || '')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
}

function updateTopbarProfile() {
    const nameEl = document.querySelector('.profile-name');
    if (nameEl && currentAdmin) {
        nameEl.textContent = currentAdmin.fullName || currentAdmin.name || 'Admin';
    }
}


// ─── CHANGE PASSWORD MODAL ───────────────────────────────────

function setupChangePasswordModal() {
    if (document.getElementById('changePasswordModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="changePasswordModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-lock"></i> Change Password
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="changePasswordForm" novalidate>
                            <div class="mb-3">
                                <label class="form-label">Current Password</label>
                                <input type="password" class="form-control"
                                    id="currentPassword" required>
                                <div class="invalid-feedback" id="currentPasswordError"></div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">New Password</label>
                                <input type="password" class="form-control"
                                    id="newPassword" minlength="6" required>
                                <div class="invalid-feedback" id="newPasswordError"></div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Confirm New Password</label>
                                <input type="password" class="form-control"
                                    id="confirmPassword" required>
                                <div class="invalid-feedback" id="confirmPasswordError"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary"
                            data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn-primary-green"
                            id="savePasswordBtn">Change Password</button>
                    </div>
                </div>
            </div>
        </div>`);

    document.getElementById('savePasswordBtn')
        ?.addEventListener('click', savePasswordChange);
}

function openChangePasswordModal() {
    document.getElementById('changePasswordForm')?.reset();
    document.querySelectorAll('#changePasswordModal .invalid-feedback')
        .forEach(el => el.textContent = '');
    document.querySelectorAll('#changePasswordModal .form-control')
        .forEach(el => el.classList.remove('is-invalid'));
    new bootstrap.Modal(document.getElementById('changePasswordModal')).show();
}

/**
 * FIX: Was calling setLS(KEY_USERS, fullArray) → POST duplicates.
 *      Now uses updateItem() → PUT for just the admin user.
 */
function savePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword     = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Clear previous errors
    document.querySelectorAll('#changePasswordModal .invalid-feedback')
        .forEach(el => el.textContent = '');
    document.querySelectorAll('#changePasswordModal .form-control')
        .forEach(el => el.classList.remove('is-invalid'));

    let hasErrors = false;

    if (currentPassword !== currentAdmin.password) {
        showFieldError('currentPassword', 'Current password is incorrect.');
        hasErrors = true;
    }
    if (newPassword.length < 6) {
        showFieldError('newPassword', 'Password must be at least 6 characters.');
        hasErrors = true;
    }
    if (newPassword !== confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match.');
        hasErrors = true;
    }
    if (newPassword === currentPassword && !hasErrors) {
        showFieldError('newPassword', 'New password must be different from current.');
        hasErrors = true;
    }
    if (hasErrors) return;

    const now = new Date().toISOString();

    // FIX: updateItem → PUT to MockAPI for just this user (no duplicates)
    updateItem(KEY_USERS, currentAdmin.id, {
        password:          newPassword,
        passwordChangedAt: now
    });

    // Update session
    currentAdmin.password          = newPassword;
    currentAdmin.passwordChangedAt = now;
    setLS(KEY_CURRENT_USER, currentAdmin);

    showToast('Password changed successfully!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'))?.hide();
    document.getElementById('changePasswordForm')?.reset();
}

window.savePasswordChange = savePasswordChange;


// ─── PROFILE MODAL ───────────────────────────────────────────

function setupProfileModal() {
    if (document.getElementById('profileModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="profileModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-person-circle"></i> Admin Profile
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <h6 class="section-heading mb-3">
                            <i class="bi bi-person"></i> Personal Information
                        </h6>
                        <form id="profileForm" class="mb-4">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">Full Name</label>
                                    <input type="text" class="form-control" id="profileFullName">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Email Address</label>
                                    <input type="email" class="form-control" id="profileEmail"
                                        readonly>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Role</label>
                                    <input type="text" class="form-control"
                                        value="Admin 🔒" readonly>
                                </div>
                            </div>
                        </form>

                        <h6 class="section-heading mb-3">
                            <i class="bi bi-shield"></i> Security Information
                        </h6>
                        <div class="row g-3 mb-4">
                            <div class="col-md-4">
                                <label class="form-label text-muted small">Member Since</label>
                                <div class="fw-bold" id="memberSince">—</div>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label text-muted small">Last Login</label>
                                <div class="fw-bold" id="lastLogin">—</div>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label text-muted small">Password Changed</label>
                                <div class="fw-bold" id="passwordChanged">—</div>
                            </div>
                        </div>

                        <h6 class="section-heading mb-3">
                            <i class="bi bi-clock-history"></i> Recent Activity
                        </h6>
                        <div class="activity-log" id="activityLog"
                            style="max-height:300px;overflow-y:auto;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary"
                            data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn-primary-green"
                            id="saveProfileBtn" disabled>Save Changes</button>
                    </div>
                </div>
            </div>
        </div>`);
}

function openProfileModal() {
    const modal = new bootstrap.Modal(document.getElementById('profileModal'));

    const originalName = currentAdmin.fullName || currentAdmin.name || '';

    // Populate fields
    document.getElementById('profileFullName').value = originalName;
    document.getElementById('profileEmail').value    = currentAdmin.email || '';
    document.getElementById('memberSince').textContent     = formatDate(currentAdmin.createdAt);
    document.getElementById('lastLogin').textContent       = currentAdmin.lastLoginAt
        ? formatDate(currentAdmin.lastLoginAt) : 'Not recorded yet';
    document.getElementById('passwordChanged').textContent = currentAdmin.passwordChangedAt
        ? formatDate(currentAdmin.passwordChangedAt) : 'Never changed';

    // ── Clean up stale listeners by replacing both elements ──
    const oldInput  = document.getElementById('profileFullName');
    const oldBtn    = document.getElementById('saveProfileBtn');

    const newInput = oldInput.cloneNode(true);
    const newBtn   = oldBtn.cloneNode(true);

    oldInput.replaceWith(newInput);
    oldBtn.replaceWith(newBtn);

    // Set value on the fresh input
    newInput.value    = originalName;
    newBtn.disabled   = true;

    // Wire up enable/disable logic
    newInput.addEventListener('input', () => {
        const val = newInput.value.trim();
        newBtn.disabled = !val || val === originalName;
    });

    // Wire up save
    newBtn.addEventListener('click', () => {
        const newFullName = newInput.value.trim();
        if (!newFullName) {
            showToast('Full name is required.', 'error');
            return;
        }

        updateItem(KEY_USERS, currentAdmin.id, { fullName: newFullName, name: newFullName });

        currentAdmin.fullName = newFullName;
        currentAdmin.name     = newFullName;
        setLS(KEY_CURRENT_USER, currentAdmin);

        updateAdminNameEverywhere(newFullName);
        showToast('Profile updated successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('profileModal'))?.hide();
    });

    populateActivityLog();
    modal.show();
}

/**
 * Exposed for external calls if needed.
 */
function saveProfileChanges() {
    const newInput = document.getElementById('profileFullName');
    const newFullName = newInput ? newInput.value.trim() : '';

    if (!newFullName) {
        showToast('Full name is required.', 'error');
        return;
    }

    updateItem(KEY_USERS, currentAdmin.id, { fullName: newFullName, name: newFullName });

    currentAdmin.fullName = newFullName;
    currentAdmin.name     = newFullName;
    setLS(KEY_CURRENT_USER, currentAdmin);

    updateAdminNameEverywhere(newFullName);
    showToast('Profile updated successfully!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('profileModal'))?.hide();
}

window.saveProfileChanges = saveProfileChanges;


// ─── UPDATE NAME EVERYWHERE ───────────────────────────────────

/**
 * Updates admin name in all 5 UI locations simultaneously.
 * Called on save and also exported for admin-panel.js to use on load.
 */
export function updateAdminNameEverywhere(newName) {
    if (!newName || !newName.trim()) return;
    // Normalize: capitalize first letter of each word, lowercase the rest
    const clean = newName.trim()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    const initials = clean.split(' ')
        .map(w => w.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);

    // Always query fresh — never cache element references
    document.getElementById('adminUserName')          && (document.getElementById('adminUserName').textContent          = clean);
    document.getElementById('topbarProfileName')      && (document.getElementById('topbarProfileName').textContent      = clean);
    document.getElementById('topbarProfileAvatar')    && (document.getElementById('topbarProfileAvatar').textContent    = initials);
    document.getElementById('sidebarUserName')        && (document.getElementById('sidebarUserName').textContent        = clean);
    document.getElementById('sidebarUserAvatar')      && (document.getElementById('sidebarUserAvatar').textContent      = clean.charAt(0).toUpperCase());

    // Also update by class — fallback in case IDs not set
    document.querySelector('.profile-name')   && (document.querySelector('.profile-name').textContent   = clean);
    document.querySelector('.profile-avatar') && (document.querySelector('.profile-avatar').textContent = initials);

    // Persist to session
    const current = getLS(KEY_CURRENT_USER);
    if (current && current.id) {
        current.fullName = clean;
        current.name     = clean;
        setLS(KEY_CURRENT_USER, current);
    }
}


// ─── ACTIVITY LOG ────────────────────────────────────────────

function populateActivityLog() {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;
    const actions = currentAdmin.actionsLog || [];

    if (actions.length === 0) {
        activityLog.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-clock-history" style="font-size:2rem;opacity:0.3;display:block;"></i>
                <p class="mb-0 mt-2 small">No recent activity recorded.</p>
            </div>`;
        return;
    }

    activityLog.innerHTML = actions.slice(0, 10).map(action => `
        <div class="activity-item d-flex align-items-center gap-3 p-3 border-bottom">
            <div class="activity-icon">${getActionIcon(action.action)}</div>
            <div class="flex-grow-1">
                <div class="activity-description fw-semibold small">
                    ${getActionDescription(action)}
                </div>
                <div class="activity-time text-muted" style="font-size:11px">
                    ${formatDate(action.timestamp)}
                </div>
            </div>
        </div>`).join('');
}

function getActionIcon(action) {
    const icons = {
        approved_seller:       '✅',
        rejected_seller:       '❌',
        deleted_user:          '🗑️',
        reset_password:        '🔑',
        deleted_product:       '📦',
        deactivated_product:   '🚫',
        changed_order_status:  '🧾'
    };
    return icons[action] || '⚙️';
}

function getActionDescription(action) {
    const descriptions = {
        approved_seller:      `Approved seller: ${action.target}`,
        rejected_seller:      `Rejected seller: ${action.target}`,
        deleted_user:         `Deleted user: ${action.target}`,
        reset_password:       `Reset password for: ${action.target}`,
        deleted_product:      `Deleted product: ${action.target}`,
        deactivated_product:  `Deactivated product: ${action.target}`,
        changed_order_status: `Changed order status: ${action.target}`
    };
    return descriptions[action.action] || `Action on: ${action.target}`;
}


function showFieldError(fieldId, message) {
    const field   = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    if (field)   field.classList.add('is-invalid');
    if (errorEl) errorEl.textContent = message;
}


// ─── LOGOUT ──────────────────────────────────────────────────

function handleLogout() {
    localStorage.removeItem(KEY_CURRENT_USER);
    sessionStorage.removeItem('adminActiveSection');
    window.location.href = '../Customer/Login.html';
}


// ─── LOG ADMIN ACTION ────────────────────────────────────────

/**
 * Logs an admin action to the admin user's actionsLog.
 * FIX: Uses updateItem() → PUT instead of setLS(KEY_USERS).
 */
export function logAdminAction(action, target, targetId) {
    const current = getLS(KEY_CURRENT_USER);
    if (!current) return;

    const logEntry = {
        action,
        target,
        targetId,
        timestamp: new Date().toISOString()
    };

    const actionsLog = [logEntry, ...(current.actionsLog || [])].slice(0, 50);

    // FIX: updateItem → PUT — no duplicate users
    updateItem(KEY_USERS, current.id, { actionsLog });

    // Update session
    current.actionsLog = actionsLog;
    setLS(KEY_CURRENT_USER, current);
    currentAdmin = current;
}


// ─── INIT ON DOM READY ───────────────────────────────────────

document.addEventListener('DOMContentLoaded', initAdminProfile);
