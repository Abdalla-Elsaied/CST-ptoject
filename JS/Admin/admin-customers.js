// ============================================================
// admin-customers.js
// Handles the Customers section — view, delete, reset password.
// Depends on: admin-helpers.js
// ============================================================

import {
    getUsers,
    saveUsers,
    getOrders,
    getSellers,
    saveSellers,
    getCurrentUser,
    formatDate,
    formatPrice,
    showConfirm,
    showToast,
    escapeHTML,
    statusBadge,
    renderPagination,
    renderTableEmptyState,
    debounce,
    invalidateCaches,
    applyTableCardLabels
} from './admin-helpers.js';

import { 
    updateItem, 
    deleteItem,
    getLS,
    setLS,
    initUsers,
} from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';
import { KEY_USERS, KEY_PRODUCTS } from '../Core/Constants.js';
import { logAdminAction } from './admin-profile.js';

// Current search and filter state
let customerSearchQuery = '';
let customerStatusFilter = 'All';
let customerRoleFilter = 'All';
let customerPagination = { page: 1, limit: 10 };


/**
 * Main entry point for the customers section.
 */
export async function renderCustomers() {
    await initUsers(); 
    console.log(getUsers())
    customerSearchQuery = '';
    customerStatusFilter = 'All';
    customerRoleFilter = 'All';
    customerPagination.page = 1;

    const searchInput = document.getElementById('customerSearchInput');
    const statusFilter = document.getElementById('customerStatusFilter');
    const roleFilter = document.getElementById('customerRoleFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'All';
    if (roleFilter) roleFilter.value = 'All';
    
    setupStatusFilter();
    setupDeduplicationBtn();
    renderCustomersTable();
    bindCustomersEvents();
}

/**
 * Handles the Clean Duplicates button visibility and click.
 */
function setupDeduplicationBtn() {
    const btn = document.getElementById('deduplicateUsersBtn');
    if (!btn) return;

    // Listener for event dispatched by Storage.js initUsers()
    window.addEventListener('duplicates-detected', (e) => {
        btn.style.display = 'inline-flex';
        btn.title = `Found ${e.detail} duplicate records in database. Click to clean.`;
    });

    btn.onclick = async () => {
        const { initUsers } = await import('../Core/Storage.js');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Cleaning...';
        
        await initUsers(); // Runs deduplication again
        
        showToast('Database cleanup complete. Duplicates removed.', 'success');
        btn.style.display = 'none';
        renderCustomersTable();
    };
}

/**
 * Setup status filter dropdown
 */
function setupStatusFilter() {
    // Status filter
    const statusFilter = document.getElementById('customerStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            customerStatusFilter = e.target.value;
            customerPagination.page = 1;
            renderCustomersTable();
        });
    }
    
    // Role filter
    const roleFilter = document.getElementById('customerRoleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', (e) => {
            customerRoleFilter = e.target.value;
            customerPagination.page = 1;
            renderCustomersTable();
        });
    }
}

/**
 * Normalize customer object with default fields
 */
function normalizeCustomer(rawCustomer) {
    return {
        ...rawCustomer,
        isBanned: rawCustomer.isBanned ?? false,
        bannedAt: rawCustomer.bannedAt ?? null,
        bannedReason: rawCustomer.bannedReason ?? null,
        bannedBy: rawCustomer.bannedBy ?? null,
        lastLoginAt: rawCustomer.lastLoginAt ?? null,
        accountLog: rawCustomer.accountLog ?? []
    };
}


// ─── TABLE RENDERING ─────────────────────────────────────────

/**
 * Renders the customers table from ls_users filtered by role='customer'.
 * Also shows sellers so admin can manage all users and change roles.
 */
