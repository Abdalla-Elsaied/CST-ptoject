/**
 * product-details.js
 * Reads ?id= from URL, loads product from MockAPI,
 * renders full details, and handles reviews.
 */

import { loadProductsFromFolder }       from '../Core/FileStorage.js';
import { getCurrentUser }               from '../Core/Auth.js';
import { toggleWishlist, isWishlisted } from './Wishlist.js';
import {
  getProductReviews, addProductReview,
  hasUserReviewedProduct, markHelpful,
  starsHTML, formatDate,
} from './Reviews.js';
import { getLS, setLS } from '../Core/FileStorage.js';

/* ── Helpers ─────────────────────────────────────── */
const $ = id => document.getElementById(id);
const params  = new URLSearchParams(location.search);
const productId = params.get('id');

/* Normalise (same logic as ProductRenderer) */
function resolveImage(p) {
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    return first.url || first.src || first.path || '';
  }
  return p.image || p.img || p.imageUrl || p.thumbnail || p.photo || '';
}
function resolveAllImages(p) {
  if (Array.isArray(p.images) && p.images.length > 0)
    return p.images.map(i => i.url || i.src || i.path || '').filter(Boolean);
  const single = resolveImage(p);
  return single ? [single] : [];
}
function resolveStock(p) {
  if (typeof p.stockStatus === 'string') return p.stockStatus.toLowerCase() === 'in_stock';
  if (typeof p.stockQuantity === 'number') return p.stockQuantity > 0;
  const v = p.stock ?? p.inStock ?? p.available;
  return v !== undefined ? Boolean(v) : true;
}
function resolveDiscount(p) {
  if (p.discountPrice && p.price && parseFloat(p.price) > 0) {
    const pct = Math.round((parseFloat(p.discountPrice) / parseFloat(p.price)) * 100);
    if (pct > 0 && pct < 100) return pct;
  }
  return parseInt(p.discount || 0) || null;
}
function resolvePrice(p) {
  if (p.discountPrice && p.price) {
    const s = parseFloat(p.price) - parseFloat(p.discountPrice);
    return s > 0 ? s : parseFloat(p.price);
  }
  return parseFloat(p.price || 0);
}
function resolveOldPrice(p) {
  if (p.discountPrice && p.price) return parseFloat(p.price);
  return parseFloat(p.oldPrice || 0) || null;
}

/* ── Main init ───────────────────────────────────── */
async function init() {
  if (!productId) { showError(); return; }

  let allProducts;
  try {
    allProducts = await loadProductsFromFolder();
  } catch {
    showError(); return;
  }

  const raw = allProducts.find(p => String(p.id) === String(productId));
  if (!raw) { showError(); return; }

  // Build normalised product
  const p = {
    id:          raw.id,
    name:        raw.name || raw.title || 'Product',
    category:    raw.category || raw.Category || 'Other',
    price:       resolvePrice(raw),
    oldPrice:    resolveOldPrice(raw),
    discount:    resolveDiscount(raw),
    images:      resolveAllImages(raw),
    image:       resolveImage(raw),
    rating:      parseFloat(raw.rating || 0),
    reviews:     parseInt(raw.reviews || raw.reviewCount || 0),
    description: raw.description || raw.desc || '',
    stock:       resolveStock(raw),
    tag:         raw.tag || null,
    colors:      raw.colors || null,
    stockQuantity: raw.stockQuantity,
    expirationEnd: raw.expirationEnd || null,
    taxIncluded:   raw.taxIncluded,
    createdAt:     raw.createdAt,
  };

  renderProduct(p);
  renderReviewSection(p.id);
  renderRelated(allProducts, p);

  $('pdLoading')?.classList.add('d-none');
  $('pdContent')?.classList.remove('d-none');
  document.title = `${p.name} – DEALPORT`;

  // Nav user label
  const user = getCurrentUser();
  if (user && $('pdNavUser')) $('pdNavUser').textContent = user.name.split(' ')[0];
}

function showError() {
  $('pdLoading')?.classList.add('d-none');
  $('pdError')?.classList.remove('d-none');
}

