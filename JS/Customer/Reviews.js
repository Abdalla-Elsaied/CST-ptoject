/**
 * Reviews.js
 * ─────────────────────────────────────────────────────────────────
 * Shared module for:
 *   - Site-wide testimonials (stored under KEY_TESTIMONIALS)
 *   - Per-product reviews     (stored under KEY_PRODUCT_REVIEWS)
 */

import { getLS, setLS } from '../Core/FileStorage.js';

export const KEY_TESTIMONIALS    = 'ls_testimonials';
export const KEY_PRODUCT_REVIEWS = 'ls_product_reviews';

/* ── Testimonials (home page) ──────────────────────── */

const SEED_TESTIMONIALS = [
  { id: 't1', userId: null, name: 'Emily R.',  avatar: 'https://i.pravatar.cc/60?img=1',  rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-01T10:00:00Z', featured: true },
  { id: 't2', userId: null, name: 'John D.',   avatar: 'https://i.pravatar.cc/60?img=12', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-05T14:00:00Z', featured: true },
  { id: 't3', userId: null, name: 'Ahmed M.',  avatar: 'https://i.pravatar.cc/60?img=7',  rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-10T09:00:00Z', featured: true },
  { id: 't4', userId: null, name: 'Alex T.',   avatar: 'https://i.pravatar.cc/60?img=33', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-12T11:00:00Z', featured: false },
  { id: 't5', userId: null, name: 'Priya R.',  avatar: 'https://i.pravatar.cc/60?img=45', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-14T08:00:00Z', featured: false },
  { id: 't6', userId: null, name: 'David H.',  avatar: 'https://i.pravatar.cc/60?img=22', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-16T16:00:00Z', featured: false },
];

export function getTestimonials() {
  const stored = getLS(KEY_TESTIMONIALS);
  if (!stored || stored.length === 0) {
    setLS(KEY_TESTIMONIALS, SEED_TESTIMONIALS);
    return SEED_TESTIMONIALS;
  }
  return stored;
}

export function addTestimonial({ userId, name, avatar, rating, comment }) {
  const list = getTestimonials();
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
  setLS(KEY_TESTIMONIALS, [entry, ...list]);
  return entry;
}

export function hasUserTestimonial(userId) {
  if (!userId) return false;
  return getTestimonials().some(t => t.userId === userId);
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
