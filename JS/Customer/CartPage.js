/**
 * CartPage.js – DEALPORT Cart Page Controller
 * Feature 4 – Cart qty validation (stock, negative, zero) + item → product-details
 * Feature 5 – Checkout: address pre-fill, payment selection, credit card popup,
 *             order summary confirmation, stock update after purchase
 */

import {
  getCart, removeFromCart, updateCartQty, clearCart,
  getCartSubtotal, getShipping, getCartTotal, getCartCount,
  placeOrder,
} from './Cart.js';
import { getCurrentUser, logoutUser } from '../Core/Auth.js';
import { getLS, setLS }               from '../Core/Storage.js';
import { KEY_LOCATION, KEY_ORDERS }   from '../Core/Constants.js';
import { saveProductToDisk }          from '../Core/FileStorage.js';

const FREE_SHIPPING_THRESHOLD = 49;
const PROMO_CODES = {
  'DEAL10':  { type: 'percent', value: 10,  label: '10% off' },
  'SAVE5':   { type: 'fixed',   value: 5,   label: '$5 off' },
  'WELCOME': { type: 'percent', value: 15,  label: '15% off for new customers' },
};

let appliedPromo     = null;
let checkoutStep     = 1; // 1=address, 2=payment, 3=summary, 4=success
let checkoutData     = { address: '', paymentMethod: 'cash', cardDetails: null };

