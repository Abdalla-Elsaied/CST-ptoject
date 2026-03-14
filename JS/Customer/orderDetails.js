/**
 * orderDetails.js – DEALPORT Order Details Page
 * Feature 6: view order, cancel (pending), delete (delivered), stock unchanged here
 */

import { getCurrentUser, logoutUser } from '../Core/Auth.js';
import { getLS, setLS }               from '../Core/Storage.js';
import { KEY_ORDERS }                 from '../Core/Constants.js';

const $ = id => document.getElementById(id);
const orderId = new URLSearchParams(location.search).get('id');

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

const PAYMENT_LABELS = {
  cash:     'Cash on Delivery',
  card:     'Credit / Debit Card',
  instapay: 'InstaPay / Wallet',
};

const STATUS_STEPS = ['pending', 'shipped', 'delivered'];
const STATUS_LABELS = {
  pending:   'Pending',
  shipped:   'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const STATUS_ICONS = {
  pending:   'bi-hourglass-split',
  shipped:   'bi-truck',
  delivered: 'bi-check-circle-fill',
  cancelled: 'bi-x-circle-fill',
};

function init() {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'Login.html'; return; }

  if (!orderId) { showError(); return; }

  const orders   = getLS(KEY_ORDERS) || [];
  const order    = orders.find(o => o.id === orderId);

  if (!order || order.userId !== user.id) { showError(); return; }

  $('odLoading')?.classList.add('d-none');
  $('odContent')?.classList.remove('d-none');
  document.title = `Order #${orderId.slice(-8)} – DEALPORT`;

  renderOrder(order);
}

function showError() {
  $('odLoading')?.classList.add('d-none');
  $('odError')?.classList.remove('d-none');
}

function renderOrder(order) {
  const status = (order.status || 'pending').toLowerCase();

  // Status badge
  const badge = $('odStatusBadge');
  if (badge) {
    badge.textContent = STATUS_LABELS[status] || status;
    badge.className   = `order-status order-status--${status}`;
  }

  // Progress track
  renderProgress(status);

  // Items list
  renderItems(order);

  // Summary
  const sub  = parseFloat(order.subtotal || 0);
  const ship = parseFloat(order.shipping || 0);
  const tot  = parseFloat(order.total    || 0);
  if ($('odSubtotal')) $('odSubtotal').textContent = `$${sub.toFixed(2)}`;
  if ($('odShipping')) {
    $('odShipping').textContent = ship === 0 ? 'FREE' : `$${ship.toFixed(2)}`;
    if (ship === 0) $('odShipping').classList.add('text-success','fw-bold');
  }
  if ($('odTotal')) $('odTotal').textContent = `$${tot.toFixed(2)}`;

  // Meta
  if ($('odAddress')) $('odAddress').textContent = order.address || '–';
  if ($('odPayment')) $('odPayment').textContent = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '–';
  if ($('odDate'))    $('odDate').textContent    = formatDate(order.createdAt);
  if ($('odId'))      $('odId').textContent      = order.id;
  if ($('odItemCount')) $('odItemCount').textContent = `${order.items?.length || 0} item${(order.items?.length||0) !== 1 ? 's' : ''}`;

  // Actions
  renderActions(order);
}

function renderProgress(status) {
  const track = $('odProgressTrack');
  if (!track) return;

  if (status === 'cancelled') {
    track.innerHTML = `
      <div class="od-progress-cancelled">
        <i class="bi bi-x-circle-fill text-danger fs-3 me-2"></i>
        <span class="fw-700 text-danger">This order was cancelled.</span>
      </div>`;
    return;
  }

  const currentIdx = STATUS_STEPS.indexOf(status);
  track.innerHTML = STATUS_STEPS.map((step, idx) => {
    const done    = idx <= currentIdx;
    const current = idx === currentIdx;
    return `
      <div class="od-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
        <div class="od-step-icon">
          <i class="bi ${done ? STATUS_ICONS[step] : 'bi-circle'}"></i>
        </div>
        <div class="od-step-label">${STATUS_LABELS[step]}</div>
        ${idx < STATUS_STEPS.length - 1 ? '<div class="od-step-line"></div>' : ''}
      </div>`;
  }).join('');
}

function renderItems(order) {
  const list = $('odItemsList');
  if (!list || !order.items?.length) {
    if (list) list.innerHTML = '<p class="text-muted p-4">No items found.</p>';
    return;
  }
  list.innerHTML = order.items.map(item => {
    const img = item.image || `https://placehold.co/80x80/ecfdf5/16a34a?text=${encodeURIComponent(item.name)}`;
    const lineTotal = (item.price * (item.quantity || 1)).toFixed(2);
    return `
      <div class="od-item">
        <a href="product-details.html?id=${item.id}" title="View product">
          <img src="${img}" alt="${item.name}" class="od-item-img"
               onerror="this.src='https://placehold.co/80x80/ecfdf5/16a34a?text=No+Image'"/>
        </a>
        <div class="od-item-info">
          <a href="product-details.html?id=${item.id}" class="od-item-name text-decoration-none text-dark">${item.name}</a>
          <div class="od-item-category">${item.category || ''}</div>
          <div class="od-item-price">$${item.price.toFixed(2)} × ${item.quantity || 1}</div>
        </div>
        <div class="od-item-total">$${lineTotal}</div>
      </div>`;
  }).join('');
}

function renderActions(order) {
  const wrap  = $('odActions');
  if (!wrap) return;
  const status = (order.status || 'pending').toLowerCase();

  const canCancel = status === 'pending';
  const canDelete = status === 'delivered' || status === 'cancelled';

  if (!canCancel && !canDelete) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    ${canCancel ? `
      <button class="od-btn-cancel" id="odBtnCancel">
        <i class="bi bi-x-circle me-2"></i>Cancel Order
      </button>` : ''}
    ${canDelete ? `
      <button class="od-btn-delete" id="odBtnDelete">
        <i class="bi bi-trash me-2"></i>Delete Order
      </button>` : ''}`;

  $('odBtnCancel')?.addEventListener('click', () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    updateOrderStatus(order.id, 'cancelled');
    window.location.reload();
  });

  $('odBtnDelete')?.addEventListener('click', () => {
    if (!confirm('Delete this order from your history? This cannot be undone.')) return;
    deleteOrder(order.id);
    window.location.href = 'profile.html#orders';
  });
}

function updateOrderStatus(id, newStatus) {
  const orders = getLS(KEY_ORDERS) || [];
  const idx    = orders.findIndex(o => o.id === id);
  if (idx !== -1) { orders[idx].status = newStatus; setLS(KEY_ORDERS, orders); }
}

function deleteOrder(id) {
  setLS(KEY_ORDERS, (getLS(KEY_ORDERS) || []).filter(o => o.id !== id));
}

init();
