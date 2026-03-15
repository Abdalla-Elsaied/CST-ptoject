/**
 * profile.js  –  DEALPORT Profile Page
 * Feature 6 – Orders tab: cancel (pending), delete (delivered),
 *             click order → orderDetails.html?id=ORDER_ID
 */

import { getCurrentUser, logoutUser, updateCurrentUserInStorage, ROLES } from '../Core/Auth.js';
import { getWishlist, removeFromWishlist } from './Wishlist.js';
import { getLS, setLS, initUsers  } from '../Core/Storage.js';
import { KEY_ORDERS } from '../Core/Constants.js';
import { uploadProfilePhoto } from '../Core/FileStorage.js';

/* ── Guard ───────────────────────────────────────── */
const user = getCurrentUser();
if (!user) { window.location.href = 'CustomerHomePage.html'; }

initUsers();

/* ── DOM refs ────────────────────────────────────── */
const avatarInitials = document.getElementById('avatarInitials');
const sidebarName = document.getElementById('sidebarName');
const sidebarRole = document.getElementById('sidebarRole');
const sideWishCount = document.getElementById('sideWishCount');
const fieldName = document.getElementById('fieldName');
const fieldEmail = document.getElementById('fieldEmail');
const fieldPhone = document.getElementById('fieldPhone');
const fieldCity = document.getElementById('fieldCity');
const fieldBio = document.getElementById('fieldBio');
const metaJoined = document.getElementById('metaJoined');
const metaRole = document.getElementById('metaRole');
const metaWishlist = document.getElementById('metaWishlist');
const editInfoBtn = document.getElementById('editInfoBtn');
const infoFormActions = document.getElementById('infoFormActions');
const cancelInfoBtn = document.getElementById('cancelInfoBtn');
const infoForm = document.getElementById('infoForm');
const securityForm = document.getElementById('securityForm');
const securityError = document.getElementById('securityError');
const strengthBar = document.getElementById('strengthBar');
const strengthLabel = document.getElementById('strengthLabel');
const strengthBarWrap = document.getElementById('passwordStrengthBar');
const fieldNewPass = document.getElementById('fieldNewPass');
const wishlistGrid = document.getElementById('profileWishlistGrid');
const clearWishlistBtn = document.getElementById('clearWishlistBtn');
const profileToast = document.getElementById('profileToast');
const profileToastMsg = document.getElementById('profileToastMsg');
const sidebarLogout = document.getElementById('sidebarLogout');

/* ── Helpers ─────────────────────────────────────── */
function getInitials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
function showToast(msg, isError = false) {
  if (!profileToast || !profileToastMsg) return;
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

/* ── Populate user data ──────────────────────────── */
function populateUser() {
  const u = getCurrentUser();
  console.log(u)

  if (!u) return;
  if (avatarInitials) avatarInitials.textContent = getInitials(u.name);
  const avatarPhoto = document.getElementById('avatarPhoto');
  if (u.photoUrl && avatarPhoto) {
    avatarPhoto.src = u.photoUrl;
    avatarPhoto.style.display = 'block';
    if (avatarInitials) avatarInitials.style.display = 'none';
  } else if (avatarPhoto) {
    avatarPhoto.style.display = 'none';
    if (avatarInitials) avatarInitials.style.display = '';
  }

  if (sidebarName) sidebarName.textContent = u.name || '–';
  if (sidebarRole) sidebarRole.textContent = u.role || 'customer';
  if (fieldName) fieldName.value = u.name || '';
  if (fieldEmail) fieldEmail.value = u.email || '';
  if (fieldPhone) fieldPhone.value = u.phone || '';
  if (fieldCity) fieldCity.value = u.city || '';
  if (fieldBio) fieldBio.value = u.bio || '';
  if (metaJoined) metaJoined.textContent = formatDate(u.createdAt);
  if (metaRole) metaRole.textContent = u.role || 'customer';
  const wCount = getWishlist().length;
  if (metaWishlist) metaWishlist.textContent = `${wCount} item${wCount !== 1 ? 's' : ''}`;
  if (sideWishCount) {
    sideWishCount.textContent = wCount;
    sideWishCount.style.display = wCount > 0 ? '' : 'none';
  }
}
populateUser();

/* ── Tab switching ───────────────────────────────── */
document.querySelectorAll('.sidenav-item[data-tab]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll('.sidenav-item').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    if (tab === 'wishlist') renderWishlistTab();
    if (tab === 'orders') renderOrdersTab();
  });
});

// Auto-open orders tab if URL hash is #orders
if (window.location.hash === '#orders') {
  document.querySelector('.sidenav-item[data-tab="orders"]')?.click();
}

