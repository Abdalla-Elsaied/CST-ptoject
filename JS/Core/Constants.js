// ============================================================
// Constants.js
// All localStorage + MockAPI key names in one place.
// Import from here — never hardcode key strings anywhere else.
// ============================================================

// ─── MockAPI (remote) ─────────────────────────────────────────
// Users only — everything else is localStorage
export const KEY_USERS           = 'ls_users';

// ─── localStorage — Core ──────────────────────────────────────
export const KEY_PRODUCTS        = 'ls_products';
export const KEY_ORDERS          = 'ls_orders';
export const KEY_CURRENT_USER    = 'ls_currentUser';
export const KEY_CART            = 'ls_cart';
export const KEY_SEEDED          = 'ls_seeded';
export const KEY_APPROVAL        = 'LS_Pre_Sellers';
export const KEY_WISHLIST        = 'ls_wishlist';
export const KEY_LOCATION        = 'ls_location';
export const KEY_CATEGORIES      = 'ls_categories';
export const KEY_SELLER_OUTCOMES = 'ls_sellerRequestOutcomes';
export const KEY_METRICS_HISTORY = 'ls_metricsHistory';

// ─── localStorage — Reviews ───────────────────────────────────
// Written by Customer/Reviews.js, read by admin-reviews.js
export const KEY_TESTIMONIALS    = 'ls_testimonials';
export const KEY_PRODUCT_REVIEWS = 'ls_productReviews';