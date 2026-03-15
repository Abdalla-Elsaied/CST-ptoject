// ============================================================
// admin-panel.js
// Auth guard + sidebar switching + page init.
// Loaded LAST — after all section files.
// ============================================================

import { getCurrentUser, invalidateCaches }  from './admin-helpers.js';
import { getLS, initUsers, setLS }           from '../Core/Storage.js';
import { KEY_APPROVAL, KEY_CATEGORIES, KEY_CURRENT_USER } from '../Core/Constants.js';
import { patchSeedSellers }                  from '../Core/SeedData.js';
import { renderDashboard }                   from './admin-dashboard.js';
import { renderSellers }                     from './admin-sellers.js';
import { renderRequests }                    from './admin-requests.js';
import { renderCategories }                  from './admin-categories.js';
import { renderCustomers }                   from './admin-customers.js';
import { renderProducts }                    from './admin-products.js';
import { renderOrders }                      from './admin-orders.js';
import { renderReviews }                     from './admin-reviews.js';
import { renderAnalytics }                   from './admin-analytics.js';
import { initMetricsTracking }               from './admin-metrics.js';
import { updateAdminNameEverywhere, initAdminProfile } from './admin-profile.js';

// ─── AUTH GUARD ──────────────────────────────────────────────
const _currentUser = getCurrentUser();
if (!_currentUser || String(_currentUser.role || '').toLowerCase() !== 'admin') {
    window.location.href = '../Customer/Login.html';
}


// ─── PAGE INIT ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

    // STEP 1: Load all users from MockAPI into memory cache
    await initUsers();

    // STEP 2: Reset name lookup Maps with fresh data
    invalidateCaches();

    // STEP 3: Patch seed sellers with required fields (storeName, isApproved, etc.)
    patchSeedSellers();

    // STEP 4: Metrics tracking
    initMetricsTracking();

    // STEP 5: Set admin name in all UI locations
    const adminName = (_currentUser.fullName || _currentUser.name) || 'Admin';
    updateAdminNameEverywhere(adminName);
    // Welcome text uses first name only — full name truncates in topbar
    const firstName = adminName.split(' ')[0];
    const welcomeEl = document.getElementById('adminUserName');
    if (welcomeEl) welcomeEl.textContent = firstName;

    // STEP 6: Date in topbar
    const dateEl = document.getElementById('topbarDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });
    }

    // STEP 7: Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem(KEY_CURRENT_USER);
        window.location.href = '../Customer/Login.html';
    });

    // STEP 8: Mobile sidebar
    const hamburger = document.getElementById('sidebarToggle');
    const sidebar   = document.getElementById('adminSidebar');
    const overlay   = document.getElementById('sidebarOverlay');

    hamburger?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
    });
    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    });

    // STEP 9: Desktop sidebar collapse
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    if (collapseBtn) {
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }
        collapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }

    // STEP 10: Init navigation, badges, theme, profile
    initSidebar();
    migrateCategorySource(); // ✅ Fix legacy category data
    updateSidebarBadges();
    initTheme();
    initAdminProfile(); // ✅ Initialize profile dropdown and modals

    // STEP 11: Restore last active section, default to dashboard on first load
    const lastSection = sessionStorage.getItem('adminActiveSection') || 'dashboard';
    activateSection(lastSection);
});


// ─── SECTION RENDERERS ───────────────────────────────────────

const sectionRenderers = {
    dashboard:  renderDashboard,
    sellers:    renderSellers,
    requests:   renderRequests,
    categories: renderCategories,
    customers:  renderCustomers,
    products:   renderProducts,
    orders:     renderOrders,
    reviews:    renderReviews,
    analytics:  renderAnalytics
};