/* ── Edit Info ───────────────────────────────────── */
let editMode = false;
editInfoBtn?.addEventListener('click', () => {
  editMode = !editMode;
  [fieldName, fieldPhone, fieldCity, fieldBio].forEach(f => { if (f) f.disabled = !editMode; });
  if (fieldEmail) fieldEmail.disabled = true;
  infoFormActions?.classList.toggle('d-none', !editMode);
  if (editInfoBtn) editInfoBtn.innerHTML = editMode ? '<i class="bi bi-x me-1"></i> Cancel' : '<i class="bi bi-pencil me-1"></i> Edit';
  if (!editMode) cancelEdit();
});
cancelInfoBtn?.addEventListener('click', cancelEdit);
function cancelEdit() {
  editMode = false;
  populateUser();
  [fieldName, fieldPhone, fieldCity, fieldBio, fieldEmail].forEach(f => { if (f) f.disabled = true; });
  infoFormActions?.classList.add('d-none');
  if (editInfoBtn) editInfoBtn.innerHTML = '<i class="bi bi-pencil me-1"></i> Edit';
}
infoForm?.addEventListener('submit', e => {
  e.preventDefault();
  const name = fieldName?.value.trim();
  if (!name) { showToast('Name cannot be empty', true); return; }
  const ok = updateCurrentUserInStorage({ name, phone: fieldPhone?.value.trim(), city: fieldCity?.value.trim(), bio: fieldBio?.value.trim() });
  if (ok) { showToast('Profile updated successfully!'); cancelEdit(); populateUser(); }
  else showToast('Failed to save. Please try again.', true);
});

/* ── Password strength ───────────────────────────── */
fieldNewPass?.addEventListener('input', () => {
  const val = fieldNewPass.value;
  if (!val) { strengthBarWrap?.classList.add('d-none'); return; }
  strengthBarWrap?.classList.remove('d-none');
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { label: 'Very Weak', color: '#ef4444', width: '20%' },
    { label: 'Weak', color: '#f97316', width: '40%' },
    { label: 'Fair', color: '#f59e0b', width: '60%' },
    { label: 'Strong', color: '#22c55e', width: '80%' },
    { label: 'Very Strong', color: '#16a34a', width: '100%' },
  ];
  const lv = levels[Math.min(score, 4)];
  if (strengthBar) { strengthBar.style.background = lv.color; strengthBar.style.width = lv.width; }
  if (strengthLabel) { strengthLabel.textContent = lv.label; strengthLabel.style.color = lv.color; }
});

/* ── Change Password ─────────────────────────────── */
securityForm?.addEventListener('submit', e => {
  e.preventDefault();
  securityError?.classList.add('d-none');
  const current = document.getElementById('fieldCurrentPass')?.value;
  const newPass = document.getElementById('fieldNewPass')?.value;
  const confirm = document.getElementById('fieldConfirmPass')?.value;
  const u = getCurrentUser();
  if (!u) return;
  const showErr = msg => { if (securityError) { securityError.textContent = msg; securityError.classList.remove('d-none'); } };
  if (current !== u.password) return showErr('Current password is incorrect.');
  if ((newPass?.length || 0) < 6) return showErr('New password must be at least 6 characters.');
  if (newPass !== confirm) return showErr('Passwords do not match.');
  const ok = updateCurrentUserInStorage({ password: newPass });
  if (ok) { showToast('Password updated successfully!'); securityForm.reset(); strengthBarWrap?.classList.add('d-none'); }
  else showToast('Failed to update password.', true);
});

/* ── Password eye toggle ─────────────────────────── */
document.querySelectorAll('.btn-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.querySelector('i').className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
  });
});

/* ── Wishlist tab ────────────────────────────────── */
function renderWishlistTab() {
  if (!wishlistGrid) return;
  const list = getWishlist();
  if (list.length === 0) {
    wishlistGrid.innerHTML = `
      <div class="col-12 wishlist-empty-state">
        <i class="bi bi-heart text-muted"></i>
        <h5>Your wishlist is empty</h5>
        <p class="small text-muted">Browse products and click the ♡ to save them here.</p>
        <a href="CustomerHomePage.html" class="btn btn-save mt-2">Start Shopping</a>
      </div>`;
    return;
  }
  wishlistGrid.innerHTML = list.map(p => {
    const img = p.image || `https://placehold.co/300x200/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
    return `
      <div class="col-6 col-md-4 col-lg-3" id="wcard-${p.id}">
        <div class="profile-wishlist-card">
          <a href="product-details.html?id=${p.id}">
            <img src="${img}" alt="${p.name}" onerror="this.src='https://placehold.co/300x200/ecfdf5/16a34a?text=No+Image'"/>
          </a>
          <div class="pw-body">
            <a href="product-details.html?id=${p.id}" class="pw-name text-decoration-none text-dark">${p.name}</a>
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
      if (wishlistGrid.querySelectorAll('[id^="wcard-"]').length === 0) renderWishlistTab();
    });
  });
}
clearWishlistBtn?.addEventListener('click', () => {
  if (!confirm('Clear your entire wishlist?')) return;
  getWishlist().forEach(p => removeFromWishlist(p.id));
  renderWishlistTab();
  populateUser();
});