/* ── Render product ──────────────────────────────── */
function renderProduct(p) {
  // Breadcrumb
  if ($('bcCategory')) $('bcCategory').textContent = p.category;
  if ($('bcProduct'))  $('bcProduct').textContent  = p.name;

  // Category tag
  if ($('pdCategory')) $('pdCategory').textContent = p.category;

  // Title
  if ($('pdTitle')) $('pdTitle').textContent = p.name;

  // Rating row
  if ($('pdStars')) $('pdStars').innerHTML = starsHTML(p.rating);
  const reviewCount = getProductReviews(p.id).length + p.reviews;
  if ($('pdReviewCount')) $('pdReviewCount').textContent =
    `${p.rating.toFixed(1)} · ${reviewCount} review${reviewCount !== 1 ? 's' : ''}`;
  const stockBadge = $('pdStockBadge');
  if (stockBadge) {
    stockBadge.textContent = p.stock ? 'In Stock' : 'Out of Stock';
    stockBadge.className   = `pd-stock-badge ${p.stock ? 'in' : 'out'}`;
  }

  // Price
  if ($('pdPriceNow')) $('pdPriceNow').textContent = `$${p.price.toFixed(2)}`;
  if (p.oldPrice) {
    $('pdPriceOld')?.classList.remove('d-none');
    if ($('pdPriceOld')) $('pdPriceOld').textContent = `$${p.oldPrice.toFixed(2)}`;
    $('pdSaveBadge')?.classList.remove('d-none');
    const saved = (p.oldPrice - p.price).toFixed(2);
    if ($('pdSaveBadge')) $('pdSaveBadge').textContent = `Save $${saved}`;
  }

  // Discount badge on image
  if (p.discount) {
    $('pdDiscountBadge')?.classList.remove('d-none');
    if ($('pdDiscountBadge')) $('pdDiscountBadge').textContent = `${p.discount}% OFF`;
  }

  // Description
  if ($('pdDescription')) $('pdDescription').textContent = p.description || 'No description available.';
  if ($('pdLongDesc'))    $('pdLongDesc').innerHTML     = p.description
    ? `<p>${p.description.replace(/\n/g, '</p><p>')}</p>`
    : '<p class="text-muted">No detailed description available.</p>';

  // Main image
  const mainImg = $('pdMainImage');
  const placeholder = `https://placehold.co/600x500/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
  if (mainImg) mainImg.src = p.image || placeholder;

  // Thumbnails
  const thumbWrap = $('pdThumbnails');
  if (thumbWrap && p.images.length > 1) {
    thumbWrap.innerHTML = p.images.map((url, i) => `
      <img src="${url}" alt="thumb ${i+1}" class="pd-thumb ${i===0?'active':''}"
           data-src="${url}"
           onerror="this.style.display='none'"/>`).join('');
    thumbWrap.querySelectorAll('.pd-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        if (mainImg) mainImg.src = thumb.dataset.src;
        thumbWrap.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }

  // Colors
  if (p.colors && typeof p.colors === 'object') {
    const colorValues = Object.values(p.colors).map(c => c.hex || c.value || c).filter(Boolean);
    const colorNames  = Object.keys(p.colors);
    if (colorValues.length > 0) {
      $('pdColorsWrap')?.classList.remove('d-none');
      const colorsEl = $('pdColors');
      if (colorsEl) {
        let selectedColor = colorNames[0] || colorValues[0];
        if ($('pdSelectedColor')) $('pdSelectedColor').textContent = selectedColor;
        colorsEl.innerHTML = colorValues.map((hex, i) => `
          <div class="pd-color-swatch ${i===0?'active':''}"
               style="background:${hex}"
               data-name="${colorNames[i] || hex}"
               title="${colorNames[i] || hex}"></div>`).join('');
        colorsEl.querySelectorAll('.pd-color-swatch').forEach(sw => {
          sw.addEventListener('click', () => {
            colorsEl.querySelectorAll('.pd-color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            if ($('pdSelectedColor')) $('pdSelectedColor').textContent = sw.dataset.name;
          });
        });
      }
    }
  }

  // Tags
  if (p.tag) {
    $('pdTagsWrap')?.classList.remove('d-none');
    if ($('pdTags')) $('pdTags').innerHTML =
      `<span class="pd-tag-chip">${p.tag}</span>`;
  }

  // Meta grid
  const metaGrid = $('pdMetaGrid');
  if (metaGrid) {
    const rows = [
      { icon: 'bi-box-seam',      label: 'Stock',      value: p.stockQuantity != null ? p.stockQuantity : (p.stock ? 'Available' : 'Sold Out') },
      { icon: 'bi-tag',           label: 'Category',   value: p.category },
      { icon: 'bi-receipt',       label: 'Tax',        value: p.taxIncluded ? 'Included' : 'Not included' },
      { icon: 'bi-clock-history', label: 'Added',      value: p.createdAt ? formatDate(p.createdAt) : '–' },
      { icon: 'bi-truck',         label: 'Delivery',   value: 'Free over $49' },
      { icon: 'bi-arrow-repeat',  label: 'Returns',    value: '30-day returns' },
    ];
    if (p.expirationEnd) rows.push({ icon: 'bi-hourglass-split', label: 'Deal ends', value: formatDate(p.expirationEnd) });
    metaGrid.innerHTML = rows.map(r => `
      <div class="pd-meta-item">
        <i class="bi ${r.icon}"></i>
        <div>
          <span class="pd-meta-label">${r.label}</span>
          <span class="pd-meta-value">${r.value}</span>
        </div>
      </div>`).join('');
  }

  // Specs tab (build from known fields)
  const specsGrid = $('pdSpecsGrid');
  if (specsGrid) {
    const specs = [
      ['Category',    p.category],
      ['Price',       `$${p.price.toFixed(2)}`],
      ['Tax',         p.taxIncluded ? 'Included' : 'Excluded'],
      ['Stock',       p.stockQuantity != null ? `${p.stockQuantity} units` : (p.stock ? 'In Stock' : 'Out of Stock')],
      ['Discount',    p.discount ? `${p.discount}%` : 'None'],
    ].filter(([,v]) => v !== null && v !== undefined && v !== '');
    if (specs.length) {
      specsGrid.innerHTML = specs.map(([k, v]) => `
        <div class="pd-spec-row">
          <span class="pd-spec-key">${k}</span>
          <span class="pd-spec-val">${v}</span>
        </div>`).join('');
    }
  }

  // Wishlist button
  const wishBtn  = $('pdWishlistBtn');
  const wishIcon = $('pdWishlistIcon');
  const pdBtnWish = $('pdAddWish');
  function syncWishUI() {
    const wished = isWishlisted(p.id);
    if (wishIcon) wishIcon.className = wished ? 'bi bi-heart-fill' : 'bi bi-heart';
    wishBtn?.classList.toggle('wished', wished);
    if (pdBtnWish) {
      pdBtnWish.className = `btn pd-btn-wish${wished ? ' wished' : ''}`;
      pdBtnWish.innerHTML = wished
        ? '<i class="bi bi-heart-fill me-1"></i> Wishlisted'
        : '<i class="bi bi-heart me-1"></i> Wishlist';
    }
  }
  syncWishUI();
  wishBtn?.addEventListener('click', () => {
    toggleWishlist({ id: p.id, name: p.name, price: p.price, category: p.category, image: p.image });
    syncWishUI();
  });
  pdBtnWish?.addEventListener('click', () => {
    toggleWishlist({ id: p.id, name: p.name, price: p.price, category: p.category, image: p.image });
    syncWishUI();
  });

  // Quantity
  const qtyInput = $('pdQty');
  $('pdQtyMinus')?.addEventListener('click', () => {
    const v = parseInt(qtyInput?.value || 1);
    if (v > 1 && qtyInput) qtyInput.value = v - 1;
  });
  $('pdQtyPlus')?.addEventListener('click', () => {
    const v = parseInt(qtyInput?.value || 1);
    if (v < 99 && qtyInput) qtyInput.value = v + 1;
  });

  // Add to Cart
  const addCartBtn = $('pdAddCart');
  if (!p.stock && addCartBtn) {
    addCartBtn.textContent = 'Out of Stock';
    addCartBtn.disabled = true;
    addCartBtn.style.background = '#9ca3af';
  }
  addCartBtn?.addEventListener('click', () => {
    if (!p.stock) return;
    const original = addCartBtn.innerHTML;
    addCartBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Added!';
    addCartBtn.disabled = true;
    addCartBtn.style.background = '#16a34a';
    setTimeout(() => {
      addCartBtn.innerHTML = original;
      addCartBtn.disabled  = false;
      addCartBtn.style.background = '';
    }, 2000);
  });

  // Tab switching
  document.querySelectorAll('.pd-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pd-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.pd-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

/* ── Reviews section ─────────────────────────────── */
function renderReviewSection(productId) {
  renderReviewsSummary(productId);
  renderReviewForm(productId);
  renderReviewsList(productId);
}

function renderReviewsSummary(productId) {
  const reviews = getProductReviews(productId);
  const el = $('reviewsSummary');
  if (!el) return;

  const count = reviews.length;
  const avg   = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  // Count per star
  const dist = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  }));

  el.innerHTML = `
    <div class="text-center" style="min-width:80px">
      <div class="rs-big-score">${count ? avg.toFixed(1) : '–'}</div>
      <div class="rs-stars">${starsHTML(avg)}</div>
      <div class="rs-count">${count} review${count !== 1 ? 's' : ''}</div>
    </div>
    <div class="rs-bars flex-grow-1">
      ${dist.map(d => `
        <div class="rs-bar-row">
          <span class="rs-bar-label">${d.star} ★</span>
          <div class="rs-bar-track">
            <div class="rs-bar-fill" style="width:${count ? Math.round(d.count/count*100) : 0}%"></div>
          </div>
          <span class="rs-bar-count">${d.count}</span>
        </div>`).join('')}
    </div>`;

  // Update tab badge
  const badge = $('reviewTabBadge');
  if (badge) badge.textContent = count;
}

function renderReviewForm(productId) {
  const wrap = $('reviewFormWrap');
  if (!wrap) return;
  const user = getCurrentUser();

  if (!user) {
    wrap.innerHTML = `
      <div class="review-login-prompt">
        <i class="bi bi-lock-fill text-muted fs-2 mb-2 d-block"></i>
        <p class="fw-700 mb-1">Sign in to leave a review</p>
        <p class="text-muted small mb-3">Only verified customers can review products.</p>
        <a href="login.html" class="btn btn-add-cart px-4">Sign In</a>
      </div>`;
    return;
  }

  if (hasUserReviewedProduct(productId, user.id)) {
    wrap.innerHTML = `
      <div class="review-already">
        <i class="bi bi-patch-check-fill text-success fs-2 mb-2 d-block"></i>
        <p class="fw-700 mb-1">You've already reviewed this product</p>
        <p class="text-muted small">Thank you for your feedback!</p>
      </div>`;
    return;
  }

  let selectedRating = 0;
  wrap.innerHTML = `
    <div class="review-form-card">
      <h5 class="fw-800 mb-1"><i class="bi bi-pencil-square text-success me-2"></i>Write a Review</h5>
      <p class="text-muted small mb-4">Share your thoughts about this product</p>

      <div class="mb-3">
        <label class="pd-field-label">Your Rating *</label>
        <div class="star-picker" id="revStarPicker">
          <i class="bi bi-star star-pick" data-val="1"></i>
          <i class="bi bi-star star-pick" data-val="2"></i>
          <i class="bi bi-star star-pick" data-val="3"></i>
          <i class="bi bi-star star-pick" data-val="4"></i>
          <i class="bi bi-star star-pick" data-val="5"></i>
        </div>
        <input type="hidden" id="revRatingInput" value="0"/>
      </div>
      <div class="mb-3">
        <label class="pd-field-label">Review Title</label>
        <input type="text" class="form-control profile-input" id="revTitle" placeholder="Summarise your experience"/>
      </div>
      <div class="mb-3">
        <label class="pd-field-label">Your Review *</label>
        <textarea class="form-control profile-input" id="revComment" rows="4"
                  placeholder="What did you like or dislike? How does it perform?"></textarea>
      </div>
      <div id="revError" class="alert alert-danger d-none py-2 small mb-3"></div>
      <button class="btn btn-save" id="submitRevBtn">
        <i class="bi bi-send me-1"></i> Submit Review
      </button>
    </div>`;

  // Star picker
  const picker = document.getElementById('revStarPicker');
  picker?.querySelectorAll('.star-pick').forEach(star => {
    star.addEventListener('mouseenter', () => {
      const v = +star.dataset.val;
      picker.querySelectorAll('.star-pick').forEach((s,i) => {
        s.className = i < v ? 'bi bi-star-fill star-pick hovered' : 'bi bi-star star-pick';
      });
    });
    star.addEventListener('mouseleave', () => {
      picker.querySelectorAll('.star-pick').forEach((s,i) => {
        s.className = i < selectedRating ? 'bi bi-star-fill star-pick selected' : 'bi bi-star star-pick';
      });
    });
    star.addEventListener('click', () => {
      selectedRating = +star.dataset.val;
      const inp = document.getElementById('revRatingInput');
      if (inp) inp.value = selectedRating;
      picker.querySelectorAll('.star-pick').forEach((s,i) => {
        s.className = i < selectedRating ? 'bi bi-star-fill star-pick selected' : 'bi bi-star star-pick';
      });
    });
  });

  // Submit
  document.getElementById('submitRevBtn')?.addEventListener('click', () => {
    const revErr    = document.getElementById('revError');
    const rating    = parseInt(document.getElementById('revRatingInput')?.value || 0);
    const title     = document.getElementById('revTitle')?.value.trim();
    const comment   = document.getElementById('revComment')?.value.trim();
    const showErr   = msg => { if (revErr) { revErr.textContent = msg; revErr.classList.remove('d-none'); } };

    if (rating < 1)  return showErr('Please select a star rating.');
    if (!comment || comment.length < 10) return showErr('Review must be at least 10 characters.');

    addProductReview(productId, {
      userId:  user.id,
      name:    user.name,
      avatar:  null,
      rating,
      title,
      comment,
    });

    renderReviewsSummary(productId);
    renderReviewsList(productId);
    wrap.innerHTML = `
      <div class="review-already">
        <i class="bi bi-patch-check-fill text-success fs-2 mb-2 d-block"></i>
        <p class="fw-700 mb-1">Review submitted!</p>
        <p class="text-muted small">Thank you for sharing your experience.</p>
      </div>`;
  });
}

function renderReviewsList(productId) {
  const list = getProductReviews(productId);
  const el   = $('reviewsList');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-chat-square-text fs-1 d-block mb-3"></i>
        <p>No reviews yet. Be the first to review this product!</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(r => {
    const initials = r.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const avatarHTML = r.avatar
      ? `<img src="${r.avatar}" alt="${r.name}" class="review-avatar"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
         <div class="review-avatar-fallback" style="display:none">${initials}</div>`
      : `<div class="review-avatar-fallback">${initials}</div>`;
    return `
      <div class="review-card" data-rev-id="${r.id}">
        <div class="d-flex align-items-center gap-3 mb-2">
          ${avatarHTML}
          <div class="flex-grow-1">
            ${r.title ? `<div class="review-title">${r.title}</div>` : ''}
            <div class="review-stars">${starsHTML(r.rating)}</div>
          </div>
          <span class="review-meta">${formatDate(r.createdAt)}</span>
        </div>
        <p class="review-comment">${r.comment}</p>
        <div class="d-flex align-items-center gap-3">
          <span class="review-meta">By <strong>${r.name}</strong></span>
          <button class="btn-helpful ms-auto" data-id="${r.id}">
            <i class="bi bi-hand-thumbs-up me-1"></i> Helpful (${r.helpful || 0})
          </button>
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.btn-helpful').forEach(btn => {
    btn.addEventListener('click', () => {
      markHelpful(productId, btn.dataset.id);
      const rev = getProductReviews(productId).find(r => r.id === btn.dataset.id);
      if (rev) btn.innerHTML = `<i class="bi bi-hand-thumbs-up-fill me-1"></i> Helpful (${rev.helpful})`;
      btn.disabled = true;
    });
  });
}