export function renderCustomersTable() {
    const allUsers = getUsers();
    const users = allUsers.filter(u => u.role === ROLES.CUSTOMER || u.role === ROLES.SELLER || u.role === 'admin')
        .map(u => normalizeCustomer(u));

    const query = customerSearchQuery.toLowerCase();
    const tbody = document.getElementById('customersTableBody');

    if (!tbody) return;

    // Filter by search query, status, and role
    const filtered = users.filter(c => {
        const name = (c.name || c.fullName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const role = (c.role || '').toLowerCase();
        const matchesSearch = name.includes(query) || email.includes(query) || role.includes(query);
        
        // Status filter
        let matchesStatus = true;
        if (customerStatusFilter === 'Active') {
            matchesStatus = !c.isBanned;
        } else if (customerStatusFilter === 'Banned') {
            matchesStatus = c.isBanned;
        }
        
        // Role filter
        let matchesRole = true;
        if (customerRoleFilter !== 'All') {
            matchesRole = c.role === customerRoleFilter;
        }
        
        return matchesSearch && matchesStatus && matchesRole;
    });

    // Update count label
    const countEl = document.getElementById('customersCount');
    if (countEl) {
        const customerCount = filtered.filter(u => u.role === ROLES.CUSTOMER).length;
        const sellerCount = filtered.filter(u => u.role === ROLES.SELLER).length;
        countEl.textContent = `${customerCount} customer${customerCount !== 1 ? 's' : ''}, ${sellerCount} seller${sellerCount !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filtered.length === 0) {
        tbody.innerHTML = renderTableEmptyState(9, 'No users match your filters.', 'bi-people');
        renderPagination(0, customerPagination.limit, 1, 'customersPagination', () => {});
        return;
    }

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / customerPagination.limit);
    if (customerPagination.page > totalPages) customerPagination.page = Math.max(1, totalPages);

    const start = (customerPagination.page - 1) * customerPagination.limit;
    const paginated = filtered.slice(start, start + customerPagination.limit);

    tbody.innerHTML = paginated.map((c, i) => {
        const isBanned = c.isBanned;
        const isAdmin  = c.role === 'admin';
        const isSeller = c.role === ROLES.SELLER;

        // Avatar: role-based gradient + 2-letter initials
        const rawName  = (c.fullName || c.name || c.email || '?').trim();
        const words    = rawName.split(/\s+/).filter(Boolean);
        const initials = words.length >= 2
            ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
            : rawName.slice(0, 2).toUpperCase();
        const avatarGradient = isAdmin
            ? 'linear-gradient(135deg,#f59e0b,#d97706)'
            : isSeller
                ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
                : 'linear-gradient(135deg,#8b5cf6,#7c3aed)';

        // Role pill
        const rolePill = isAdmin
            ? '<span class="um-role-pill um-role-admin"><i class="bi bi-shield-lock"></i> Admin</span>'
            : isSeller
                ? '<span class="um-role-pill um-role-seller"><i class="bi bi-shop"></i> Seller</span>'
                : '<span class="um-role-pill um-role-customer"><i class="bi bi-person"></i> Customer</span>';

        // Status pill
        const statusPill = isBanned
            ? `<span class="um-status-pill um-status-banned" title="Banned: ${escapeHTML(c.bannedReason || 'No reason')}"><span class="um-dot um-dot-red"></span> Banned</span>`
            : '<span class="um-status-pill um-status-active"><span class="um-dot um-dot-green um-dot-pulse"></span> Active</span>';

        // Orders count — no duplicate "ORDERS" word
        const orderCount = getOrders().filter(o => String(o.customerId) === String(c.id)).length;
        const ordersCell = `<div class="um-orders-cell">
            <span class="um-orders-count">${orderCount}</span>
            <span class="um-orders-label">order${orderCount !== 1 ? 's' : ''}</span>
        </div>`;

        const subtitle = isAdmin ? 'System Administrator'
            : isSeller ? escapeHTML(c.storeName || 'Marketplace Seller')
            : 'Customer';

        const rowClass = isBanned ? 'row-suspended' : '';

        return `
        <tr class="${rowClass}" data-user-id="${c.id}">
            <td class="col-check">
                ${isAdmin ? '' : `<input type="checkbox" class="form-check-input user-checkbox" value="${c.id}">`}
            </td>
            <td class="col-num hide-tablet">${start + i + 1}</td>
            <td class="col-user">
                <div class="user-cell">
                    ${c.photoUrl
                        ? `<img src="${c.photoUrl}" class="um-avatar" style="object-fit:cover;" onerror="this.style.display='none'"/>`
                        : `<div class="um-avatar" style="background:${avatarGradient}">${escapeHTML(initials)}</div>`}
                    <div class="user-meta">
                        <div class="name" title="${escapeHTML(rawName)}">${escapeHTML(rawName)}</div>
                        <div class="subtitle">${subtitle}</div>
                    </div>
                </div>
            </td>
            <td class="col-contact hide-mobile-lg">
                <div class="contact-cell">
                    <div class="email" title="${escapeHTML(c.email || '')}">
                        <i class="bi bi-envelope"></i>${escapeHTML(c.email || '—')}
                    </div>
                    ${c.phone ? `<div class="phone"><i class="bi bi-telephone"></i>${escapeHTML(c.phone)}</div>` : ''}
                </div>
            </td>
            <td class="col-role">${rolePill}</td>
            <td class="col-status">${statusPill}</td>
            <td class="col-joined hide-tablet">
                <div class="joined-cell">
                    <div class="date">${formatDate(c.createdAt)}</div>
                    <div class="last-login">${c.lastLoginAt ? `Last: ${formatDate(c.lastLoginAt)}` : 'Never logged in'}</div>
                </div>
            </td>
            <td class="col-orders hide-tablet">${ordersCell}</td>
            <td class="col-actions">
                ${isAdmin
                    ? `<span class="um-protected-badge"><i class="bi bi-shield-lock-fill"></i> Protected</span>`
                    : `<div class="um-action-cell">
                        <button class="um-btn-primary" data-id="${c.id}" data-action="viewDetails">
                            <i class="bi bi-eye"></i> View
                        </button>
                        <div class="um-overflow-wrap">
                            <button class="um-btn-more" data-id="${c.id}" aria-label="More actions" aria-expanded="false">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <div class="um-dropdown" role="menu">
                                ${isBanned
                                    ? `<button class="um-drop-item um-drop-success" data-id="${c.id}" data-action="unban" role="menuitem">
                                            <i class="bi bi-check-circle"></i> Unban User
                                       </button>`
                                    : `<button class="um-drop-item um-drop-warn" data-id="${c.id}" data-action="ban" role="menuitem">
                                            <i class="bi bi-slash-circle"></i> Ban User
                                       </button>`
                                }
                                <button class="um-drop-item" data-id="${c.id}" data-action="resetPassword" role="menuitem">
                                    <i class="bi bi-key"></i> Reset Password
                                </button>
                                ${isSeller
                                    ? `<button class="um-drop-item um-drop-warn" data-id="${c.id}" data-action="revertToCustomer" role="menuitem">
                                            <i class="bi bi-person-dash"></i> Remove Seller Role
                                       </button>`
                                    : ''
                                }
                                <div class="um-drop-divider"></div>
                                <button class="um-drop-item um-drop-danger" data-id="${c.id}" data-action="delete" role="menuitem">
                                    <i class="bi bi-trash"></i> Delete User
                                </button>
                            </div>
                        </div>
                    </div>`
                }
            </td>
        </tr>`;
    }).join('');

    // Apply card labels for mobile layout
    applyTableCardLabels('usersTable');

    // Render Pagination
    renderPagination(totalItems, customerPagination.limit, customerPagination.page, 'customersPagination', (newPage) => {
        customerPagination.page = newPage;
        renderCustomersTable();
        document.getElementById('customersSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}


// ─── EVENT LISTENERS ─────────────────────────────────────────

function bindCustomersEvents() {
    const searchInput = document.getElementById('customerSearchInput');
    if (searchInput) {
        // Show/hide clear button based on input value
        const updateClearBtn = () => {
            const clearBtn = document.getElementById('customerSearchClear');
            if (clearBtn) clearBtn.style.display = searchInput.value ? 'flex' : 'none';
        };

        searchInput.oninput = debounce((e) => {
            customerSearchQuery = e.target.value;
            customerPagination.page = 1;
            renderCustomersTable();
            updateClearBtn();
        }, 300);

        // Wire up clear button
        const clearBtn = document.getElementById('customerSearchClear');
        if (clearBtn) {
            clearBtn.onclick = () => {
                searchInput.value = '';
                customerSearchQuery = '';
                customerPagination.page = 1;
                renderCustomersTable();
                updateClearBtn();
                searchInput.focus();
            };
            updateClearBtn();
        }
    }

    // Bulk selection
    const selectAllCheckbox = document.getElementById('selectAllUsers');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateBulkActionsVisibility();
        });
    }

    // Individual checkbox changes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('user-checkbox')) {
            updateBulkActionsVisibility();
            
            // Update select all checkbox state
            const checkboxes = document.querySelectorAll('.user-checkbox');
            const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
            const selectAll = document.getElementById('selectAllUsers');
            
            if (selectAll) {
                selectAll.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
                selectAll.checked = checkedBoxes.length === checkboxes.length && checkboxes.length > 0;
            }
        }
    });

    const tbody = document.getElementById('customersTableBody');
    if (tbody) {
        // Toggle ⋯ dropdown
        tbody.addEventListener('click', (e) => {
            const moreBtn = e.target.closest('.um-btn-more');
            if (moreBtn) {
                e.stopPropagation();
                const wrap = moreBtn.closest('.um-overflow-wrap');
                const dropdown = wrap.querySelector('.um-dropdown');
                const isOpen = dropdown.classList.contains('open');

                // Close all other open dropdowns first
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

            // Close any open dropdown
            document.querySelectorAll('.um-dropdown.open').forEach(d => {
                d.classList.remove('open');
                d.closest('.um-overflow-wrap')?.querySelector('.um-btn-more')?.setAttribute('aria-expanded', 'false');
            });

            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'viewDetails') openCustomerDetailsModal(id);
            if (action === 'ban') banCustomer(id);
            if (action === 'unban') unbanCustomer(id);
            if (action === 'revertToCustomer') revertSellerToCustomer(id);
            if (action === 'resetPassword') {
                const users = getUsers();
                const user = users.find(u => String(u.id) === String(id));
                openResetPasswordModal(id, 'customer');
            }
            if (action === 'delete') confirmDeleteCustomer(id);
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.um-dropdown.open').forEach(d => {
            d.classList.remove('open');
            d.closest('.um-overflow-wrap')?.querySelector('.um-btn-more')?.setAttribute('aria-expanded', 'false');
        });
    });

    // Bulk actions button
    const bulkBtn = document.getElementById('bulkActionsBtn');
    if (bulkBtn) {
        bulkBtn.onclick = () => showBulkActionsMenu();
    }
}

/**
 * Update bulk actions button visibility
 */
function updateBulkActionsVisibility() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const bulkBtn = document.getElementById('bulkActionsBtn');
    
    if (bulkBtn) {
        if (checkedBoxes.length > 0) {
            bulkBtn.style.display = 'inline-flex';
            bulkBtn.innerHTML = `<i class="bi bi-check2-square"></i> Bulk Actions (${checkedBoxes.length})`;
        } else {
            bulkBtn.style.display = 'none';
        }
    }
}


// ─── BAN / UNBAN ACCOUNT ─────────────────────────────

/**
 * Bans a user account - blocks login and hides products if seller.
 */
function banCustomer(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return;

    if (user.role === 'admin') {
        showToast('Cannot ban admin accounts.', 'error');
        return;
    }

    // Create ban reason modal if it doesn't exist
    if (!document.getElementById('banReasonModal')) {
        const modalHTML = `
            <div class="modal fade" id="banReasonModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Ban User Account</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>You are about to ban <strong id="banUserName"></strong></p>
                            <div class="mb-3">
                                <label class="form-label">Reason for ban (optional)</label>
                                <textarea class="form-control" id="banReason" rows="3" placeholder="Enter reason for banning this user..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmBanBtn">Ban User</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Populate and show modal
    document.getElementById('banUserName').textContent = user.name || user.fullName || user.email;
    document.getElementById('banReason').value = '';
    
    const bannerModal = new bootstrap.Modal(document.getElementById('banReasonModal'));
    bannerModal.show();

    // Handle ban confirmation
    document.getElementById('confirmBanBtn').onclick = () => {
        const reason = document.getElementById('banReason').value.trim();
        
        // Use updateItem to set isBanned
        updateItem(KEY_USERS, id, {
            isBanned:     true,
            bannedAt:     new Date().toISOString(),
            bannedReason: reason || 'No reason provided',
            bannedBy:     getCurrentUser()?.id
        });

        // If user is a seller, hide their products
        if (user.role === ROLES.SELLER) {
            const products = getLS(KEY_PRODUCTS) || [];
            const sellerProducts = products.filter(p => String(p.sellerId) === String(id));
            
            sellerProducts.forEach(p => {
                const idx = products.findIndex(x => x.id === p.id);
                if (idx !== -1) {
                    products[idx].isActive = false;
                    products[idx].hiddenByBan = true;
                }
            });
            setLS(KEY_PRODUCTS, products);
            console.log(`[BAN] Seller ${user.email} banned. ${sellerProducts.length} products hidden.`);
        }

        logAdminAction('banned_user', user.name || user.fullName || user.email, id);
        invalidateUserSession(id);
        renderCustomersTable();
        showToast('User account banned successfully.', 'success');
        
        bannerModal.hide();
    };
}

/**
 * Unbans a user account - allows login again and restores products if seller.
 */
function unbanCustomer(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return;

    showConfirm(
        `Unban "${user.name || user.fullName || user.email}"? They will be able to access their account again.`,
        () => {
            updateItem(KEY_USERS, id, {
                isBanned:    false,
                unbannedAt:  new Date().toISOString(),
                unbannedBy:  getCurrentUser()?.id,
                bannedReason: null
            });

            // If user is a seller, restore their products
            if (user.role === ROLES.SELLER) {
                const products = getLS(KEY_PRODUCTS) || [];
                const hiddenProducts = products.filter(p => String(p.sellerId) === String(id) && p.hiddenByBan);
                
                hiddenProducts.forEach(p => {
                    const idx = products.findIndex(x => x.id === p.id);
                    if (idx !== -1) {
                        products[idx].isActive = true;
                        delete products[idx].hiddenByBan;
                    }
                });
                setLS(KEY_PRODUCTS, products);
                console.log(`[UNBAN] Seller ${user.email} unbanned. ${hiddenProducts.length} products restored.`);
            }

            logAdminAction('unbanned_user', user.name || user.fullName || user.email, id);
            renderCustomersTable();
            showToast('User account unbanned successfully.', 'success');
        }
    );
}


// ─── HELPERS ─────────────────────────────────────────────────

/**
 * Invalidates a user's session by clearing their currentUser if they're logged in.
 * This forces them to re-login after ban or role change.
 * @param {string|number} userId - The user ID to invalidate
 */
function invalidateUserSession(userId) {
    const currentUser = getLS('ls_currentUser');
    if (currentUser && String(currentUser.id) === String(userId)) {
        localStorage.removeItem('ls_currentUser');
        console.log(`[SESSION] User ${userId} session invalidated - forced logout`);
    }
}

/**
 * Returns how many orders a customer has placed.
 */
export function getCustomerOrderCount(customerId) {
    const count = getOrders().filter(o => String(o.customerId) === String(customerId)).length;
    return `<div class="um-orders-cell">
        <span class="um-orders-count">${count} ORDER${count !== 1 ? 'S' : ''}</span>
        <span class="um-orders-label">ORDERS</span>
    </div>`;
}



/**
 * Changes a customer's role to seller.
 * Opens a modal to collect seller-specific information.
 */
export function confirmChangeToSeller(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user || user.role !== ROLES.CUSTOMER) return;

    showConfirm(
        `Change "${user.name || user.fullName || user.email}" from Customer to Seller? They will need to provide store information.`,
        () => {
            openSellerInfoModal(id);
        }
    );
}

/**
 * Opens modal to collect seller information when changing customer to seller.
 */
function openSellerInfoModal(userId) {
    // Create modal HTML if it doesn't exist
    let modal = document.getElementById('sellerInfoModal');
    if (!modal) {
        const modalHTML = `
            <div class="modal fade" id="sellerInfoModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Seller Information Required</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="sellerInfoUserId">
                            <div class="mb-3">
                                <label class="form-label">Store Name <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sellerInfoStoreName" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">City <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sellerInfoCity" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Phone <span class="text-danger">*</span></label>
                                <input type="tel" class="form-control" id="sellerInfoPhone" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Payment Method <span class="text-danger">*</span></label>
                                <select class="form-select" id="sellerInfoPayment" required>
                                    <option value="">Select...</option>
                                    <option>Bank Transfer</option>
                                    <option>Vodafone Cash</option>
                                    <option>InstaPay</option>
                                    <option>PayPal</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Store Description</label>
                                <textarea class="form-control" id="sellerInfoDescription" rows="3"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn-primary-green" id="sellerInfoSaveBtn">Save &amp; Change Role</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('sellerInfoModal');
    }

    // Set user ID and show modal
    document.getElementById('sellerInfoUserId').value = userId;
    document.getElementById('sellerInfoStoreName').value = '';
    document.getElementById('sellerInfoCity').value = '';
    document.getElementById('sellerInfoPhone').value = '';
    document.getElementById('sellerInfoPayment').value = '';
    document.getElementById('sellerInfoDescription').value = '';

    // Wire save button for existing-user (customer→seller) flow
    const saveBtn = document.getElementById('sellerInfoSaveBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.textContent = 'Save & Change Role';
    newSaveBtn.onclick = () => window.saveSellerInfo();

    new bootstrap.Modal(modal).show();
}

/**
 * Saves seller information and completes role change from customer to seller.
 */
window.saveSellerInfo = function () {
    const userId = document.getElementById('sellerInfoUserId').value;
    const storeName = document.getElementById('sellerInfoStoreName').value.trim();
    const city = document.getElementById('sellerInfoCity').value.trim();
    const phone = document.getElementById('sellerInfoPhone').value.trim();
    const payment = document.getElementById('sellerInfoPayment').value;
    const description = document.getElementById('sellerInfoDescription').value.trim();

    // Validation
    if (!storeName || !city || !phone || !payment) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    const users = getUsers();
    const index = users.findIndex(u => String(u.id) === String(userId));
    if (index === -1) return;

    // Change role and add seller-specific fields
    // ✅ Use updateItem() — updates _usersCache + sends PUT
    updateItem(KEY_USERS, userId, {
        role:              ROLES.SELLER,
        storeName:         storeName,
        city:              city,
        phone:             phone,
        paymentMethod:     payment,
        description:       description,
        storeDescription:  description,
        isApproved:        true,
        roleChangedAt:     new Date().toISOString(),
        roleChangedBy:     getCurrentUser()?.id,
        previousRole:      ROLES.CUSTOMER
    });

    // Close modal
    const modalEl = document.getElementById('sellerInfoModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // ✅ CRITICAL: Force logout on role change
    invalidateUserSession(userId);

    renderCustomersTable();

    console.log(`[AUDIT] User ${users[index].email} role changed from Customer to Seller by admin`);
    showToast('User role changed to Seller successfully.', 'success');
};


/**
 * Opens seller info modal when creating a NEW user with role=seller directly.
 * Reuses the same sellerInfoModal but saves a full new user instead of updating.
 */
function openSellerInfoModalForNewUser(baseUser) {
    let modal = document.getElementById('sellerInfoModal');
    if (!modal) {
        // trigger the normal modal creation path by calling openSellerInfoModal with a dummy id
        // but we need to intercept the save — so we build it inline
        const modalHTML = `
            <div class="modal fade" id="sellerInfoModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Seller Information Required</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="sellerInfoUserId">
                            <div class="mb-3">
                                <label class="form-label">Store Name <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sellerInfoStoreName" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">City <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sellerInfoCity" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Phone <span class="text-danger">*</span></label>
                                <input type="tel" class="form-control" id="sellerInfoPhone" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Payment Method <span class="text-danger">*</span></label>
                                <select class="form-select" id="sellerInfoPayment" required>
                                    <option value="">Select...</option>
                                    <option>Bank Transfer</option>
                                    <option>Vodafone Cash</option>
                                    <option>InstaPay</option>
                                    <option>PayPal</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Store Description</label>
                                <textarea class="form-control" id="sellerInfoDescription" rows="3"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn-primary-green" id="sellerInfoSaveBtn">Save & Create Seller</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('sellerInfoModal');
    }

    // Clear fields
    document.getElementById('sellerInfoUserId').value = '';
    document.getElementById('sellerInfoStoreName').value = '';
    document.getElementById('sellerInfoCity').value = '';
    document.getElementById('sellerInfoPhone').value = '';
    document.getElementById('sellerInfoPayment').value = '';
    document.getElementById('sellerInfoDescription').value = '';

    // Override save button for new-user flow
    const saveBtn = document.getElementById('sellerInfoSaveBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.textContent = 'Save & Create Seller';
    newSaveBtn.onclick = () => {
        const storeName   = document.getElementById('sellerInfoStoreName').value.trim();
        const city        = document.getElementById('sellerInfoCity').value.trim();
        const phone       = document.getElementById('sellerInfoPhone').value.trim();
        const payment     = document.getElementById('sellerInfoPayment').value;
        const description = document.getElementById('sellerInfoDescription').value.trim();

        if (!storeName || !city || !phone || !payment) {
            showToast('Please fill all required fields.', 'error');
            return;
        }

        const newSeller = {
            ...baseUser,
            role:              ROLES.SELLER,
            storeName,
            city,
            phone:             phone || baseUser.phone,
            paymentMethod:     payment,
            description,
            storeDescription:  description,
            isApproved:        true,
        };

        saveUsers([newSeller]);
        logAdminAction('created_user', baseUser.name, baseUser.id);

        bootstrap.Modal.getInstance(modal)?.hide();
        renderCustomersTable();
        showToast(`Seller "${baseUser.name}" created successfully.`, 'success');
    };

    new bootstrap.Modal(modal).show();
}


/**
 * Reverts a seller back to customer role.
 * Clears all seller-specific fields and hides their products.
 */
export function revertSellerToCustomer(id) {
    const users = getUsers();
    const user  = users.find(u => String(u.id) === String(id));
    if (!user || user.role !== ROLES.SELLER) return;

    showConfirm(
        `Remove seller role from "${user.name || user.fullName || user.email}"? They will become a Customer. Their products will be hidden.`,
        () => {
            // Hide seller's products
            const products = getLS(KEY_PRODUCTS) || [];
            let hiddenCount = 0;
            products.forEach((p, idx) => {
                if (String(p.sellerId) === String(id) && p.isActive !== false) {
                    products[idx].isActive       = false;
                    products[idx].hiddenByDemotion = true;
                    hiddenCount++;
                }
            });
            setLS(KEY_PRODUCTS, products);

            // Revert role — clear seller fields
            updateItem(KEY_USERS, id, {
                role:             ROLES.CUSTOMER,
                storeName:        null,
                storeDescription: null,
                description:      null,
                city:             null,
                paymentMethod:    null,
                isApproved:       null,
                previousRole:     ROLES.SELLER,
                demotedAt:        new Date().toISOString(),
                demotedBy:        getCurrentUser()?.id,
            });

            invalidateUserSession(id);
            logAdminAction('reverted_seller_to_customer', user.name || user.email, id);
            renderCustomersTable();
            showToast(`Seller role removed. ${hiddenCount} product(s) hidden.`, 'success');
        }
    );
}

window.revertSellerToCustomer = revertSellerToCustomer;
function openCustomerDetailsModal(id) {
    const users = getUsers();
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return;

    const orders = getOrders().filter(o => String(o.customerId) === String(id));
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || Number(o.totalPrice) || 0), 0);

    // Create modal if it doesn't exist
    if (!document.getElementById('customerDetailsModal')) {
        const modalHTML = `
            <div class="modal fade" id="customerDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">User Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="customerDetailsBody">
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
    const modalBody = document.getElementById('customerDetailsBody');
    modalBody.innerHTML = `
        <div class="row g-4">
            <div class="col-md-6">
                <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Personal Information</h6>
                <div class="mb-2"><strong>Name:</strong> ${escapeHTML(user.name || user.fullName || 'Not provided')}</div>
                <div class="mb-2"><strong>Email:</strong> ${escapeHTML(user.email)}</div>
                <div class="mb-2"><strong>Role:</strong> 
                    <span class="badge ${user.role === 'admin' ? 'bg-dark' : user.role === ROLES.SELLER ? 'bg-info' : 'bg-secondary'}">
                        ${user.role}
                    </span>
                </div>
                <div class="mb-2"><strong>Status:</strong> 
                    <span class="badge ${user.isBanned ? 'bg-danger' : 'bg-success'}">
                        ${user.isBanned ? 'Banned' : 'Active'}
                    </span>
                </div>
                ${user.isBanned ? `<div class="mb-2"><strong>Ban Reason:</strong> ${escapeHTML(user.bannedReason || 'No reason provided')}</div>` : ''}
            </div>
            <div class="col-md-6">
                <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Account Information</h6>
                <div class="mb-2"><strong>Member Since:</strong> ${formatDate(user.createdAt)}</div>
                <div class="mb-2"><strong>Last Login:</strong> ${user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</div>
                <div class="mb-2"><strong>Total Orders:</strong> ${orders.length}</div>
                <div class="mb-2"><strong>Total Spent:</strong> ${formatPrice(totalSpent)}</div>
            </div>
        </div>
        
        ${user.role === ROLES.SELLER ? `
            <hr class="my-4">
            <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Seller Information</h6>
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="mb-2"><strong>Store Name:</strong> ${escapeHTML(user.storeName || 'Not provided')}</div>
                    <div class="mb-2"><strong>City:</strong> ${escapeHTML(user.city || 'Not provided')}</div>
                </div>
                <div class="col-md-6">
                    <div class="mb-2"><strong>Phone:</strong> ${escapeHTML(user.phone || 'Not provided')}</div>
                    <div class="mb-2"><strong>Payment Method:</strong> ${escapeHTML(user.paymentMethod || 'Not provided')}</div>
                </div>
                ${user.description ? `<div class="col-12"><div class="mb-2"><strong>Description:</strong> ${escapeHTML(user.description)}</div></div>` : ''}
            </div>
        ` : ''}
        
        ${orders.length > 0 ? `
            <hr class="my-4">
            <h6 class="mb-3" style="color: var(--green-dark); font-weight: 600;">Recent Orders</h6>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.slice(-5).reverse().map(order => `
                            <tr>
                                <td class="order-id">${order.id}</td>
                                <td>${formatDate(order.createdAt || order.orderDate)}</td>
                                <td>${formatPrice(order.subtotal || order.total || order.totalPrice)}</td>
                                <td>${statusBadge(order.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
    `;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('customerDetailsModal'));
    modal.show();
}


/**
 * Shows confirm dialog then removes customer from ls_users.
 * Prevents deletion of admin accounts.
 */
export function confirmDeleteCustomer(id) {
    const currentUser = getCurrentUser();

    // GUARD: Cannot delete own account
    if (String(id) === String(currentUser?.id)) {
        showToast('You cannot delete your own account.', 'error');
        return;
    }

    const users = getUsers();
    const customer = users.find(u => String(u.id) === String(id));
    if (!customer) return;

    // GUARD: Cannot delete admin accounts
    if (customer.role === 'admin') {
        showToast('Admin accounts cannot be deleted from this panel.', 'error');
        return;
    }

    const orderCount = getOrders().filter(o => String(o.customerId) === String(id)).length;
    const warning = orderCount > 0
        ? ` This customer has ${orderCount} order(s) — those orders will remain in the system.`
        : '';

    showConfirm(
        `Delete customer "${customer.name || customer.fullName || customer.email}"?${warning}`,
        () => {
            cascadeDeleteUser(id);
            logAdminAction('deleted_user', customer.name || customer.fullName || customer.email, id);
            renderCustomersTable();
            showToast('Customer account deleted.', 'info');
        }
    );
}

/**
 * Cascade-deletes a user: removes from MockAPI and cleans up their products.
 */
function cascadeDeleteUser(id) {
    deleteItem(KEY_USERS, id);

    const products = getLS(KEY_PRODUCTS) || [];
    const remainingProducts = products.filter(p => String(p.sellerId) !== String(id));
    if (products.length !== remainingProducts.length) {
        setLS(KEY_PRODUCTS, remainingProducts);
    }

    invalidateCaches();
    console.log(`[AUDIT] User ${id} deleted with cascade cleanup`);
}


// ─── RESET PASSWORD ──────────────────────────────────────────

/**
 * Opens the reset password modal for a given user id.
 * Works for both customers (ls_users) and sellers ('sellers' key).
 */
export function openResetPasswordModal(id, type) {
    document.getElementById('resetPasswordUserId').value = id;
    document.getElementById('resetPasswordUserType').value = type;
    document.getElementById('resetPasswordNew').value = '';
    document.getElementById('resetPasswordConfirm').value = '';
    const errEl = document.getElementById('resetPasswordError');
    if (errEl) errEl.textContent = '';

    new bootstrap.Modal(document.getElementById('resetPasswordModal')).show();
}

/**
 * Saves the new password for the user.
 */
export function saveResetPassword() {
    const id = document.getElementById('resetPasswordUserId').value;
    const type = document.getElementById('resetPasswordUserType').value;
    const newPass = document.getElementById('resetPasswordNew').value.trim();
    const confirm = document.getElementById('resetPasswordConfirm').value.trim();
    const errorEl = document.getElementById('resetPasswordError');

    // Validation
    if (newPass.length < 6) {
        if (errorEl) errorEl.textContent = 'Password must be at least 6 characters.';
        return;
    }
    if (newPass !== confirm) {
        if (errorEl) errorEl.textContent = 'Passwords do not match.';
        return;
    }

    // Update in the correct LS array
    let userEmail = '';
    if (type === 'customer') {
        const users = getUsers();
        const index = users.findIndex(u => String(u.id) === String(id));
        if (index === -1) return;
        userEmail = users[index].email;
        // ✅ Use updateItem()
        updateItem(KEY_USERS, id, { password: newPass });

    } else if (type === 'seller') {
        const sellers = getSellers();
        const index = sellers.findIndex(s => String(s.id) === String(id));
        if (index === -1) return;
        userEmail = sellers[index].email;
        sellers[index].password = newPass;
        saveSellers(sellers);
    }

    logAdminAction('reset_password', userEmail, id);

    const modalEl = document.getElementById('resetPasswordModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showToast('Password reset successfully.', 'success');
}


// ─── BULK ACTIONS ────────────────────────────────────────────

/**
 * Shows bulk actions menu
 */
function showBulkActionsMenu() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    if (checkedBoxes.length === 0) {
        showToast('No users selected', 'info');
        return;
    }

    // Create bulk actions modal if it doesn't exist
    if (!document.getElementById('bulkActionsModal')) {
        const modalHTML = `
            <div class="modal fade" id="bulkActionsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Bulk Actions</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong id="bulkSelectedCount"></strong> user(s) selected</p>
                            <div class="d-grid gap-2">
                                <button class="btn btn-danger" onclick="bulkBanUsers()">
                                    <i class="bi bi-ban"></i> Ban Selected Users
                                </button>
                                <button class="btn btn-success" onclick="bulkUnbanUsers()">
                                    <i class="bi bi-check-circle"></i> Unban Selected Users
                                </button>
                                <button class="btn btn-outline-danger" onclick="bulkDeleteUsers()">
                                    <i class="bi bi-trash"></i> Delete Selected Users
                                </button>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    document.getElementById('bulkSelectedCount').textContent = checkedBoxes.length;
    new bootstrap.Modal(document.getElementById('bulkActionsModal')).show();
}

/**
 * Bulk ban selected users
 */
window.bulkBanUsers = function() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const userIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (userIds.length === 0) return;

    showConfirm(
        `Ban ${userIds.length} user(s)? They will not be able to login, and seller products will be hidden.`,
        () => {
            const users = getUsers();
            const products = getLS(KEY_PRODUCTS) || [];
            let bannedCount = 0;

            userIds.forEach(id => {
                const user = users.find(u => String(u.id) === String(id));
                if (user && user.role !== 'admin') {
                    // Update user
                    updateItem(KEY_USERS, id, {
                        isBanned:     true,
                        bannedAt:     new Date().toISOString(),
                        bannedReason: 'Bulk ban action',
                        bannedBy:     getCurrentUser()?.id
                    });

                    // Update products if seller
                    if (user.role === ROLES.SELLER) {
                        products.forEach((p, idx) => {
                            if (String(p.sellerId) === String(id)) {
                                products[idx].isActive = false;
                                products[idx].hiddenByBan = true;
                            }
                        });
                    }
                    
                    invalidateUserSession(id);
                    bannedCount++;
                }
            });

            setLS(KEY_PRODUCTS, products);
            renderCustomersTable();
            showToast(`${bannedCount} user(s) banned successfully.`, 'success');

            // Close bulk actions modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
            if (modal) modal.hide();

            // Uncheck all
            document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
            const selectAll = document.getElementById('selectAllUsers');
            if (selectAll) selectAll.checked = false;
            updateBulkActionsVisibility();
        }
    );
};

/**
 * Bulk unban selected users
 */
window.bulkUnbanUsers = function() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const userIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (userIds.length === 0) return;

    showConfirm(
        `Unban ${userIds.length} user(s)? They will be able to login again, and hidden seller products will be restored.`,
        () => {
            const users = getUsers();
            const products = getLS(KEY_PRODUCTS) || [];
            let unbannedCount = 0;

            userIds.forEach(id => {
                const user = users.find(u => String(u.id) === String(id));
                if (user) {
                    // Update user
                    updateItem(KEY_USERS, id, {
                        isBanned:     false,
                        unbannedAt:   new Date().toISOString(),
                        unbannedBy:   getCurrentUser()?.id,
                        bannedReason: null
                    });

                    // Restore products if seller
                    if (user.role === ROLES.SELLER) {
                        products.forEach((p, idx) => {
                            if (String(p.sellerId) === String(id) && p.hiddenByBan) {
                                products[idx].isActive = true;
                                delete products[idx].hiddenByBan;
                            }
                        });
                    }
                    
                    unbannedCount++;
                }
            });

            setLS(KEY_PRODUCTS, products);
            renderCustomersTable();
            showToast(`${unbannedCount} user(s) unbanned successfully.`, 'success');

            // Close bulk actions modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
            if (modal) modal.hide();

            // Uncheck all
            document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
            const selectAll = document.getElementById('selectAllUsers');
            if (selectAll) selectAll.checked = false;
            updateBulkActionsVisibility();
        }
    );
};

/**
 * Bulk delete selected users
 */
window.bulkDeleteUsers = function() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const userIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (userIds.length === 0) return;

    const users = getUsers();
    const usersToDelete = users.filter(u => userIds.includes(String(u.id)) && u.role !== 'admin');
    
    if (usersToDelete.length === 0) {
        showToast('No users can be deleted (admins are protected)', 'error');
        return;
    }

    showConfirm(
        `Delete ${usersToDelete.length} user(s)? This action cannot be undone, but their orders will remain.`,
        () => {
            const products = getLS(KEY_PRODUCTS) || [];
            let deletedCount = 0;

            usersToDelete.forEach(u => {
                deleteItem(KEY_USERS, u.id);
                
                // If seller, delete their products too
                if (u.role === ROLES.SELLER) {
                    const remainingProducts = products.filter(p => String(p.sellerId) !== String(u.id));
                    if (products.length !== remainingProducts.length) {
                        setLS(KEY_PRODUCTS, remainingProducts);
                    }
                }
                
                logAdminAction('deleted_user', u.name || u.fullName || u.email, u.id);
                deletedCount++;
            });

            renderCustomersTable();
            showToast(`${deletedCount} user(s) deleted successfully.`, 'info');

            // Close bulk actions modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
            if (modal) modal.hide();

            // Uncheck all
            document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
            const selectAll = document.getElementById('selectAllUsers');
            if (selectAll) selectAll.checked = false;
            updateBulkActionsVisibility();
        }
    );
};


/**
 * Reset all user filters
 */
function resetUserFilters() {
    customerSearchQuery = '';
    customerStatusFilter = 'All';
    customerRoleFilter = 'All';
    
    const searchInput = document.getElementById('customerSearchInput');
    const statusFilter = document.getElementById('customerStatusFilter');
    const roleFilter = document.getElementById('customerRoleFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'All';
    if (roleFilter) roleFilter.value = 'All';
    
    renderCustomersTable();
}

// ─── ADD USER MODAL ──────────────────────────────────────────

// Phone regex — Egyptian mobile numbers
const PHONE_RE = /^(\+20|0)(10|11|12|15)[0-9]{8}$/;

/**
 * Opens the Add User modal with full manual validation.
 * No form cloning — uses a single named handler that is removed on close.
 */
export function openAddUserModal() {
    const modalEl  = document.getElementById('addUserModal');
    const form     = document.getElementById('addUserForm');
    if (!modalEl || !form) return;

    // ── Reset state ───────────────────────────────────────────
    form.reset();
    _clearAllFieldErrors();
    _hideError();

    // ── Password show/hide toggle ─────────────────────────────
    const pwdInput   = document.getElementById('addUserPassword');
    const pwdToggle  = document.getElementById('addUserPasswordToggle');
    const pwdEye     = document.getElementById('addUserPasswordEyeIcon');
    if (pwdToggle) {
        // Clone to remove any previous listener
        const freshToggle = pwdToggle.cloneNode(true);
        pwdToggle.parentNode.replaceChild(freshToggle, pwdToggle);
        freshToggle.addEventListener('click', () => {
            const isText = pwdInput.type === 'text';
            pwdInput.type = isText ? 'password' : 'text';
            document.getElementById('addUserPasswordEyeIcon').className =
                isText ? 'bi bi-eye' : 'bi bi-eye-slash';
        });
    }

    // ── Real-time validation on blur ──────────────────────────
    document.getElementById('addUserFullName').onblur  = () => _validateName();
    document.getElementById('addUserEmail').onblur     = () => _validateEmail();
    document.getElementById('addUserPassword').onblur  = () => _validatePassword();
    document.getElementById('addUserPhone').onblur     = () => _validatePhone();
    document.getElementById('addUserRole').onchange    = () => _validateRole();

    // Clear error on input
    ['addUserFullName','addUserEmail','addUserPassword','addUserPhone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = () => { _clearFieldError(id); _hideError(); };
    });

    // ── Submit handler ────────────────────────────────────────
    const submitHandler = (e) => {
        e.preventDefault();

        const nameOk  = _validateName();
        const emailOk = _validateEmail();
        const pwdOk   = _validatePassword();
        const phoneOk = _validatePhone();
        const roleOk  = _validateRole();

        if (!nameOk || !emailOk || !pwdOk || !phoneOk || !roleOk) return;

        const fullName = document.getElementById('addUserFullName').value.trim();
        const email    = document.getElementById('addUserEmail').value.trim().toLowerCase();
        const password = document.getElementById('addUserPassword').value;
        const phone    = document.getElementById('addUserPhone').value.trim() || null;
        const role     = document.getElementById('addUserRole').value;

        // Duplicate email check
        const existing = getUsers().find(u => (u.email || '').toLowerCase() === email);
        if (existing) {
            _setFieldError('addUserEmail', 'This email is already registered.');
            return;
        }

        const bsModal = bootstrap.Modal.getInstance(modalEl);

        // Seller → open store info modal first
        if (role === ROLES.SELLER) {
            bsModal?.hide();
            openSellerInfoModalForNewUser({
                id:        Date.now(),
                name:      fullName,
                fullName,
                email,
                password,
                phone,
                role,
                isBanned:  false,
                createdAt: new Date().toISOString(),
                createdBy: getCurrentUser()?.id,
            });
            return;
        }

        // Customer — save directly
        saveUsers([{
            id:        Date.now(),
            name:      fullName,
            fullName,
            email,
            password,
            phone,
            role,
            isBanned:  false,
            createdAt: new Date().toISOString(),
            createdBy: getCurrentUser()?.id,
        }]);

        logAdminAction('created_user', fullName, Date.now());
        bsModal?.hide();
        renderCustomersTable();
        showToast(`User "${fullName}" created successfully.`, 'success');
    };

    // Remove old listener, attach fresh one
    form.removeEventListener('submit', form._addUserHandler);
    form._addUserHandler = submitHandler;
    form.addEventListener('submit', submitHandler);

    new bootstrap.Modal(modalEl).show();
}

// ── Field validators ──────────────────────────────────────────

function _validateName() {
    const val = document.getElementById('addUserFullName').value.trim();
    if (!val || val.length < 3) {
        _setFieldError('addUserFullName', 'Full name must be at least 3 characters.');
        return false;
    }
    _clearFieldError('addUserFullName');
    return true;
}

function _validateEmail() {
    const val = document.getElementById('addUserEmail').value.trim();
    const re  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val || !re.test(val)) {
        _setFieldError('addUserEmail', 'Please enter a valid email address.');
        return false;
    }
    _clearFieldError('addUserEmail');
    return true;
}

function _validatePassword() {
    const val = document.getElementById('addUserPassword').value;
    if (!val || val.length < 6) {
        _setFieldError('addUserPassword', 'Password must be at least 6 characters.');
        return false;
    }
    _clearFieldError('addUserPassword');
    return true;
}

function _validatePhone() {
    const val = document.getElementById('addUserPhone').value.trim();
    if (!val) return true; // optional
    if (!PHONE_RE.test(val)) {
        _setFieldError('addUserPhone', 'Invalid phone. Use format: 01XXXXXXXXX or +201XXXXXXXXX');
        return false;
    }
    _clearFieldError('addUserPhone');
    return true;
}

function _validateRole() {
    const val = document.getElementById('addUserRole').value;
    if (!val) {
        _setFieldError('addUserRole', 'Please select a role.');
        return false;
    }
    _clearFieldError('addUserRole');
    return true;
}

// ── DOM helpers ───────────────────────────────────────────────

function _setFieldError(fieldId, message) {
    const el       = document.getElementById(fieldId);
    const feedback = document.getElementById(fieldId + 'Feedback') ||
                     el?.nextElementSibling;
    if (el)       el.classList.add('is-invalid');
    if (feedback) feedback.textContent = message;
}

function _clearFieldError(fieldId) {
    const el = document.getElementById(fieldId);
    if (el) { el.classList.remove('is-invalid'); el.classList.add('is-valid'); }
}

function _clearAllFieldErrors() {
    ['addUserFullName','addUserEmail','addUserPassword','addUserPhone','addUserRole']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('is-invalid', 'is-valid'); }
        });
}

function _showError(msg) {
    const el = document.getElementById('addUserError');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('d-none');
}

function _hideError() {
    const el = document.getElementById('addUserError');
    if (el) el.classList.add('d-none');
}



window.saveResetPassword = saveResetPassword;
window.openResetPasswordModal = openResetPasswordModal;
window.confirmDeleteCustomer = confirmDeleteCustomer;
window.openCustomerDetailsModal = openCustomerDetailsModal;
window.banCustomer = banCustomer;
window.unbanCustomer = unbanCustomer;
window.resetUserFilters = resetUserFilters;
window.updateBulkActionsVisibility = updateBulkActionsVisibility;
window.saveSellerInfo = saveSellerInfo;
window.openAddUserModal = openAddUserModal;