/* ── Orders tab – Feature 6 ──────────────────────── */
function renderOrdersTab() {
  const orders = getLS(KEY_ORDERS) || [];
  const u = getCurrentUser();
  const myOrders = orders.filter(o => o.userId === u?.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const grid = document.getElementById('ordersGrid');
  const empty = document.getElementById('ordersEmpty');
  if (!grid || !empty) return;

  if (myOrders.length === 0) {
    grid.classList.add('d-none');
    empty.classList.remove('d-none');
    return;
  }

  empty.classList.add('d-none');
  grid.classList.remove('d-none');

  const statusIcon = {
    pending: 'bi-hourglass-split text-warning',
    shipped: 'bi-truck text-info',
    delivered: 'bi-check-circle-fill text-success',
    cancelled: 'bi-x-circle-fill text-danger',
  };

  grid.innerHTML = myOrders.map(o => {
    const status = (o.status || 'pending').toLowerCase();
    const canCancel = status === 'pending';
    const canDelete = status === 'delivered' || status === 'cancelled';
    const icon = statusIcon[status] || 'bi-bag';

    return `
      <div class="order-card" id="ocard-${o.id}">
        <div class="order-card-top">
          <div class="order-card-id">
            <i class="bi ${icon} me-2"></i>
            <a href="orderDetails.html?id=${o.id}" class="order-id-link" title="View order details">#${o.id.slice(-10)}</a>
          </div>
          <span class="order-status order-status--${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
        <div class="order-card-meta">
          <span><i class="bi bi-calendar3 me-1"></i>${formatDate(o.createdAt)}</span>
          <span><i class="bi bi-bag me-1"></i>${o.items?.length || 0} item${(o.items?.length || 0) !== 1 ? 's' : ''}</span>
          <span class="order-card-total"><i class="bi bi-currency-dollar me-1"></i>${parseFloat(o.total || 0).toFixed(2)}</span>
        </div>
        <div class="order-card-actions">
          <a href="orderDetails.html?id=${o.id}" class="btn-order-details">
            <i class="bi bi-eye me-1"></i>View Details
          </a>
          ${canCancel ? `<button class="btn-order-cancel" data-id="${o.id}"><i class="bi bi-x-circle me-1"></i>Cancel</button>` : ''}
          ${canDelete ? `<button class="btn-order-delete" data-id="${o.id}"><i class="bi bi-trash me-1"></i>Delete</button>` : ''}
        </div>
      </div>`;
  }).join('');

  // Cancel order (pending → cancelled)
  grid.querySelectorAll('.btn-order-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Are you sure you want to cancel this order?')) return;
      updateOrderStatus(btn.dataset.id, 'cancelled');
      renderOrdersTab();
      showToast('Order cancelled.');
    });
  });

  // Delete order (delivered only)
  grid.querySelectorAll('.btn-order-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this order from your history?')) return;
      deleteOrder(btn.dataset.id);
      renderOrdersTab();
      showToast('Order removed from history.');
    });
  });
}

function updateOrderStatus(orderId, newStatus) {
  const orders = getLS(KEY_ORDERS) || [];
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = newStatus;
    setLS(KEY_ORDERS, orders);
  }
}

function deleteOrder(orderId) {
  const orders = getLS(KEY_ORDERS) || [];
  setLS(KEY_ORDERS, orders.filter(o => o.id !== orderId));
}

/* ── Logout ──────────────────────────────────────── */
sidebarLogout?.addEventListener('click', e => { e.preventDefault(); logoutUser(); });

document.getElementById('avatarUploadInput')?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const btn = document.querySelector('.avatar-upload-btn');
  if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  try {
    const url = await uploadProfilePhoto(file);
    const ok = updateCurrentUserInStorage({ photoUrl: url });
    if (ok) { showToast('Profile photo updated!'); populateUser(); }
    else showToast('Failed to save photo.', true);
  } catch (err) {
    showToast('Upload failed. Please try again.', true);
  } finally {
    if (btn) btn.innerHTML = '<i class="bi bi-camera-fill"></i>';
    this.value = '';
  }
});
