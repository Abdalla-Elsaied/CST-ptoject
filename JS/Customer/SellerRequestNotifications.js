/**
 * SellerRequestNotifications.js — Isolated module for seller application status on CustomerHomepage.
 * Shows: Pending | Approved | Rejected | Apply CTA
 * Does NOT modify CustomerHomePage.js — runs standalone when loaded.
 */

import { getCurrentUser } from '../Core/Auth.js';
import { getLS } from '../Core/Storage.js';
import { KEY_APPROVAL, KEY_SELLER_OUTCOMES } from '../Core/Constants.js';

const NOTIFICATION_CONTAINER_ID = 'sellerStatusNotifications';

function getMyPendingRequest(userId) {
  const requests = getLS(KEY_APPROVAL) || [];
  return requests.find((r) => r.userId === userId && r.status === 'pending');
}

function getMyRejectedOutcome(userId) {
  const outcomes = getLS(KEY_SELLER_OUTCOMES) || [];
  const mine = outcomes.filter((o) => o.userId === userId && o.status === 'rejected');
  return mine.length ? mine[mine.length - 1] : null;
}

function renderNotification() {
  const user = getCurrentUser();
  const container = document.getElementById(NOTIFICATION_CONTAINER_ID);
  if (!container) return;

  if (!user) {
    container.innerHTML = `
      <div class="seller-notif seller-notif-cta">
        <div class="seller-notif-icon"><i class="bi bi-shop"></i></div>
        <div class="seller-notif-body">
          <strong>Want to sell on Dealport?</strong>
          <span>Sign in to apply and become a seller.</span>
        </div>
        <a href="Login.html" class="seller-notif-link">Sign In to Apply</a>
        <button class="seller-notif-dismiss" aria-label="Dismiss" data-dismiss="seller-guest">&times;</button>
      </div>`;
    container.setAttribute('data-variant', 'cta');
    container.querySelector('[data-dismiss]').onclick = () => {
      sessionStorage.setItem('seller_notif_dismissed_seller-guest', '1');
      container.style.display = 'none';
    };
    if (sessionStorage.getItem('seller_notif_dismissed_seller-guest')) container.style.display = 'none';
    return;
  }

  const role = user.role?.toLowerCase?.() || 'customer';
  const isAdmin  = role === 'admin';

  // Also check live role from users cache — session may be stale if admin
  // just approved this user while they were already logged in
  let effectiveRole = role;
  try {
    const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
    const liveUser = users.find(u => String(u.id) === String(user.id));
    if (liveUser?.role) effectiveRole = liveUser.role.toLowerCase();
  } catch (_) {}

  const isSeller = effectiveRole === 'seller';
  const pending = getMyPendingRequest(user.id);
  const rejected = getMyRejectedOutcome(user.id);

  let html = '';
  let variant = 'info';

  // ── Admin: clean "Storefront Preview" info bar instead of the seller CTA ──
  if (isAdmin) {
    variant = 'admin';
    container.innerHTML = `
      <div class="seller-notif seller-notif-admin">
        <div class="seller-notif-icon"><i class="bi bi-eye"></i></div>
        <div class="seller-notif-body">
          <strong>Storefront Preview Mode</strong>
          <span>You are browsing as Admin. Customer features (cart, wishlist, checkout) are disabled.</span>
        </div>
        <span class="admin-preview-label"><i class="bi bi-shield-lock-fill"></i> Admin View</span>
        <a href="../Admin/admin-panel.html" class="admin-panel-btn">
          <i class="bi bi-arrow-left-circle"></i> Admin Panel
        </a>
      </div>`;
    container.setAttribute('data-variant', variant);
    return;
  }

  if (isSeller) {
    variant = 'success';
    html = `
      <div class="seller-notif seller-notif-success">
        <div class="seller-notif-icon"><i class="bi bi-check-circle-fill"></i></div>
        <div class="seller-notif-body">
          <strong>You're a seller!</strong>
          <span>Manage your store and start selling.</span>
        </div>
        <a href="../Seller/SellerHomePage.html" class="seller-notif-link">Go to Seller Dashboard <i class="bi bi-arrow-right"></i></a>
        <button class="seller-notif-dismiss" aria-label="Dismiss" data-dismiss="seller-success">&times;</button>
      </div>`;
  } else if (pending) {
    variant = 'pending';
    html = `
      <div class="seller-notif seller-notif-pending">
        <div class="seller-notif-icon"><i class="bi bi-hourglass-split"></i></div>
        <div class="seller-notif-body">
          <strong>Application under review</strong>
          <span>Your request to become a seller is being reviewed. We'll notify you soon.</span>
        </div>
        <span class="seller-notif-badge">Pending</span>
        <button class="seller-notif-dismiss" aria-label="Dismiss" data-dismiss="seller-pending">&times;</button>
      </div>`;
  } else if (rejected) {
    variant = 'rejected';
    html = `
      <div class="seller-notif seller-notif-rejected">
        <div class="seller-notif-icon"><i class="bi bi-x-circle-fill"></i></div>
        <div class="seller-notif-body">
          <strong>Application not approved</strong>
          <span>Your seller application was not approved. You can apply again with updated information.</span>
        </div>
        <a href="#" data-bs-toggle="modal" data-bs-target="#becomeSellerModal" class="seller-notif-link">Apply Again</a>
        <button class="seller-notif-dismiss" aria-label="Dismiss" data-dismiss="seller-rejected">&times;</button>
      </div>`;
  } else {
    variant = 'cta';
    html = `
      <div class="seller-notif seller-notif-cta">
        <div class="seller-notif-icon"><i class="bi bi-shop"></i></div>
        <div class="seller-notif-body">
          <strong>Want to sell on Dealport?</strong>
          <span>Join thousands of sellers and reach more customers.</span>
        </div>
        <a href="#" class="seller-notif-link" data-bs-toggle="modal" data-bs-target="#becomeSellerModal">Become a Seller</a>
        <button class="seller-notif-dismiss" aria-label="Dismiss" data-dismiss="seller-cta">&times;</button>
      </div>`;
  }

  container.innerHTML = html;
  container.setAttribute('data-variant', variant);

  container.querySelectorAll('[data-dismiss]').forEach((btn) => {
    btn.onclick = () => {
      const key = `seller_notif_dismissed_${btn.dataset.dismiss}`;
      sessionStorage.setItem(key, '1');
      container.style.display = 'none';
    };
  });

  const dismissed = sessionStorage.getItem(`seller_notif_dismissed_seller-${variant}`);
  if (dismissed && (variant === 'cta' || variant === 'success')) {
    container.style.display = 'none';
  }
}

function init() {
  const existing = document.getElementById(NOTIFICATION_CONTAINER_ID);
  if (existing) {
    renderNotification();
    return;
  }

  const header = document.querySelector('header.navbar-top');
  if (!header) return;

  const container = document.createElement('div');
  container.id = NOTIFICATION_CONTAINER_ID;
  container.className = 'seller-status-notifications';
  header.insertAdjacentElement('afterend', container);

  renderNotification();
}

document.addEventListener('DOMContentLoaded', init);