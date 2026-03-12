/**
 * CartPage.js – DEALPORT Cart Page Controller
 * Handles rendering, interactions, and checkout on Cart.html
 */

import {
  getCart, removeFromCart, updateCartQty, clearCart,
  getCartSubtotal, getShipping, getCartTotal, getCartCount,
  placeOrder,
} from './Cart.js';
import { getCurrentUser, logoutUser } from '../Core/Auth.js';

const FREE_SHIPPING_THRESHOLD = 49;
const PROMO_CODES = {
  'DEAL10':  { type: 'percent', value: 10, label: '10% off' },
  'SAVE5':   { type: 'fixed',   value: 5,  label: '$5 off' },
  'WELCOME': { type: 'percent', value: 15, label: '15% off for new customers' },
};

let appliedPromo = null;

document.addEventListener('DOMContentLoaded', () => {

  /* ══════════════════════════════════════
     NAVBAR AUTH STATE
  ══════════════════════════════════════ */
  const accountDropdown = document.getElementById('accountDropdownMenu');
  const accountLabel    = document.getElementById('accountNavLabel');

  function renderAccountMenu() {
    const user = getCurrentUser();
    if (!user) {
      if (accountLabel) accountLabel.textContent = 'Account';
      if (accountDropdown) accountDropdown.innerHTML = `
        <li><h6 class="dropdown-header">Hello, Guest</h6></li>
        <li><a class="dropdown-item" href="Login.html"><i class="bi bi-box-arrow-in-right me-2 text-success"></i>Login</a></li>
        <li><a class="dropdown-item" href="register.html"><i class="bi bi-person-plus me-2 text-success"></i>Register</a></li>`;
    } else {
      const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      if (accountLabel) accountLabel.textContent = user.name.split(' ')[0];
      if (accountDropdown) accountDropdown.innerHTML = `
        <li>
          <div class="dropdown-user-header">
            <div class="dropdown-user-avatar">${initials}</div>
            <div>
              <div class="dropdown-user-name">${user.name}</div>
              <div class="dropdown-user-email">${user.email}</div>
            </div>
          </div>
        </li>
        <li><hr class="dropdown-divider my-1"></li>
        <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person-circle me-2 text-success"></i>My Profile</a></li>
        <li><a class="dropdown-item" href="profile.html#orders"><i class="bi bi-bag-check me-2 text-success"></i>My Orders</a></li>
        <li><hr class="dropdown-divider my-1"></li>
        <li><a class="dropdown-item text-danger" id="navLogoutBtn" href="#"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>`;
      document.getElementById('navLogoutBtn')?.addEventListener('click', e => {
        e.preventDefault(); logoutUser();
      });
    }
  }
  renderAccountMenu();

  /* ══════════════════════════════════════
     RENDER CART
  ══════════════════════════════════════ */
  const cartEmpty    = document.getElementById('cartEmpty');
  const cartContent  = document.getElementById('cartContent');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartBadge    = document.getElementById('cartBadge');

  function refreshAll() {
    const cart = getCart();

    // Badge
    if (cartBadge) cartBadge.textContent = getCartCount();

    if (cart.length === 0) {
      cartEmpty?.classList.remove('d-none');
      cartContent?.classList.add('d-none');
      return;
    }
    cartEmpty?.classList.add('d-none');
    cartContent?.classList.remove('d-none');

    renderItems(cart);
    renderSummary(cart);
  }

  function renderItems(cart) {
    if (!cartItemsList) return;
    document.getElementById('cartItemCount').textContent = `(${cart.length} item${cart.length !== 1 ? 's' : ''})`;

    cartItemsList.innerHTML = cart.map(item => {
      const img = item.image
        ? item.image
        : `https://placehold.co/90x90/ecfdf5/16a34a?text=${encodeURIComponent(item.name)}`;
      const oldPriceHTML = item.oldPrice
        ? `<span class="cart-item-price-old">$${item.oldPrice.toFixed(2)}</span>` : '';
      const itemSubtotal = (item.price * (item.quantity || 1)).toFixed(2);

      return `
        <div class="cart-item" data-id="${item.id}">
          <img src="${img}" alt="${item.name}" class="cart-item-img"
               onerror="this.src='https://placehold.co/90x90/ecfdf5/16a34a?text=No+Image'"/>
          <div class="cart-item-info">
            <div class="cart-item-category">${item.category || ''}</div>
            <div class="cart-item-name" title="${item.name}">${item.name}</div>
            <div class="cart-item-prices">
              <span class="cart-item-price-now">$${item.price.toFixed(2)}</span>
              ${oldPriceHTML}
            </div>
            <div class="cart-qty-wrap">
              <button class="cart-qty-btn btn-qty-minus" data-id="${item.id}">−</button>
              <input type="number" class="cart-qty-input" value="${item.quantity || 1}"
                     min="1" max="99" data-id="${item.id}" readonly/>
              <button class="cart-qty-btn btn-qty-plus" data-id="${item.id}">+</button>
            </div>
          </div>
          <div class="cart-item-right">
            <span class="cart-item-subtotal">$${itemSubtotal}</span>
            <button class="btn-remove-item" data-id="${item.id}" title="Remove">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    // Bind quantity buttons
    cartItemsList.querySelectorAll('.btn-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = getCart().find(i => String(i.id) === String(id));
        if (item) updateCartQty(id, (item.quantity || 1) - 1);
        refreshAll();
      });
    });
    cartItemsList.querySelectorAll('.btn-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = getCart().find(i => String(i.id) === String(id));
        if (item) updateCartQty(id, (item.quantity || 1) + 1);
        refreshAll();
      });
    });

    // Bind remove buttons
    cartItemsList.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromCart(btn.dataset.id);
        refreshAll();
      });
    });
  }

  function renderSummary(cart) {
    const subtotal  = getCartSubtotal();
    const shipping  = getShipping();
    const discount  = calcPromoDiscount(subtotal);
    const total     = Math.max(0, subtotal + shipping - discount);

    document.getElementById('summaryItemCount').textContent =
      cart.reduce((s, i) => s + (i.quantity || 1), 0);
    document.getElementById('summarySubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('summaryShipping').textContent =
      shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    if (document.getElementById('summaryShipping'))
      document.getElementById('summaryShipping').className =
        `val${shipping === 0 ? ' free' : ''}`;
    document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;

    // Promo row
    const discountRow = document.getElementById('summaryDiscountRow');
    if (discount > 0) {
      discountRow.style.display = '';
      document.getElementById('summaryDiscount').textContent = `-$${discount.toFixed(2)}`;
    } else {
      discountRow.style.display = 'none';
    }

    // Free shipping bar
    const barText = document.getElementById('shippingBarText');
    const barFill = document.getElementById('shippingBarFill');
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      if (barText) barText.innerHTML = '<i class="bi bi-truck me-1"></i> You\'ve unlocked <strong>Free Shipping!</strong> 🎉';
      if (barFill) barFill.style.width = '100%';
    } else {
      const remaining = (FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2);
      const pct = Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100);
      if (barText) barText.innerHTML = `<i class="bi bi-truck me-1"></i> Add <strong>$${remaining}</strong> more for Free Shipping`;
      if (barFill) barFill.style.width = `${pct}%`;
    }
  }

  function calcPromoDiscount(subtotal) {
    if (!appliedPromo) return 0;
    const code = PROMO_CODES[appliedPromo.toUpperCase()];
    if (!code) return 0;
    return code.type === 'percent'
      ? parseFloat((subtotal * code.value / 100).toFixed(2))
      : Math.min(code.value, subtotal);
  }

  /* ══════════════════════════════════════
     CLEAR CART BUTTON
  ══════════════════════════════════════ */
  document.getElementById('btnClearCart')?.addEventListener('click', () => {
    if (confirm('Remove all items from your cart?')) {
      clearCart();
      appliedPromo = null;
      refreshAll();
    }
  });

  /* ══════════════════════════════════════
     PROMO CODE
  ══════════════════════════════════════ */
  document.getElementById('promoApplyBtn')?.addEventListener('click', () => {
    const code = document.getElementById('promoInput')?.value.trim().toUpperCase();
    const msgEl = document.getElementById('promoMsg');
    if (!code) return;
    if (PROMO_CODES[code]) {
      appliedPromo = code;
      if (msgEl) {
        msgEl.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>${PROMO_CODES[code].label} applied!</span>`;
      }
      renderSummary(getCart());
    } else {
      appliedPromo = null;
      if (msgEl) {
        msgEl.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle me-1"></i>Invalid promo code.</span>`;
      }
    }
  });

  /* ══════════════════════════════════════
     CHECKOUT MODAL
  ══════════════════════════════════════ */
  document.getElementById('btnCheckout')?.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      alert('Please sign in to proceed to checkout.');
      window.location.href = 'Login.html';
      return;
    }
    // Populate checkout summary
    const sub = getCartSubtotal();
    const disc = calcPromoDiscount(sub);
    const total = Math.max(0, sub + getShipping() - disc);
    const summaryEl = document.getElementById('checkoutOrderSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <strong>Order Summary</strong>
        <div class="d-flex justify-content-between mt-2 small">
          <span>Subtotal</span><span>$${sub.toFixed(2)}</span>
        </div>
        ${getShipping() === 0
          ? '<div class="d-flex justify-content-between small"><span>Shipping</span><span class="text-success fw-bold">FREE</span></div>'
          : `<div class="d-flex justify-content-between small"><span>Shipping</span><span>$${getShipping().toFixed(2)}</span></div>`
        }
        ${disc > 0 ? `<div class="d-flex justify-content-between small"><span>Discount</span><span class="text-success">-$${disc.toFixed(2)}</span></div>` : ''}
        <div class="d-flex justify-content-between fw-bold mt-1"><span>Total</span><span>$${total.toFixed(2)}</span></div>
      `;
    }
    // Reset form
    document.getElementById('checkoutForm')?.classList.remove('d-none');
    document.getElementById('checkoutSuccess')?.classList.add('d-none');
    document.getElementById('checkoutError')?.classList.add('d-none');

    const modal = new bootstrap.Modal(document.getElementById('checkoutModal'));
    modal.show();
  });

  document.getElementById('btnPlaceOrder')?.addEventListener('click', () => {
    const address = document.getElementById('checkoutAddress')?.value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash';
    const errEl = document.getElementById('checkoutError');

    if (!address) {
      if (errEl) { errEl.textContent = 'Please enter your delivery address.'; errEl.classList.remove('d-none'); }
      return;
    }
    errEl?.classList.add('d-none');

    const result = placeOrder({ address, paymentMethod });
    if (!result.success) {
      if (errEl) { errEl.textContent = result.error; errEl.classList.remove('d-none'); }
      return;
    }

    // Show success
    document.getElementById('checkoutForm')?.classList.add('d-none');
    document.getElementById('checkoutSuccess')?.classList.remove('d-none');
    const badge = document.getElementById('orderIdBadge');
    if (badge) badge.textContent = result.order.id;

    // Refresh cart
    appliedPromo = null;
    refreshAll();
  });

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  refreshAll();
});