document.addEventListener('DOMContentLoaded', () => {

  /* ══ NAVBAR ══════════════════════════════════════ */
  const accountDropdown = document.getElementById('accountDropdownMenu');
  const accountLabel    = document.getElementById('accountNavLabel');
  const cartBadge       = document.getElementById('cartBadge');

  function renderAccountMenu() {
    const user = getCurrentUser();
    if (!user) {
      if (accountLabel) accountLabel.textContent = 'Account';
      if (accountDropdown) accountDropdown.innerHTML = `
        <li><h6 class="dropdown-header">Hello, Guest</h6></li>
        <li><a class="dropdown-item" href="Login.html"><i class="bi bi-box-arrow-in-right me-2 text-success"></i>Login</a></li>`;
    } else {
      const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      if (accountLabel) accountLabel.textContent = user.name.split(' ')[0];
      if (accountDropdown) accountDropdown.innerHTML = `
        <li>
          <div class="dropdown-user-header">
            <div class="dropdown-user-avatar">${initials}</div>
            <div><div class="dropdown-user-name">${user.name}</div><div class="dropdown-user-email">${user.email}</div></div>
          </div>
        </li>
        <li><hr class="dropdown-divider my-1"></li>
        <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person-circle me-2 text-success"></i>My Profile</a></li>
        <li><a class="dropdown-item" href="profile.html#orders"><i class="bi bi-bag-check me-2 text-success"></i>My Orders</a></li>
        <li><hr class="dropdown-divider my-1"></li>
        <li><a class="dropdown-item text-danger" id="navLogoutBtn" href="#"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>`;
      document.getElementById('navLogoutBtn')?.addEventListener('click', e => { e.preventDefault(); logoutUser(); });
    }
  }
  renderAccountMenu();

  /* ══ RENDER CART ═════════════════════════════════ */
  const cartEmpty    = document.getElementById('cartEmpty');
  const cartContent  = document.getElementById('cartContent');
  const cartItemsList = document.getElementById('cartItemsList');

  function refreshAll() {
    const cart = getCart();
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
    const countEl = document.getElementById('cartItemCount');
    if (countEl) countEl.textContent = `(${cart.length} item${cart.length !== 1 ? 's' : ''})`;

    cartItemsList.innerHTML = cart.map(item => {
      const img = item.image || `https://placehold.co/90x90/ecfdf5/16a34a?text=${encodeURIComponent(item.name)}`;
      const oldPriceHTML = item.oldPrice ? `<span class="cart-item-price-old">$${item.oldPrice.toFixed(2)}</span>` : '';
      const subtotal = (item.price * (item.quantity || 1)).toFixed(2);
      // Feature 4: store stockQuantity on the row
      const stockQty = item.stockQuantity != null ? item.stockQuantity : '';

      return `
        <div class="cart-item" data-id="${item.id}">
          <!-- Feature 4: click image/name → product-details page -->
          <a href="product-details.html?id=${item.id}" title="View product">
            <img src="${img}" alt="${item.name}" class="cart-item-img"
                 onerror="this.src='https://placehold.co/90x90/ecfdf5/16a34a?text=No+Image'"/>
          </a>
          <div class="cart-item-info">
            <div class="cart-item-category">${item.category || ''}</div>
            <a href="product-details.html?id=${item.id}" class="cart-item-name text-decoration-none text-dark" title="${item.name}">${item.name}</a>
            <div class="cart-item-prices">
              <span class="cart-item-price-now">$${item.price.toFixed(2)}</span>
              ${oldPriceHTML}
            </div>
            <div class="cart-qty-wrap">
              <button class="cart-qty-btn btn-qty-minus" data-id="${item.id}" data-stock="${stockQty}">−</button>
              <input type="number" class="cart-qty-input" value="${item.quantity || 1}"
                     min="1" data-id="${item.id}" data-stock="${stockQty}" readonly/>
              <button class="cart-qty-btn btn-qty-plus" data-id="${item.id}" data-stock="${stockQty}">+</button>
            </div>
          </div>
          <div class="cart-item-right">
            <span class="cart-item-subtotal">$${subtotal}</span>
            <button class="btn-remove-item" data-id="${item.id}" title="Remove">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    // Feature 4: qty − with validation
    cartItemsList.querySelectorAll('.btn-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id  = btn.dataset.id;
        const item = getCart().find(i => String(i.id) === String(id));
        if (!item) return;
        const newQty = (item.quantity || 1) - 1;
        if (newQty <= 0) {
          if (confirm(`Remove "${item.name}" from your cart?`)) {
            removeFromCart(id);
            refreshAll();
          }
          return;
        }
        updateCartQty(id, newQty);
        refreshAll();
      });
    });

    // Feature 4: qty + with stock validation — reads stockQuantity from stored cart item
    cartItemsList.querySelectorAll('.btn-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id    = btn.dataset.id;
        const item  = getCart().find(i => String(i.id) === String(id));
        if (!item) return;
        const newQty   = (item.quantity || 1) + 1;
        const stockQty = item.stockQuantity != null ? item.stockQuantity : null;

        // Cannot exceed stock
        if (stockQty !== null && newQty > stockQty) {
          alert(`You cannot add more than the available stock.\n(Maximum available: ${stockQty})`);
          return;
        }
        // Cannot be zero or negative
        if (newQty <= 0) {
          alert('Invalid quantity value.');
          return;
        }
        updateCartQty(id, newQty);
        refreshAll();
      });
    });

    cartItemsList.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => { removeFromCart(btn.dataset.id); refreshAll(); });
    });
  }

  function renderSummary(cart) {
    const subtotal  = getCartSubtotal();
    const shipping  = getShipping();
    const discount  = calcPromoDiscount(subtotal);
    const total     = Math.max(0, subtotal + shipping - discount);

    const totalQty = cart.reduce((s, i) => s + (i.quantity || 1), 0);
    const sumItemCount = document.getElementById('summaryItemCount');
    if (sumItemCount) sumItemCount.textContent = totalQty;

    const sumSub = document.getElementById('summarySubtotal');
    if (sumSub) sumSub.textContent = `$${subtotal.toFixed(2)}`;

    const sumShip = document.getElementById('summaryShipping');
    if (sumShip) {
      sumShip.textContent = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
      sumShip.className   = `val${shipping === 0 ? ' free' : ''}`;
    }

    const sumTotal = document.getElementById('summaryTotal');
    if (sumTotal) sumTotal.textContent = `$${total.toFixed(2)}`;

    const discountRow = document.getElementById('summaryDiscountRow');
    const sumDiscount = document.getElementById('summaryDiscount');
    if (discountRow && sumDiscount) {
      if (discount > 0) {
        discountRow.style.display = '';
        sumDiscount.textContent   = `-$${discount.toFixed(2)}`;
      } else {
        discountRow.style.display = 'none';
      }
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

  /* ══ CLEAR CART ══════════════════════════════════ */
  document.getElementById('btnClearCart')?.addEventListener('click', () => {
    if (confirm('Remove all items from your cart?')) { clearCart(); appliedPromo = null; refreshAll(); }
  });

  /* ══ PROMO CODE ══════════════════════════════════ */
  document.getElementById('promoApplyBtn')?.addEventListener('click', () => {
    const code  = document.getElementById('promoInput')?.value.trim().toUpperCase();
    const msgEl = document.getElementById('promoMsg');
    if (!code) return;
    if (PROMO_CODES[code]) {
      appliedPromo = code;
      if (msgEl) msgEl.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>${PROMO_CODES[code].label} applied!</span>`;
      renderSummary(getCart());
    } else {
      appliedPromo = null;
      if (msgEl) msgEl.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle me-1"></i>Invalid promo code.</span>`;
    }
  });

  /* ══ CHECKOUT MODAL – multi-step ════════════════
     Step 1: Address selection (pre-filled from location)
     Step 2: Payment method + optional credit card form
     Step 3: Order summary confirmation
     Step 4: Success screen (with stock update)
  ══════════════════════════════════════════════════ */
  document.getElementById('btnCheckout')?.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) { alert('Please sign in to proceed to checkout.'); window.location.href = 'Login.html'; return; }
    openCheckoutStep1();
    const modal = new bootstrap.Modal(document.getElementById('checkoutModal'));
    modal.show();
  });

  /* ── Step 1: Address ────────────────────────────── */
  function openCheckoutStep1() {
    checkoutStep = 1;
    const formEl    = document.getElementById('checkoutForm');
    const successEl = document.getElementById('checkoutSuccess');
    if (formEl)    formEl.classList.remove('d-none');
    if (successEl) successEl.classList.add('d-none');
    document.getElementById('checkoutError')?.classList.add('d-none');

    // Feature 5: pre-fill address from saved location
    const savedLoc = getLS(KEY_LOCATION);
    const addrEl   = document.getElementById('checkoutAddress');
    if (addrEl && savedLoc?.address && !addrEl.value) {
      addrEl.value = savedLoc.address;
    }

    // Rebuild modal body to show Step 1
    renderCheckoutBody();
  }

  function renderCheckoutBody() {
    const bodyEl = document.querySelector('#checkoutForm .modal-body');
    if (!bodyEl) return;

    const sub  = getCartSubtotal();
    const disc = calcPromoDiscount(sub);
    const ship = getShipping();
    const tot  = Math.max(0, sub + ship - disc);
    const cart = getCart();

    const savedLoc = getLS(KEY_LOCATION);
    const savedAddr = savedLoc?.address || '';

    bodyEl.innerHTML = `
      <!-- Step indicator -->
      <div class="checkout-steps mb-4">
        <div class="checkout-step ${checkoutStep >= 1 ? 'active' : ''}">
          <div class="step-dot">1</div><span>Address</span>
        </div>
        <div class="checkout-step-line"></div>
        <div class="checkout-step ${checkoutStep >= 2 ? 'active' : ''}">
          <div class="step-dot">2</div><span>Payment</span>
        </div>
        <div class="checkout-step-line"></div>
        <div class="checkout-step ${checkoutStep >= 3 ? 'active' : ''}">
          <div class="step-dot">3</div><span>Confirm</span>
        </div>
      </div>

      ${checkoutStep === 1 ? `
        <!-- Step 1: Address -->
        <label class="checkout-field-label">Delivery Address *</label>
        ${savedAddr ? `<div class="saved-address-box mb-2">
          <i class="bi bi-pin-map-fill text-success me-2"></i>
          <span class="small">${savedAddr}</span>
          <button class="btn-use-saved-addr" id="btnUseSavedAddr">Use This</button>
        </div>` : ''}
        <textarea class="checkout-input" id="checkoutAddress" rows="2"
                  placeholder="e.g. 42 El Nasr St, Cairo, Egypt">${checkoutData.address || ''}</textarea>
        <div id="checkoutError" class="alert alert-danger d-none py-2 small mb-0"></div>
        <button class="btn-place-order" id="btnStep1Next">
          Continue to Payment <i class="bi bi-arrow-right ms-1"></i>
        </button>
      ` : checkoutStep === 2 ? `
        <!-- Step 2: Payment -->
        <label class="checkout-field-label">Payment Method</label>
        <label class="payment-option">
          <input type="radio" name="paymentMethod" value="cash" ${checkoutData.paymentMethod === 'cash' ? 'checked' : ''}/>
          <i class="bi bi-cash-coin"></i> Cash on Delivery
        </label>
        <label class="payment-option">
          <input type="radio" name="paymentMethod" value="card" ${checkoutData.paymentMethod === 'card' ? 'checked' : ''}/>
          <i class="bi bi-credit-card"></i> Credit / Debit Card
        </label>
        <label class="payment-option">
          <input type="radio" name="paymentMethod" value="instapay" ${checkoutData.paymentMethod === 'instapay' ? 'checked' : ''}/>
          <i class="bi bi-phone"></i> InstaPay / Wallet
        </label>

        <!-- Credit card form (shown when card is selected) -->
        <div id="cardFormWrap" class="${checkoutData.paymentMethod === 'card' ? '' : 'd-none'} card-form-wrap mt-3">
          <div class="card-form-header"><i class="bi bi-credit-card-2-front me-2"></i>Card Details</div>
          <label class="checkout-field-label mt-2">Card Number *</label>
          <input type="text" class="checkout-input" id="cardNumber" maxlength="19"
                 placeholder="1234 5678 9012 3456" value="${checkoutData.cardDetails?.cardNumber || ''}"/>
          <div class="row g-2">
            <div class="col-6">
              <label class="checkout-field-label">Cardholder Name *</label>
              <input type="text" class="checkout-input" id="cardName"
                     placeholder="Full name on card" value="${checkoutData.cardDetails?.cardName || ''}"/>
            </div>
            <div class="col-4">
              <label class="checkout-field-label">Expiry *</label>
              <input type="text" class="checkout-input" id="cardExpiry" maxlength="5"
                     placeholder="MM/YY" value="${checkoutData.cardDetails?.cardExpiry || ''}"/>
            </div>
            <div class="col-2">
              <label class="checkout-field-label">CVV *</label>
              <input type="password" class="checkout-input" id="cardCvv" maxlength="4"
                     placeholder="···" value="${checkoutData.cardDetails?.cardCvv || ''}"/>
            </div>
          </div>
        </div>

        <div id="checkoutError" class="alert alert-danger d-none py-2 small mb-0 mt-2"></div>
        <div class="d-flex gap-2 mt-3">
          <button class="btn-continue-shopping" id="btnStep2Back" style="flex:0 0 auto;width:auto;padding:12px 18px">
            <i class="bi bi-arrow-left me-1"></i> Back
          </button>
          <button class="btn-place-order flex-grow-1" id="btnStep2Next">
            Review Order <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      ` : checkoutStep === 3 ? `
        <!-- Step 3: Order Summary -->
        <div class="order-summary-review">
          <h6 class="fw-800 mb-3"><i class="bi bi-receipt me-2 text-success"></i>Order Summary</h6>
          <div class="order-summary-items">
            ${cart.map(item => `
              <div class="os-item">
                <img src="${item.image || 'https://placehold.co/48x48/ecfdf5/16a34a?text=?'}" alt="${item.name}" class="os-img"/>
                <div class="os-info">
                  <div class="os-name">${item.name}</div>
                  <div class="os-qty">×${item.quantity || 1}</div>
                </div>
                <div class="os-price">$${(item.price * (item.quantity || 1)).toFixed(2)}</div>
              </div>`).join('')}
          </div>
          <hr class="my-3"/>
          <div class="os-totals">
            <div class="os-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>
            <div class="os-row"><span>Shipping</span><span class="${ship === 0 ? 'text-success fw-bold' : ''}">${ship === 0 ? 'FREE' : '$' + ship.toFixed(2)}</span></div>
            ${disc > 0 ? `<div class="os-row text-success"><span>Discount</span><span>-$${disc.toFixed(2)}</span></div>` : ''}
            <div class="os-row fw-800 mt-1"><span>Total</span><span class="text-success fs-5">$${tot.toFixed(2)}</span></div>
          </div>
          <div class="os-meta mt-3">
            <div class="os-meta-row"><i class="bi bi-geo-alt text-success me-2"></i><strong>Deliver to:</strong> ${checkoutData.address}</div>
            <div class="os-meta-row"><i class="bi bi-credit-card text-success me-2"></i><strong>Payment:</strong> ${
              checkoutData.paymentMethod === 'cash' ? 'Cash on Delivery' :
              checkoutData.paymentMethod === 'card' ? 'Credit / Debit Card' : 'InstaPay / Wallet'
            }</div>
          </div>
        </div>
        <div id="checkoutError" class="alert alert-danger d-none py-2 small mb-0 mt-2"></div>
        <div class="d-flex gap-2 mt-4">
          <button class="btn-continue-shopping" id="btnStep3Back" style="flex:0 0 auto;width:auto;padding:12px 18px">
            <i class="bi bi-arrow-left me-1"></i> Back
          </button>
          <button class="btn-place-order flex-grow-1" id="btnConfirmOrder">
            <i class="bi bi-bag-check me-2"></i>Confirm & Place Order
          </button>
        </div>
      ` : ''}`;

    // Wire step buttons
    if (checkoutStep === 1) {
      document.getElementById('btnUseSavedAddr')?.addEventListener('click', () => {
        const addrEl = document.getElementById('checkoutAddress');
        if (addrEl && savedAddr) addrEl.value = savedAddr;
      });
      document.getElementById('btnStep1Next')?.addEventListener('click', () => {
        const addr = document.getElementById('checkoutAddress')?.value.trim();
        if (!addr) {
          showCheckoutError('Please enter your delivery address.');
          return;
        }
        checkoutData.address = addr;
        checkoutStep = 2;
        renderCheckoutBody();
      });
    }

    if (checkoutStep === 2) {
      // Show/hide card form on radio change
      document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', () => {
          checkoutData.paymentMethod = radio.value;
          const wrap = document.getElementById('cardFormWrap');
          if (wrap) wrap.classList.toggle('d-none', radio.value !== 'card');
        });
      });

      // Card number formatting
      document.getElementById('cardNumber')?.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19);
      });
      // Expiry formatting
      document.getElementById('cardExpiry')?.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g,'').replace(/^(\d{2})(\d)/, '$1/$2').slice(0,5);
      });

      document.getElementById('btnStep2Back')?.addEventListener('click', () => { checkoutStep = 1; renderCheckoutBody(); });
      document.getElementById('btnStep2Next')?.addEventListener('click', () => {
        const method = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash';
        checkoutData.paymentMethod = method;

        if (method === 'card') {
          const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s/g,'');
          const cardName   = document.getElementById('cardName')?.value.trim();
          const cardExpiry = document.getElementById('cardExpiry')?.value.trim();
          const cardCvv    = document.getElementById('cardCvv')?.value.trim();

          // Feature 5: credit card validation
          if (!/^\d{13,19}$/.test(cardNumber)) { showCheckoutError('Invalid credit card number. Must be 13–19 digits.'); return; }
          if (!cardName)                        { showCheckoutError('Please enter the cardholder name.'); return; }
          if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) { showCheckoutError('Invalid expiry date. Use MM/YY format.'); return; }
          // Check expiry is in the future
          const [expM, expY] = cardExpiry.split('/').map(Number);
          const now = new Date();
          const expDate = new Date(2000 + expY, expM - 1, 1);
          if (expDate <= now) { showCheckoutError('Expiry date must be in the future.'); return; }
          if (!/^\d{3,4}$/.test(cardCvv)) { showCheckoutError('CVV must be 3 or 4 digits.'); return; }

          checkoutData.cardDetails = { cardNumber, cardName, cardExpiry, cardCvv };
        } else {
          checkoutData.cardDetails = null;
        }

        checkoutStep = 3;
        renderCheckoutBody();
      });
    }

    if (checkoutStep === 3) {
      document.getElementById('btnStep3Back')?.addEventListener('click', () => { checkoutStep = 2; renderCheckoutBody(); });
      document.getElementById('btnConfirmOrder')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnConfirmOrder');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Placing order...'; }

        const result = placeOrder({ address: checkoutData.address, paymentMethod: checkoutData.paymentMethod });
        if (!result.success) {
          showCheckoutError(result.error);
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-bag-check me-2"></i>Confirm & Place Order'; }
          return;
        }

        // Feature 5 Step 4: update stock quantities on the API
        await updateStockAfterOrder(getCart.bind(null), result.order);

        // Show success
        checkoutStep = 4;
        document.getElementById('checkoutForm')?.classList.add('d-none');
        document.getElementById('checkoutSuccess')?.classList.remove('d-none');
        const badge = document.getElementById('orderIdBadge');
        if (badge) badge.textContent = result.order.id;

        appliedPromo = null;
        refreshAll();
      });
    }
  }

  function showCheckoutError(msg) {
    const errEl = document.getElementById('checkoutError');
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('d-none'); }
  }

  /* ══ FEATURE 5 STEP 4: Stock update after order ══ */
  async function updateStockAfterOrder(_unused, order) {
    if (!order?.items?.length) return;
    const API_BASE = 'https://69abf0bc9ca639a5217dcac2.mockapi.io/api';

    for (const item of order.items) {
      try {
        // Fetch current product to get latest stockQuantity
        const res = await fetch(`${API_BASE}/Products/${item.id}`);
        if (!res.ok) continue;
        const product = await res.json();
        const currentStock = typeof product.stockQuantity === 'number' ? product.stockQuantity : null;
        if (currentStock === null) continue;

        const newStock = Math.max(0, currentStock - (item.quantity || 1));
        await fetch(`${API_BASE}/Products/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...product, stockQuantity: newStock, stockStatus: newStock > 0 ? 'in_stock' : 'out_of_stock' }),
        });
      } catch (err) {
        console.warn(`Failed to update stock for product ${item.id}:`, err);
      }
    }
  }

  /* ══ INIT ════════════════════════════════════════ */
  refreshAll();
});