function initSidebar() {
    // Logo → go to dashboard
    document.getElementById('sidebarLogo')?.addEventListener('click', () => {
        activateSection('dashboard');
    });

    // Internal nav links (data-section)
    document.querySelectorAll('a[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            activateSection(link.dataset.section);
            document.getElementById('adminSidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('visible');
        });
    });

    // Storefront — external link, just close mobile sidebar
    document.getElementById('storefrontLink')?.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
            document.getElementById('adminSidebar')?.classList.remove('open');
            document.getElementById('sidebarOverlay')?.classList.remove('visible');
        }
    });
}

function activateSection(section) {
    document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');

    const target = document.getElementById(`${section}Section`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('a[data-section]').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });

    document.title = `Admin Panel — ${section.charAt(0).toUpperCase() + section.slice(1)}`;
    sessionStorage.setItem('adminActiveSection', section);

    const renderer = sectionRenderers[section];
    if (renderer) renderer();

    updateSidebarBadges();
}
window.activateSection = activateSection;


// ─── SIDEBAR BADGES ──────────────────────────────────────────

function updateSidebarBadges() {
    const requests         = getLS(KEY_APPROVAL) || [];
    const pendingRequests  = requests.filter(r => r.status === 'pending').length;
    const categories        = getLS(KEY_CATEGORIES) || [];
    // Count all drafts (seller suggestions + admin-created review items)
    const pendingCategories = categories.filter(c => c.visibility === 'draft').length;

    const setBadge = (selector, count) => {
        const el = document.querySelector(selector);
        if (!el) return;
        if (count > 0) {
            el.textContent = count > 99 ? '99+' : count;
            el.classList.remove('d-none');
        } else {
            el.classList.add('d-none');
        }
    };

    setBadge('a[data-section="requests"] .nav-badge',   pendingRequests);
    setBadge('a[data-section="categories"] .nav-badge', pendingCategories);
    updateNotificationsBell(pendingRequests + pendingCategories);
}
window.updateSidebarBadges = updateSidebarBadges;

function updateNotificationsBell(totalCount) {
    const bell  = document.getElementById('notificationsBell');
    const badge = document.getElementById('notificationsBadge');
    if (!bell || !badge) return;

    const requests          = getLS(KEY_APPROVAL) || [];
    const pendingRequests   = requests.filter(r => r.status === 'pending').length;
    const categories        = getLS(KEY_CATEGORIES) || [];
    const pendingCategories = categories.filter(c => c.visibility === 'draft').length;

    if (totalCount > 0) {
        badge.classList.remove('d-none');
        badge.textContent = totalCount > 99 ? '99+' : totalCount;
        bell.title = `${totalCount} pending item(s)`;
    } else {
        badge.classList.add('d-none');
        bell.title = 'No notifications';
    }

    bell.onclick = () => {
        if (pendingRequests > 0) {
            document.querySelector('[data-section="requests"]')?.click();
        } else if (pendingCategories > 0) {
            document.querySelector('[data-section="categories"]')?.click();
        }
    };
}


// ─── THEME ───────────────────────────────────────────────────

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('adminTheme') || 'light';
    applyTheme(savedTheme);
    themeToggle.onclick = () => {
        const current  = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('adminTheme', newTheme);
        const currentSection = sessionStorage.getItem('adminActiveSection') || 'dashboard';
        window.activateSection(currentSection);
    };
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) themeIcon.className = theme === 'dark' ? 'bi bi-moon-stars' : 'bi bi-sun';
}

/**
 * Backwards compatibility: Adds 'source' and 'suggestedBy' to categories
 * that were created before this logic existed.
 */
export function migrateCategorySource() {
    const categories = getLS(KEY_CATEGORIES) || [];
    let changed = false;

    const migrated = categories.map(c => {
        if (!c.source) {
            changed = true;
            return {
                ...c,
                source: 'admin',
                suggestedBy: null,
                createdAt: c.createdAt || new Date().toISOString()
            };
        }
        return c;
    });

    if (changed) {
        setLS(KEY_CATEGORIES, migrated);
        console.log('[MIGRATION] Categories patched with source:admin');
    }
}
