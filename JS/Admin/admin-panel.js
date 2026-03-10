// ============================================================
// admin-panel.js
// Auth guard + sidebar switching + page init.
// This file is loaded LAST — after all section files are loaded.
// Depends on: admin-helpers.js + all admin-[section].js files
// ============================================================

import { getCurrentUser } from './admin-helpers.js';
import { renderDashboard } from './admin-dashboard.js';
import { renderSellers } from './admin-sellers.js';
import { renderRequests } from './admin-requests.js';
import { renderCategories } from './admin-categories.js';
import { renderCustomers } from './admin-customers.js';
import { renderProducts } from './admin-products.js';
import { renderOrders } from './admin-orders.js';
import { renderAnalytics } from './admin-analytics.js';

// ─── AUTH GUARD ──────────────────────────────────────────────
// Must be the very first thing that runs — before any DOM code.
const _currentUser = getCurrentUser();

if (!_currentUser || _currentUser.role !== 'admin') {
    window.location.href = '../Customer/Login.html';
}


// ─── PAGE INIT ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Show admin name in the top navbar
    const adminName = (_currentUser && (_currentUser.fullName || _currentUser.name)) || 'Admin';
    const nameEl = document.getElementById('adminUserName');
    if (nameEl) nameEl.textContent = adminName;

    // Populate sidebar user profile
    const sidebarNameEl = document.getElementById('sidebarUserName');
    if (sidebarNameEl) sidebarNameEl.textContent = adminName;
    const sidebarAvatarEl = document.getElementById('sidebarUserAvatar');
    if (sidebarAvatarEl) sidebarAvatarEl.textContent = adminName.charAt(0).toUpperCase();

    // Show current date in topbar
    const dateEl = document.getElementById('topbarDate');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });
    }

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('ls_currentUser');
        window.location.href = '../Customer/Login.html';
    });

    // Sidebar mobile toggle (hamburger button)
    const hamburger = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('visible');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }

    // Init sidebar navigation
    initSidebar();

    // Load the last active section, or default to dashboard
    const lastSection = sessionStorage.getItem('adminActiveSection') || 'dashboard';
    activateSection(lastSection);
});


// ─── SIDEBAR NAVIGATION ──────────────────────────────────────

/**
 * Maps each section name to its render function.
 * Each function lives in its own JS file.
 */
const sectionRenderers = {
    dashboard: renderDashboard,   // admin-dashboard.js
    sellers: renderSellers,       // admin-sellers.js
    requests: renderRequests,     // admin-requests.js
    categories: renderCategories, // admin-categories.js
    customers: renderCustomers,   // admin-customers.js
    products: renderProducts,     // admin-products.js
    orders: renderOrders,         // admin-orders.js
    analytics: renderAnalytics    // admin-analytics.js
};

/**
 * Binds click events to all sidebar nav links.
 */
function initSidebar() {
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            activateSection(section);

            // Close sidebar on mobile after clicking
            document.getElementById('adminSidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('visible');
        });
    });
}

/**
 * Shows the target section, hides all others, updates active nav state.
 * Saves the active section to sessionStorage so it persists on refresh.
 * @param {string} section - one of: dashboard, sellers, customers, products, orders, analytics
 */
function activateSection(section) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(el => {
        el.style.display = 'none';
    });

    // Show the target section
    const target = document.getElementById(`${section}Section`);
    if (target) target.style.display = 'block';

    // Update active nav link styling
    document.querySelectorAll('[data-section]').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });

    // Update browser tab title
    document.title = `Admin Panel — ${capitalize(section)}`;

    // Save for next page load
    sessionStorage.setItem('adminActiveSection', section);

    // Call the section's render function
    const renderer = sectionRenderers[section];
    if (renderer) renderer();
}

/**
 * Capitalizes the first letter of a string.
 * Used for the browser tab title.
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
