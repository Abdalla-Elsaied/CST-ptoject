/**
 * Wishlist.js
 * Persists liked products in localStorage under KEY_WISHLIST.
 */
import { getLS, setLS } from '../Core/Storage.js';
import { KEY_WISHLIST } from '../Core/Constants.js';

export function getWishlist() {
  return getLS(KEY_WISHLIST) || [];
}

export function addToWishlist(product) {
  const list = getWishlist();
  if (!list.find(p => p.id === product.id)) {
    setLS(KEY_WISHLIST, [...list, product]);
  }
}

export function removeFromWishlist(productId) {
  setLS(KEY_WISHLIST, getWishlist().filter(p => p.id !== productId));
}

export function toggleWishlist(product) {
  const list = getWishlist();
  const exists = list.find(p => p.id === product.id);
  if (exists) {
    removeFromWishlist(product.id);
    return false; // removed
  } else {
    addToWishlist(product);
    return true; // added
  }
}

export function isWishlisted(productId) {
  return getWishlist().some(p => p.id === productId);
}

export function getWishlistCount() {
  return getWishlist().length;
}