/* ── Related products ────────────────────────────── */
function renderRelated(allProducts, current) {
  const related = allProducts
    .filter(p => String(p.id) !== String(current.id) &&
                 (p.category || '').toLowerCase() === current.category.toLowerCase())
    .slice(0, 8);

  const wrap = $('relatedProductsWrap');
  if (!wrap || related.length === 0) return;

  wrap.innerHTML = related.map(p => {
    const img  = resolveImage(p);
    const name = p.name || p.title || 'Product';
    const price = resolvePrice(p);
    return `
      <div class="swiper-slide" style="width:220px">
        <div class="product-card" data-id="${p.id}">
          <div class="product-img-wrap">
            <img src="${img || `https://placehold.co/300x250/ecfdf5/16a34a?text=${encodeURIComponent(name)}`}"
                 alt="${name}" class="product-img"
                 onerror="this.src='https://placehold.co/300x250/ecfdf5/16a34a?text=No+Image'"/>
          </div>
          <div class="product-body">
            <p class="product-category">${p.category || ''}</p>
            <h5 class="product-name">${name}</h5>
            <div class="product-price"><span class="price-now">$${price.toFixed(2)}</span></div>
            <a href="product-details.html?id=${p.id}" class="btn btn-add-cart mt-1">View Details</a>
          </div>
        </div>
      </div>`;
  }).join('');

  new Swiper('.related-swiper', {
    slidesPerView: 'auto',
    spaceBetween: 16,
    navigation: { prevEl: '.related-prev', nextEl: '.related-next' },
  });
}

/* ── Boot ────────────────────────────────────────── */
init();
