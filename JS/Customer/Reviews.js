/**
 * Reviews.js
 * ─────────────────────────────────────────────────────────────────
 * Shared module for:
 *   - Site-wide testimonials (stored under KEY_TESTIMONIALS)
 *   - Per-product reviews     (stored under KEY_PRODUCT_REVIEWS)
 */

import { getLS, setLS } from '../Core/Storage.js';
// import { seedTestimonials } from '../Core/SeedData.js'; 

export const KEY_TESTIMONIALS    = 'ls_testimonials';
export const KEY_PRODUCT_REVIEWS = 'ls_productReviews';

/* ── Testimonials (home page) ──────────────────────── */

export function getTestimonials(allElements = false) {
  const stored = getLS(KEY_TESTIMONIALS);
  if (!stored || stored.length === 0) {
    // seedTestimonials used to be here, but now we rely on user-added data
    setLS(KEY_TESTIMONIALS, []);
    return [];
  }

  const list = [...stored].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return allElements ? list : list.slice(0, 6);
}

export function deleteTestimonial(id) {
  const all = getLS(KEY_TESTIMONIALS) || [];
  const updated = all.filter(t => String(t.id) !== String(id));
  setLS(KEY_TESTIMONIALS, updated);
}

export function addTestimonial({ userId, name, avatar, rating, comment }) {
  const all = getLS(KEY_TESTIMONIALS) || [];
  const entry = {
    id:        'testi-' + Date.now(),
    userId,
    name,
    avatar:    avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=22c55e&color=fff&size=60`,
    rating:    Math.min(5, Math.max(1, rating)),
    comment,
    createdAt: new Date().toISOString(),
    featured:  false,
  };
  setLS(KEY_TESTIMONIALS, [entry, ...all]);
  return entry;
}

export function hasUserTestimonial(userId) {
  if (!userId) return false;
  return (getLS(KEY_TESTIMONIALS) || []).some(t => t.userId === userId);
}

/* ── Product Reviews ───────────────────────────────── */

export function getProductReviews(productId) {
  const all = getLS(KEY_PRODUCT_REVIEWS) || {};
  return all[productId] || [];
}

export function addProductReview(productId, { userId, name, avatar, rating, title, comment }) {
  const all = getLS(KEY_PRODUCT_REVIEWS) || {};
  const list = all[productId] || [];
  const entry = {
    id:        'rev-' + Date.now(),
    userId,
    name,
    avatar:    avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=22c55e&color=fff&size=60`,
    rating:    Math.min(5, Math.max(1, rating)),
    title:     title || '',
    comment,
    createdAt: new Date().toISOString(),
    helpful:   0,
  };
  all[productId] = [entry, ...list];
  setLS(KEY_PRODUCT_REVIEWS, all);
  return entry;
}

export function hasUserReviewedProduct(productId, userId) {
  if (!userId) return false;
  return getProductReviews(productId).some(r => r.userId === userId);
}

export function markHelpful(productId, reviewId) {
  const all  = getLS(KEY_PRODUCT_REVIEWS) || {};
  const list = all[productId] || [];
  const rev  = list.find(r => r.id === reviewId);
  if (rev) rev.helpful = (rev.helpful || 0) + 1;
  all[productId] = list;
  setLS(KEY_PRODUCT_REVIEWS, all);
}

export function deleteProductReview(productId, reviewId) {
  const all = getLS(KEY_PRODUCT_REVIEWS) || {};
  const list = all[productId] || [];
  all[productId] = list.filter(r => String(r.id) !== String(reviewId));
  setLS(KEY_PRODUCT_REVIEWS, all);
}

/* ── Shared star HTML ──────────────────────────────── */
export function starsHTML(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.4 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    '<i class="bi bi-star-fill"></i>'.repeat(full)  +
    '<i class="bi bi-star-half"></i>'.repeat(half)  +
    '<i class="bi bi-star"></i>'.repeat(empty)
  );
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}