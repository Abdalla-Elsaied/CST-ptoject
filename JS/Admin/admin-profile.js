/**
 * admin-profile.js - Admin Profile Management
 * Handles profile dropdown, change password modal, profile modal, and activity logging
 */

import { getLS, setLS } from '../Core/Storage.js';

// Global variables
let currentAdmin = null;

/**
 * Initialize admin profile functionality
 */
export function initAdminProfile() {
    currentAdmin = getLS('ls_currentUser');
    if (!currentAdmin) return;

    setupProfileDropdown();
    setupChangePasswordModal();
    setupProfileModal();
    updateTopbarProfile();
    updateSidebarBadges();
}

/**
 * Update sidebar badges with pending counts
 */
export function updateSidebarBadges() {
    // Update seller requests badge
    const sellerRequests = getLS('ls_sellerRequests') || getLS('ls_approval') || [];
    const pendingRequests = sellerRequests.filter(r => r.status === 'pending').length;
    
    const requestsBadge = document.getElementById('requestsBadge');
    if (requestsBadge) {
        requestsBadge.textContent = pendingRequests;
        if (pendingRequests > 0) {
            requestsBadge.classList.remove('d-none');
        } else {
            requestsBadge.classList.add('d-none');
        }
    }
    
    // Update category suggestions badge
    const categoryRequests = getLS('ls_categoryRequests') || getLS('ls_categories') || [];
    const pendingCategories = categoryRequests.filter(c => c.status === 'pending' || c.visibility === 'draft').length;
    
    const categoriesBadge = document.getElementById('categoriesBadge');
    if (categoriesBadge) {
        categoriesBadge.textContent = pendingCategories;
        if (pendingCategories > 0) {
            categoriesBadge.classList.remove('d-none');
        } else {
            categoriesBadge.classList.add('d-none');
        }
    }
}

/**
 * Setup the profile dropdown in topbar
 */
function setupProfileDropdown() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    // Find and replace the existing user section
    const existingUser = topbarRight.querySelector('.topbar-user');
    if (existingUser) {
        existingUser.remove();
    }

    // Create new profile dropdown
    const profileDropdown = document.createElement('div');
    profileDropdown.className = 'topbar-profile-dropdown';
    profileDropdown.innerHTML = `
        <div class="profile-trigger" id="profileTrigger">
            <div class="profile-avatar">${getInitials(currentAdmin.fullName)}</div>
            <div class="profile-info">
                <div class="profile-name">${currentAdmin.fullName}</div>
                <div class="profile-role">${currentAdmin.role}</div>
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
        </div>
    `;

    // Insert before logout button
    const logoutBtn = topbarRight.querySelector('#logoutBtn');
    if (logoutBtn) {
        topbarRight.insertBefore(profileDropdown, logoutBtn);
        logoutBtn.style.display = 'none'; // Hide old logout button
    }

    // Add event listeners
    const trigger = document.getElementById('profileTrigger');
    const menu = document.getElementById('profileDropdownMenu');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        menu.classList.remove('show');
    });

    // Handle dropdown actions
    menu.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.closest('.dropdown-item')?.dataset.action;
        
        switch (action) {
            case 'profile':
                openProfileModal();
                break;
            case 'change-password':
                openChangePasswordModal();
                break;
            case 'logout':
                handleLogout();
                break;
        }
        
        menu.classList.remove('show');
    });
}

/**
 * Get initials from full name
 */
function getInitials(fullName) {
    return fullName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
}

/**
 * Update topbar profile display
 */
function updateTopbarProfile() {
    const profileName = document.querySelector('.profile-name');
    if (profileName && currentAdmin) {
        profileName.textContent = currentAdmin.fullName;
    }
}

/**
 * Setup change password modal
 */
