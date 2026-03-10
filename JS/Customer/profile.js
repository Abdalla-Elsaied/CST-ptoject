/**
 * profile.js  –  DEALPORT Profile Page
 * Uses auth.js functions to read/update the current user from localStorage.
 */

import {
  getCurrentUser,
  logoutUser,
  updateCurrentUserInStorage,
} from '../Core/Auth.js';

import { getWishlist, removeFromWishlist } from './Wishlist.js';
import { getLS } from '../Core/FileStorage.js';
import { KEY_ORDERS } from '../Core/Constants.js';

/* ── Guard: redirect if not logged in ───────────────── */
const user = getCurrentUser();
if (!user) { window.location.href = 'CustomerHomePage.html'; }

/* ── DOM refs ────────────────────────────────────────── */
const avatarEl       = document.getElementById('profileAvatarDisplay');
const avatarInitials = document.getElementById('avatarInitials');
const sidebarName    = document.getElementById('sidebarName');
const sidebarRole    = document.getElementById('sidebarRole');
const sideWishCount  = document.getElementById('sideWishCount');

const fieldName    = document.getElementById('fieldName');
const fieldEmail   = document.getElementById('fieldEmail');
const fieldPhone   = document.getElementById('fieldPhone');
const fieldCity    = document.getElementById('fieldCity');
const fieldBio     = document.getElementById('fieldBio');
const metaJoined   = document.getElementById('metaJoined');
const metaRole     = document.getElementById('metaRole');
const metaWishlist = document.getElementById('metaWishlist');

const editInfoBtn      = document.getElementById('editInfoBtn');
const infoFormActions  = document.getElementById('infoFormActions');
const cancelInfoBtn    = document.getElementById('cancelInfoBtn');
const infoForm         = document.getElementById('infoForm');

const securityForm     = document.getElementById('securityForm');
const securityError    = document.getElementById('securityError');
const strengthBar      = document.getElementById('strengthBar');
const strengthLabel    = document.getElementById('strengthLabel');
const strengthBarWrap  = document.getElementById('passwordStrengthBar');
const fieldNewPass     = document.getElementById('fieldNewPass');

const wishlistGrid    = document.getElementById('profileWishlistGrid');
const clearWishlistBtn = document.getElementById('clearWishlistBtn');
const profileToast    = document.getElementById('profileToast');
const profileToastMsg = document.getElementById('profileToastMsg');
const sidebarLogout   = document.getElementById('sidebarLogout');

/* ── Helpers ──────────────────────────────────────────── */
function getInitials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function showToast(msg, isError = false) {
  profileToastMsg.textContent = msg;
  profileToast.classList.remove('d-none');
  profileToast.style.background = isError ? '#ef4444' : '#16a34a';
  clearTimeout(profileToast._tid);
  profileToast._tid = setTimeout(() => profileToast.classList.add('d-none'), 3000);
}

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ── Populate page with user data ─────────────────────── */
function populateUser() {
  const u = getCurrentUser();
  if (!u) return;

  const initials = getInitials(u.name);
  avatarInitials.textContent = initials;
  sidebarName.textContent    = u.name || '–';
  sidebarRole.textContent    = u.role || 'customer';

  fieldName.value  = u.name  || '';
  fieldEmail.value = u.email || '';
  fieldPhone.value = u.phone || '';
  fieldCity.value  = u.city  || '';
  fieldBio.value   = u.bio   || '';

  metaJoined.textContent   = formatDate(u.createdAt);
  metaRole.textContent     = u.role || 'customer';

  const wCount = getWishlist().length;
  metaWishlist.textContent  = `${wCount} item${wCount !== 1 ? 's' : ''}`;
  sideWishCount.textContent = wCount;
  sideWishCount.style.display = wCount > 0 ? '' : 'none';
}
populateUser();

/* ── Tab switching ────────────────────────────────────── */
document.querySelectorAll('.sidenav-item[data-tab]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;

    document.querySelectorAll('.sidenav-item').forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');

    if (tab === 'wishlist') renderWishlistTab();
    if (tab === 'orders')   renderOrdersTab();
  });
});

/* ── Edit Info ────────────────────────────────────────── */
let editMode = false;

editInfoBtn.addEventListener('click', () => {
  editMode = !editMode;
  [fieldName, fieldPhone, fieldCity, fieldBio].forEach(f => f.disabled = !editMode);
  fieldEmail.disabled = true; // email cannot be changed
  infoFormActions.classList.toggle('d-none', !editMode);
  editInfoBtn.innerHTML = editMode
    ? '<i class="bi bi-x me-1"></i> Cancel'
    : '<i class="bi bi-pencil me-1"></i> Edit';
  if (!editMode) cancelEdit();
});

cancelInfoBtn.addEventListener('click', cancelEdit);

function cancelEdit() {
  editMode = false;
  populateUser();
  [fieldName, fieldPhone, fieldCity, fieldBio, fieldEmail].forEach(f => f.disabled = true);
  infoFormActions.classList.add('d-none');
  editInfoBtn.innerHTML = '<i class="bi bi-pencil me-1"></i> Edit';
}

infoForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = fieldName.value.trim();
  if (!name) { showToast('Name cannot be empty', true); return; }

  const ok = updateCurrentUserInStorage({
    name,
    phone: fieldPhone.value.trim(),
    city:  fieldCity.value.trim(),
    bio:   fieldBio.value.trim(),
  });

  if (ok) {
    showToast('Profile updated successfully!');
    cancelEdit();
    populateUser();
  } else {
    showToast('Failed to save. Please try again.', true);
  }
});

/* ── Password strength ────────────────────────────────── */
fieldNewPass?.addEventListener('input', () => {
  const val = fieldNewPass.value;
  if (!val) { strengthBarWrap.classList.add('d-none'); return; }
  strengthBarWrap.classList.remove('d-none');

  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { label: 'Very Weak', color: '#ef4444', width: '20%' },
    { label: 'Weak',      color: '#f97316', width: '40%' },
    { label: 'Fair',      color: '#f59e0b', width: '60%' },
    { label: 'Strong',    color: '#22c55e', width: '80%' },
    { label: 'Very Strong', color: '#16a34a', width: '100%' },
  ];
  const lv = levels[Math.min(score, 4)];
  strengthBar.style.background = lv.color;
  strengthBar.style.width      = lv.width;
  strengthLabel.textContent    = lv.label;
  strengthLabel.style.color    = lv.color;
});

/* ── Change Password ──────────────────────────────────── */
securityForm?.addEventListener('submit', e => {
  e.preventDefault();
  securityError.classList.add('d-none');

  const current  = document.getElementById('fieldCurrentPass').value;
  const newPass  = document.getElementById('fieldNewPass').value;
  const confirm  = document.getElementById('fieldConfirmPass').value;
  const u        = getCurrentUser();

  if (!u) return;
  if (current !== u.password) {
    securityError.textContent = 'Current password is incorrect.';
    securityError.classList.remove('d-none');
    return;
  }
  if (newPass.length < 6) {
    securityError.textContent = 'New password must be at least 6 characters.';
    securityError.classList.remove('d-none');
    return;
  }
  if (newPass !== confirm) {
    securityError.textContent = 'Passwords do not match.';
    securityError.classList.remove('d-none');
    return;
  }

  const ok = updateCurrentUserInStorage({ password: newPass });
  if (ok) {
    showToast('Password updated successfully!');
    securityForm.reset();
    strengthBarWrap.classList.add('d-none');
  } else {
    showToast('Failed to update password.', true);
  }
});

/* ── Show/hide password toggle ────────────────────────── */
document.querySelectorAll('.btn-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.querySelector('i').className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
  });
});

/* ── Wishlist tab ─────────────────────────────────────── */
function renderWishlistTab() {
  const list = getWishlist();
  if (list.length === 0) {
    wishlistGrid.innerHTML = `
      <div class="col-12 wishlist-empty-state">
        <i class="bi bi-heart text-muted"></i>
        <h5>Your wishlist is empty</h5>
        <p class="small text-muted">Browse products and click the ♡ to save them here.</p>
        <a href="index.html" class="btn btn-save mt-2">Start Shopping</a>
      </div>`;
    return;
  }

  wishlistGrid.innerHTML = list.map(p => {
    const img = p.image || `https://placehold.co/300x200/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
    return `
      <div class="col-6 col-md-4 col-lg-3" id="wcard-${p.id}">
        <div class="profile-wishlist-card">
          <img src="${img}" alt="${p.name}"
               onerror="this.src='https://placehold.co/300x200/ecfdf5/16a34a?text=No+Image'"/>
          <div class="pw-body">
            <div class="pw-name">${p.name}</div>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <span class="pw-price">$${parseFloat(p.price || 0).toFixed(2)}</span>
              <button class="pw-remove" data-id="${p.id}" title="Remove">
                <i class="bi bi-trash me-1"></i> Remove
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  wishlistGrid.querySelectorAll('.pw-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromWishlist(btn.dataset.id);
      document.getElementById(`wcard-${btn.dataset.id}`)?.remove();
      populateUser();
      if (wishlistGrid.children.length === 0) renderWishlistTab();
    });
  });
}

clearWishlistBtn?.addEventListener('click', () => {
  if (!confirm('Clear your entire wishlist?')) return;
  const list = getWishlist();
  list.forEach(p => removeFromWishlist(p.id));
  renderWishlistTab();
  populateUser();
});

/* ── Orders tab ───────────────────────────────────────── */
function renderOrdersTab() {
  const orders = getLS(KEY_ORDERS) || [];
  const u = getCurrentUser();
  const myOrders = orders.filter(o => o.userId === u?.id);

  const grid   = document.getElementById('ordersGrid');
  const empty  = document.getElementById('ordersEmpty');

  if (myOrders.length === 0) {
    grid.classList.add('d-none');
    empty.classList.remove('d-none');
    return;
  }

  empty.classList.add('d-none');
  grid.classList.remove('d-none');
  grid.innerHTML = myOrders.map(o => `
    <div class="order-row">
      <div class="order-id">#${o.id}</div>
      <div class="order-date">${formatDate(o.createdAt)}</div>
      <div class="order-total">$${parseFloat(o.total || 0).toFixed(2)}</div>
      <span class="order-status order-status--${(o.status||'pending').toLowerCase()}">${o.status || 'Pending'}</span>
    </div>`).join('');
}

/* ── Logout ───────────────────────────────────────────── */
sidebarLogout?.addEventListener('click', e => {
  e.preventDefault();
  logoutUser();
});
