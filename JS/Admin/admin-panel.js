// ============================================================
// admin-panel.js
// Auth guard + sidebar switching + page init.
// This file is loaded LAST — after all section files are loaded.
// Depends on: admin-helpers.js + all admin-[section].js files
// ============================================================

import { getCurrentUser } from '/JS/Admin/admin-helpers.js';
import { renderDashboard } from '/JS/Admin/admin-dashboard.js';
import { renderSellers } from '/JS/Admin/admin-sellers.js';
import { renderCustomers } from '/JS/Admin/admin-customers.js';
import { renderProducts } from '/JS/Admin/admin-products.js';
import { renderOrders } from '/JS/Admin/admin-orders.js';
import { renderAnalytics } from '/JS/Admin/admin-analytics.js';

// ─── AUTH GUARD ──────────────────────────────────────────────
// Must be the very first thing that runs — before any DOM code.
// If the user is not an admin, redirect immediately to login.

const _currentUser = getCurrentUser();

if (!_currentUser || _currentUser.role !== 'admin') {
    window.location.href = '/Html/Customer/Login.html';
}


// ─── PAGE INIT ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Show admin name in the top navbar
    const nameEl = document.getElementById('adminUserName');
    if (nameEl && _currentUser) {
        nameEl.textContent = _currentUser.fullName || _currentUser.name || 'Admin';
    }

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('ls_currentUser');
        window.location.href = '/Html/Customer/Login.html';
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