function setupChangePasswordModal() {
    // Check if modal already exists
    if (document.getElementById('changePasswordModal')) return;

    const modalHTML = `
        <div class="modal fade" id="changePasswordModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Change Password</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="changePasswordForm" novalidate>
                            <div class="mb-3">
                                <label class="form-label">Current Password</label>
                                <input type="password" class="form-control" id="currentPassword" required>
                                <div class="invalid-feedback" id="currentPasswordError"></div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">New Password</label>
                                <input type="password" class="form-control" id="newPassword" minlength="6" required>
                                <div class="invalid-feedback" id="newPasswordError"></div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Confirm New Password</label>
                                <input type="password" class="form-control" id="confirmPassword" required>
                                <div class="invalid-feedback" id="confirmPasswordError"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn-primary-green" onclick="savePasswordChange()">Change Password</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Open change password modal
 */
function openChangePasswordModal() {
    const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    
    // Clear form
    document.getElementById('changePasswordForm').reset();
    document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
    
    modal.show();
}

/**
 * Save password change
 */
window.savePasswordChange = function() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Clear previous errors
    document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));

    let hasErrors = false;

    // Validate current password
    if (currentPassword !== currentAdmin.password) {
        showFieldError('currentPassword', 'Current password is incorrect.');
        hasErrors = true;
    }

    // Validate new password length
    if (newPassword.length < 6) {
        showFieldError('newPassword', 'Password must be at least 6 characters.');
        hasErrors = true;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match.');
        hasErrors = true;
    }

    // Validate new password is different
    if (newPassword === currentPassword) {
        showFieldError('newPassword', 'New password must be different from current.');
        hasErrors = true;
    }

    if (hasErrors) return;

    // Update password
    const users = getLS('ls_users') || [];
    const userIndex = users.findIndex(u => u.id === currentAdmin.id);
    
    if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        users[userIndex].passwordChangedAt = new Date().toISOString();
        
        // Update localStorage
        setLS('ls_users', users);
        
        // Update current user
        currentAdmin.password = newPassword;
        currentAdmin.passwordChangedAt = users[userIndex].passwordChangedAt;
        setLS('ls_currentUser', currentAdmin);
        
        // Show success and close modal
        if (window.showToast) {
            window.showToast('Password changed successfully!', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
        
        // Clear form
        document.getElementById('changePasswordForm').reset();
    }
};

/**
 * Show field error
 */
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    
    field.classList.add('is-invalid');
    errorEl.textContent = message;
}

/**
 * Setup profile modal
 */
function setupProfileModal() {
    // Check if modal already exists
    if (document.getElementById('profileModal')) return;

    const modalHTML = `
        <div class="modal fade" id="profileModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Admin Profile</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Personal Info Section -->
                        <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Personal Information</h6>
                        <form id="profileForm" class="mb-4">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">Full Name</label>
                                    <input type="text" class="form-control" id="profileFullName">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Email Address</label>
                                    <input type="email" class="form-control" id="profileEmail" readonly style="background-color: #f8f9fa; color: #6c757d;">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Role</label>
                                    <input type="text" class="form-control" value="Admin 🔒" readonly style="background-color: #f8f9fa; color: #6c757d;">
                                </div>
                            </div>
                        </form>

                        <!-- Security Info Section -->
                        <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Security Information</h6>
                        <div class="row g-3 mb-4">
                            <div class="col-md-4">
                                <label class="form-label text-muted">Member Since</label>
                                <div class="fw-bold" id="memberSince"></div>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label text-muted">Last Login</label>
                                <div class="fw-bold" id="lastLogin"></div>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label text-muted">Password Last Changed</label>
                                <div class="fw-bold" id="passwordChanged"></div>
                            </div>
                        </div>

                        <!-- Recent Activity Section -->
                        <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Recent Activity</h6>
                        <div class="activity-log" id="activityLog" style="max-height: 300px; overflow-y: auto;">
                            <!-- Activity items will be populated here -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn-primary-green" onclick="saveProfileChanges()">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Open profile modal
 */
function openProfileModal() {
    const modal = new bootstrap.Modal(document.getElementById('profileModal'));
    
    // Populate form fields
    document.getElementById('profileFullName').value = currentAdmin.fullName || '';
    document.getElementById('profileEmail').value = currentAdmin.email || '';
    
    // Populate security info
    document.getElementById('memberSince').textContent = formatDate(currentAdmin.createdAt);
    document.getElementById('lastLogin').textContent = currentAdmin.lastLoginAt ? formatDate(currentAdmin.lastLoginAt) : 'Not recorded yet';
    document.getElementById('passwordChanged').textContent = currentAdmin.passwordChangedAt ? formatDate(currentAdmin.passwordChangedAt) : 'Never changed';
    
    // Populate activity log
    populateActivityLog();
    
    modal.show();
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return 'Not available';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Populate activity log
 */
function populateActivityLog() {
    const activityLog = document.getElementById('activityLog');
    const actions = currentAdmin.actionsLog || [];
    
    if (actions.length === 0) {
        activityLog.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-clock-history fs-1 opacity-25"></i>
                <p class="mb-0 mt-2">No recent activity recorded.</p>
            </div>
        `;
        return;
    }
    
    // Show last 10 actions
    const recentActions = actions.slice(0, 10);
    
    activityLog.innerHTML = recentActions.map(action => `
        <div class="activity-item d-flex align-items-center gap-3 p-3 border-bottom">
            <div class="activity-icon">${getActionIcon(action.action)}</div>
            <div class="activity-content flex-grow-1">
                <div class="activity-description fw-bold">${getActionDescription(action)}</div>
                <div class="activity-time text-muted small">${formatDate(action.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Get action icon
 */
function getActionIcon(action) {
    const icons = {
        approved_seller: '✅',
        rejected_seller: '❌',
        deleted_user: '🗑',
        reset_password: '🔑',
        deleted_product: '📦',
        deactivated_product: '🚫',
        changed_order_status: '🧾'
    };
    
    return icons[action] || '⚙️';
}

/**
 * Get action description
 */
function getActionDescription(action) {
    const descriptions = {
        approved_seller: `Approved seller: ${action.target}`,
        rejected_seller: `Rejected seller: ${action.target}`,
        deleted_user: `Deleted user: ${action.target}`,
        reset_password: `Reset password for: ${action.target}`,
        deleted_product: `Deleted product: ${action.target}`,
        deactivated_product: `Deactivated product: ${action.target}`,
        changed_order_status: `Changed status for ${action.target}`
    };
    
    return descriptions[action.action] || `Performed action on: ${action.target}`;
}

/**
 * Save profile changes
 */
window.saveProfileChanges = function() {
    const newFullName = document.getElementById('profileFullName').value.trim();
    
    if (!newFullName) {
        if (window.showToast) {
            window.showToast('Full name is required.', 'error');
        }
        return;
    }
    
    // Update user data
    const users = getLS('ls_users') || [];
    const userIndex = users.findIndex(u => u.id === currentAdmin.id);
    
    if (userIndex !== -1) {
        users[userIndex].fullName = newFullName;
        
        // Update localStorage
        setLS('ls_users', users);
        
        // Update current user
        currentAdmin.fullName = newFullName;
        setLS('ls_currentUser', currentAdmin);
        
        // Update topbar display
        updateTopbarProfile();
        
        // Show success and close modal
        if (window.showToast) {
            window.showToast('Profile updated successfully!', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
    }
};

/**
 * Handle logout
 */
function handleLogout() {
    localStorage.removeItem('ls_currentUser');
    sessionStorage.removeItem('adminActiveSection');
    window.location.href = '../Customer/Login.html';
}

/**
 * Log admin action - shared helper function
 */
export function logAdminAction(action, target, targetId) {
    const users = getLS('ls_users') || [];
    const current = getLS('ls_currentUser');
    
    if (!current) return;
    
    const index = users.findIndex(u => String(u.id) === String(current.id));
    if (index === -1) return;
    
    const logEntry = {
        action,
        target,
        targetId,
        timestamp: new Date().toISOString()
    };
    
    if (!users[index].actionsLog) users[index].actionsLog = [];
    users[index].actionsLog.unshift(logEntry); // newest first
    
    // Keep only last 50 entries to avoid LS bloat
    users[index].actionsLog = users[index].actionsLog.slice(0, 50);
    
    // Sync to ls_currentUser too
    current.actionsLog = users[index].actionsLog;
    
    setLS('ls_users', users);
    setLS('ls_currentUser', current);
    
    // Update currentAdmin reference
    currentAdmin = current;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initAdminProfile);