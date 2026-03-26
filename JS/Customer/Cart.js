/**
 * Cart.js – DEALPORT Shopping Cart
 * All cart state is persisted in localStorage under KEY_CART.
 * Each item: { id, name, price, oldPrice, image, category, quantity }
 */

import { getLS, setLS } from '../Core/Storage.js';
import { KEY_ORDERS, KEY_CURRENT_USER } from '../Core/Constants.js';
import { getCurrentUser } from '../Core/Auth.js';

/** Returns the cart key scoped to the current user (or guest). */
export function getCartKey() {
  const user = getCurrentUser();
  return user ? `ls_cart_${user.id}` : 'ls_cart';  // fallback for guest
}

/* ──────────────────────────────────────────────────────
   CORE CART OPERATIONS
────────────────────────────────────────────────────── */

/**
 * Returns the full cart array.
 * @returns {Array<{id, name, price, oldPrice, image, category, quantity}>}
 */
export function getCart() {
  return getLS(getCartKey()) || [];
}

/**
 * Adds a product to the cart or increments its quantity.
 * @param {{ id, name, price, oldPrice?, image?, category? }} product
 * @param {number} quantity  Defaults to 1
 * @returns {{ added: boolean, newQty: number }}
 */
export function addToCart(product, quantity = 1) {
  const cart = getCart();
  const idx  = cart.findIndex(i => String(i.id) === String(product.id));

  if (idx !== -1) {
    cart[idx].quantity = (cart[idx].quantity || 1) + quantity;
    setLS(getCartKey(), cart);
    return { added: false, newQty: cart[idx].quantity };
  }

  const item = {
    id:            product.id,
    name:          product.name          || 'Product',
    price:         parseFloat(product.price)    || 0,
    oldPrice:      product.oldPrice ? parseFloat(product.oldPrice) : null,
    image:         product.image         || '',
    category:      product.category      || '',
    stockQuantity: product.stockQuantity != null ? parseInt(product.stockQuantity) : null,
    sellerId:      product.sellerId      || null,
    quantity:      quantity,
  };
  setLS(getCartKey(), [...cart, item]);
  return { added: true, newQty: quantity };
}

/**
 * Removes an item from the cart by product id.
 * @param {string|number} productId
 */
export function removeFromCart(productId) {
  setLS(getCartKey(), getCart().filter(i => String(i.id) !== String(productId)));
}

/**
 * Sets the quantity of a cart item. Removes item if qty <= 0.
 * @param {string|number} productId
 * @param {number} quantity
 */
export function updateCartQty(productId, quantity) {
  if (quantity <= 0) { removeFromCart(productId); return; }
  const cart = getCart();
  const idx  = cart.findIndex(i => String(i.id) === String(productId));
  if (idx !== -1) {
    cart[idx].quantity = quantity;
    setLS(getCartKey(), cart);
  }
}

/** Empties the entire cart */
export function clearCart() {
  setLS(getCartKey(), []);
}

/* ──────────────────────────────────────────────────────
   COMPUTED VALUES
────────────────────────────────────────────────────── */

/** Total number of items (sum of quantities) */
export function getCartCount() {
  const cart = getLS(getCartKey()) || [];
  return cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

/** Subtotal before shipping/tax */
export function getCartSubtotal() {
  return getCart().reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
}

/** Shipping cost: free over $49, otherwise $5.99 */
export function getShipping() {
  const sub = getCartSubtotal();
  return sub === 0 ? 0 : sub >= 49 ? 0 : 5.99;
}

/** Final total = subtotal + shipping */
export function getCartTotal() {
  return getCartSubtotal() + getShipping();
}

/* ──────────────────────────────────────────────────────
   CHECKOUT → creates an order in KEY_ORDERS
────────────────────────────────────────────────────── */

/**
 * Places an order from the current cart.
 * @param {{ address: string, paymentMethod: string }} details
 * @returns {{ success: boolean, order?: object, error?: string }}
 */
export function placeOrder(details) {
  const cart = getCart();
  if (cart.length === 0) return { success: false, error: 'Cart is empty' };

  // Read user from role-specific session key so the order is assigned to
  // the correct user — not whatever happens to be in the generic ls_currentUser
  const user = getCurrentUser();
  if (!user)  return { success: false, error: 'You must be logged in to checkout' };

  const order = {
    id:            'order-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    userId:        user.id,
    userName:      user.name,
    userEmail:     user.email,
    items:         cart.map(i => ({ ...i })),
    subtotal:      parseFloat(getCartSubtotal().toFixed(2)),
    shipping:      parseFloat(getShipping().toFixed(2)),
    total:         parseFloat(getCartTotal().toFixed(2)),
    address:       details.address || '',
    paymentMethod: details.paymentMethod || 'cash',
    status:        'pending',
    createdAt:     new Date().toISOString(),
  };

  const orders = getLS(KEY_ORDERS) || [];
  setLS(KEY_ORDERS, [...orders, order]);
  clearCart();

  return { success: true, order };
}