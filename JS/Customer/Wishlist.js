/**
 * Wishlist.js
 * Persists liked products in localStorage under a per-user key.
 * Key format: ls_wishlist_<userId>  (guests: ls_wishlist_guest)
 */
import { getLS, setLS } from '../Core/Storage.js';
import { getCurrentUser } from '../Core/Auth.js';

function getCurrentUserFromSession() {
  try {
    // Use getSessionKey() so ?role=admin param is respected (admin storefront preview)
    const user = getCurrentUser()
    return user || null;
  } catch {
    return null;
  }
}

function getWishlistKey() {
  const user = getCurrentUserFromSession();
  return user?.id ? `ls_wishlist_${user.id}` : 'ls_wishlist_guest';
}

export function getWishlist() {
  return getLS(getWishlistKey()) || [];
}

export function addToWishlist(product) {
  const key  = getWishlistKey();
  const list = getLS(key) || [];
  if (!list.find(p => String(p.id) === String(product.id))) {
    setLS(key, [...list, product]);
  }
}

export function removeFromWishlist(productId) {
  const key = getWishlistKey();
  setLS(key, (getLS(key) || []).filter(p => String(p.id) !== String(productId)));
}

export function toggleWishlist(product) {
  const list   = getWishlist();
  const exists = list.find(p => String(p.id) === String(product.id));
  if (exists) {
    removeFromWishlist(product.id);
    return false; // removed
  } else {
    addToWishlist(product);
    return true;  // added
  }
}

export function isWishlisted(productId) {
  return getWishlist().some(p => String(p.id) === String(productId));
}

export function getWishlistCount() {
  return getWishlist().length;
}