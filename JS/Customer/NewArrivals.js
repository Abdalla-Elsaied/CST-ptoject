/**
 * NewArrivals.js
 * ─────────────────────────────────────────────────────────────────
 * Displays all products sorted newest-first.
 * "Newest" = highest product id (numeric) or latest createdAt timestamp.
 * Reuses the same field-normaliser logic as ProductRenderer.js so any
 * product shape from the API is handled transparently.
 *
 * Features:
 *  - Skeleton loader while fetching
 *  - Category pill filters
 *  - Sort dropdown (newest / oldest / price / rating)
 *  - Live search within the page
 *  - Wishlist heart toggle
 *  - Add to cart with stock guard
 *  - Navbar auth state + wishlist drawer (mirrors CustomerHomePage)
 */

import { loadProductsFromFolder }                         from '../Core/FileStorage.js';
import { getCurrentUser, logoutUser, getCartCount, ROLES } from '../Core/Auth.js';
import {
  getWishlist, removeFromWishlist,
  toggleWishlist, isWishlisted, getWishlistCount,
} from './Wishlist.js';
import { addToCart, getCart } from './Cart.js';

/* ── Field helpers (mirrors ProductRenderer.js) ─────────────── */
function resolveImage(p) {
  if (Array.isArray(p.images) && p.images.length > 0) {
    const f = p.images[0];
    return f.url || f.src || f.path || f.link || '';
  }
  return p.image || p.img || p.imageUrl || p.thumbnail || p.photo || p.avatar || '';
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
  return parseInt(p.discount || p.discountPercent || p.sale || 0) || null;
}
function resolveCurrentPrice(p) {
  if (p.discountPrice && p.price) {
    const sale = parseFloat(p.price) - parseFloat(p.discountPrice);
    return sale > 0 ? sale : parseFloat(p.price);
  }
  return parseFloat(p.price || p.Price || p.cost || 0);
}
function resolveOldPrice(p) {
  if (p.discountPrice && p.price) return parseFloat(p.price);
  return parseFloat(p.oldPrice || p.old_price || p.originalPrice || 0) || null;
}

/** Convert a raw product object into a clean normalised shape */
function normalise(p) {
  return {
    id:            p.id           || p.ID           || Math.random(),
    sellerId:      p.sellerId     || p.seller_id    || p.userId || null,
    name:          p.name         || p.title        || p.productName || 'Untitled Product',
    category:      p.category     || p.Category     || p.type   || 'Other',
    price:         resolveCurrentPrice(p),
    oldPrice:      resolveOldPrice(p),
    image:         resolveImage(p),
    rating:        parseFloat(p.rating || p.rate || p.stars || 0),
    reviews:       parseInt(p.reviews  || p.reviewCount || p.numReviews || 0),
    discount:      resolveDiscount(p),
    stock:         resolveStock(p),
    stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : null,
    tag:           p.tag || p.badge || null,
    // Keep raw timestamp / id for "newest" sort
    createdAt:     p.createdAt || p.created_at || p.addedAt || null,
    rawId:         p.id || p.ID || 0,
  };
}

/** Returns a numeric sort key for "newest first" ordering */
function newestKey(p) {
  if (p.createdAt) {
    const ts = new Date(p.createdAt).getTime();
    if (!isNaN(ts)) return ts;
  }
  // Fall back to numeric id (higher id = newer)
  const n = parseFloat(p.rawId);
  return isNaN(n) ? 0 : n;
}

function starsHTML(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.4 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    '<i class="bi bi-star-fill"></i>'.repeat(full) +
    '<i class="bi bi-star-half"></i>'.repeat(half) +
    '<i class="bi bi-star"></i>'.repeat(empty)
  );
}

/* ── Skeleton loader ─────────────────────────────────────────── */
function showSkeleton(grid, count = 8) {
  grid.innerHTML = Array(count).fill(`
    <div class="col-6 col-md-4 col-lg-3">
      <div class="product-card skeleton-card">
        <div class="skeleton-img"></div>
        <div class="product-body">
          <div class="skeleton-line w-60px mb-2"></div>
          <div class="skeleton-line w-full mb-1"></div>
          <div class="skeleton-line w-80px mb-3"></div>
          <div class="skeleton-line w-100px"></div>
        </div>
      </div>
    </div>`).join('');
}

/* ── Single card HTML ────────────────────────────────────────── */
function cardHTML(p, rank) {
  const imgSrc = p.image
    || `https://placehold.co/400x300/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
  const discountBadge = p.discount
    ? `<span class="badge-discount">${p.discount}% OFF</span>` : '';
  const tagBadge = !p.discount && p.tag
    ? `<span class="badge-tag badge-tag--${p.tag.toLowerCase().replace(/\s+/g,'–')}">${p.tag}</span>` : '';
  // "NEW" ribbon on the first 20 products (truly newest)
  const newRibbon = rank < 20
    ? `<span class="na-new-ribbon"><i class="bi bi-stars"></i> New</span>` : '';
  const outOfStock = !p.stock;
  const oldPriceHTML = p.oldPrice && p.oldPrice !== p.price
    ? `<span class="price-old">$${p.oldPrice.toFixed(2)}</span>` : '';
  const wished = isWishlisted(String(p.id));

  return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="product-card"
           data-id="${p.id}"
           data-seller-id="${p.sellerId || ''}"
           data-stock-quantity="${p.stockQuantity !== null ? p.stockQuantity : ''}">
        <div class="product-img-wrap">
          <img src="${imgSrc}" alt="${p.name}" class="product-img" loading="lazy"
               onerror="this.onerror=null;this.src='https://placehold.co/400x300/ecfdf5/16a34a?text=No+Image'"/>
          ${discountBadge}${tagBadge}${newRibbon}
          ${outOfStock ? '<span class="badge-out-of-stock">Out of Stock</span>' : ''}
          <button class="btn-wishlist" data-id="${p.id}" title="Add to wishlist">
            <i class="bi ${wished ? 'bi-heart-fill' : 'bi-heart'}"></i>
          </button>
        </div>
        <div class="product-body">
          <p class="product-category">${p.category}</p>
          <h5 class="product-name" title="${p.name}">${p.name}</h5>
          <div class="product-stars">${starsHTML(p.rating)}
            ${p.reviews ? `<span>(${p.reviews})</span>` : ''}
          </div>
          <div class="product-price">
            <span class="price-now">$${p.price.toFixed(2)}</span>${oldPriceHTML}
          </div>
          <div class="product-actions">
            <button class="btn btn-add-cart${outOfStock ? ' btn-out-of-stock' : ''}"
                    data-id="${p.id}"
                    data-name="${p.name.replace(/"/g,'&quot;')}"
                    data-price="${p.price}"
                    data-old-price="${p.oldPrice || ''}"
                    data-category="${p.category}"
                    data-image="${imgSrc}"
                    data-stock-quantity="${p.stockQuantity !== null ? p.stockQuantity : ''}"
                    ${outOfStock ? 'disabled' : ''}>
              <i class="bi bi-cart-plus me-1"></i>
              ${outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <a href="product-details.html?id=${p.id}" class="btn-view">View Details</a>
          </div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {

  /* ── DOM refs ─────────────────────────────────────────────── */
  const grid         = document.getElementById('naGrid');
  const emptyState   = document.getElementById('naEmpty');
  const countEl      = document.getElementById('naCount');
  const sortSel      = document.getElementById('naSort');
  const pillsWrap    = document.getElementById('naCategoryPills');
  const searchInput  = document.getElementById('naSearch');
  const searchBtn    = document.getElementById('naSearchBtn');
  const heroStats    = document.getElementById('naHeroStats');
  const cartBadgeEl  = document.getElementById('cartBadge');

  /* ── State ────────────────────────────────────────────────── */
  let allProducts  = [];   // all normalised, sorted newest-first
  let activeFilter = 'All';
  let activeQuery  = '';
  let activeSort   = 'newest';

  /* ── Skeleton while loading ───────────────────────────────── */
  showSkeleton(grid);

  /* ── Load products ────────────────────────────────────────── */
  try {
    const raw = await loadProductsFromFolder();
    if (!raw || raw.length === 0) throw new Error('No products returned.');

    // Normalise then sort newest-first as the default order
    allProducts = raw.map(normalise).sort((a, b) => newestKey(b) - newestKey(a));

    buildCategoryPills();
    buildHeroStats();
    renderGrid();

  } catch (err) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="api-error-state">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <h4>Could not load products</h4>
          <p>${err.message}</p>
          <button class="btn btn-add-cart px-4" onclick="window.location.reload()">
            <i class="bi bi-arrow-clockwise me-2"></i>Try Again
          </button>
        </div>
      </div>`;
  }

  /* ── Hero stats ───────────────────────────────────────────── */
  function buildHeroStats() {
    const cats = new Set(allProducts.map(p => p.category)).size;
    heroStats.innerHTML = `
      <div class="na-stat"><span class="na-stat-num">${allProducts.length}</span><span class="na-stat-label">Products</span></div>
      <div class="na-stat"><span class="na-stat-num">${cats}</span><span class="na-stat-label">Categories</span></div>
      <div class="na-stat"><span class="na-stat-num">${allProducts.filter(p=>p.discount).length}</span><span class="na-stat-label">On Sale</span></div>`;
  }

  /* ── Category pills ───────────────────────────────────────── */
  function buildCategoryPills() {
    const cats = ['All', ...new Set(allProducts.map(p => p.category)).values()];
    pillsWrap.innerHTML = cats.map(c =>
      `<button class="na-pill${c === 'All' ? ' active' : ''}" data-cat="${c}">${c}</button>`
    ).join('');
    pillsWrap.querySelectorAll('.na-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.cat;
        pillsWrap.querySelectorAll('.na-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGrid();
      });
    });
  }

  /* ── Sort & filter pipeline ───────────────────────────────── */
  function getFiltered() {
    let list = [...allProducts];

    // Category
    if (activeFilter !== 'All') list = list.filter(p => p.category === activeFilter);

    // Search
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (activeSort) {
      case 'newest':    list.sort((a, b) => newestKey(b) - newestKey(a)); break;
      case 'oldest':    list.sort((a, b) => newestKey(a) - newestKey(b)); break;
      case 'price-asc': list.sort((a, b) => a.price - b.price);           break;
      case 'price-desc':list.sort((a, b) => b.price - a.price);           break;
      case 'rating':    list.sort((a, b) => b.rating - a.rating);         break;
    }
    return list;
  }

  /* ── Render grid ──────────────────────────────────────────── */
  function renderGrid() {
    const list = getFiltered();
    countEl.textContent = `${list.length} product${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('d-none');
      return;
    }
    emptyState.classList.add('d-none');
    grid.innerHTML = list.map((p, i) => cardHTML(p, i)).join('');

    // Scroll-reveal animation
    grid.querySelectorAll('.product-card').forEach((el, i) => {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(20px)';
      el.style.transition = `opacity 0.4s ease ${Math.min(i, 12) * 40}ms, transform 0.4s ease ${Math.min(i,12)*40}ms, box-shadow 0.3s`;
      requestAnimationFrame(() => {
        el.style.opacity   = '1';
        el.style.transform = 'translateY(0)';
      });
    });

    syncHeartIcons();
  }

  /* ── Sort change ──────────────────────────────────────────── */
  sortSel?.addEventListener('change', () => { activeSort = sortSel.value; renderGrid(); });

  /* ── Search ───────────────────────────────────────────────── */
  function doSearch() {
    activeQuery = searchInput.value.trim();
    renderGrid();
  }
  searchBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
  searchInput?.addEventListener('input', () => {
    if (!searchInput.value.trim()) { activeQuery = ''; renderGrid(); }
  });

  /* ── Clear filters (global fn for the empty-state button) ── */
  window.clearFilters = () => {
    activeFilter = 'All';
    activeQuery  = '';
    activeSort   = 'newest';
    searchInput.value = '';
    sortSel.value = 'newest';
    pillsWrap.querySelectorAll('.na-pill').forEach(b =>
      b.classList.toggle('active', b.dataset.cat === 'All'));
    renderGrid();
  };

  /* ── Cart badge ───────────────────────────────────────────── */
  function refreshCartBadge() {
    if (cartBadgeEl) cartBadgeEl.textContent = getCartCount();
  }
  refreshCartBadge();

  /* ── Delegated click – cart + wishlist ────────────────────── */
  document.body.addEventListener('click', e => {
    // Add to cart
    const cartBtn = e.target.closest('.btn-add-cart');
    if (cartBtn && !cartBtn.disabled) {
      const card        = cartBtn.closest('.product-card');
      const productId   = cartBtn.dataset.id || card?.dataset.id || String(Date.now());
      const stockQtyRaw = cartBtn.dataset.stockQuantity || card?.dataset.stockQuantity || '';
      const stockQty    = stockQtyRaw !== '' ? parseInt(stockQtyRaw) : null;

      if (stockQty !== null) {
        const cartItem   = getCart().find(i => String(i.id) === String(productId));
        const currentQty = cartItem ? (cartItem.quantity || 0) : 0;
        if (currentQty >= stockQty) {
          alert('You have reached the maximum available stock for this product.');
          return;
        }
      }

      addToCart({
        id:            productId,
        name:          cartBtn.dataset.name    || card?.querySelector('.product-name')?.textContent || 'Product',
        price:         parseFloat(cartBtn.dataset.price)   || 0,
        oldPrice:      cartBtn.dataset.oldPrice ? parseFloat(cartBtn.dataset.oldPrice) : null,
        category:      cartBtn.dataset.category || '',
        image:         cartBtn.dataset.image    || '',
        stockQuantity: stockQtyRaw !== '' ? parseInt(stockQtyRaw) : null,
      });
      refreshCartBadge();

      // Micro-animation on button
      cartBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Added!';
      cartBtn.style.background = 'var(--green-dark)';
      setTimeout(() => {
        cartBtn.innerHTML = '<i class="bi bi-cart-plus me-1"></i> Add to Cart';
        cartBtn.style.background = '';
      }, 1400);
      return;
    }

    // Wishlist toggle
    const wishBtn = e.target.closest('.btn-wishlist[data-id]');
    if (wishBtn) {
      const pid  = wishBtn.dataset.id;
      const user = getCurrentUser();
      if (!user) { alert('Please log in to use the wishlist.'); return; }
      toggleWishlist(pid);
      syncHeartIcons();
      updateWishNavBadge();
    }
  });

  /* ── Heart sync ───────────────────────────────────────────── */
  function syncHeartIcons() {
    document.querySelectorAll('.btn-wishlist[data-id]').forEach(btn => {
      const icon = btn.querySelector('i');
      if (!icon) return;
      const wished = isWishlisted(String(btn.dataset.id));
      icon.className = wished ? 'bi bi-heart-fill' : 'bi bi-heart';
      btn.style.color = wished ? '#ef4444' : '';
    });
  }

  /* ── Wishlist drawer ──────────────────────────────────────── */
  const wishlistDrawer  = document.getElementById('wishlistDrawer');
  const drawerBackdrop  = document.getElementById('drawerBackdrop');
  const closeWishBtn    = document.getElementById('closeWishlistDrawer');
  const drawerBody      = document.getElementById('wishlistDrawerBody');
  const wishNavBadge    = document.querySelector('.wishlist-nav-badge');
  const wishlistNavBtn  = document.getElementById('wishlistNavBtn');

  function updateWishNavBadge() {
    const count = getWishlistCount();
    if (!wishNavBadge) return;
    wishNavBadge.textContent = count;
    wishNavBadge.classList.toggle('d-none', count === 0);
  }
  updateWishNavBadge();

  function openWishlistDrawer() {
    renderWishlistDrawer();
    wishlistDrawer?.classList.add('open');
    drawerBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeWishlistDrawerFn() {
    wishlistDrawer?.classList.remove('open');
    drawerBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
  }

  wishlistNavBtn?.addEventListener('click', openWishlistDrawer);
  closeWishBtn?.addEventListener('click', closeWishlistDrawerFn);
  drawerBackdrop?.addEventListener('click', closeWishlistDrawerFn);

  function renderWishlistDrawer() {
    if (!drawerBody) return;
    const list = getWishlist();
    if (list.length === 0) {
      drawerBody.innerHTML = `
        <div class="drawer-empty">
          <i class="bi bi-heart fs-1 text-muted"></i>
          <p class="mt-3 fw-700 text-muted">Your wishlist is empty.</p>
        </div>`;
      return;
    }
    drawerBody.innerHTML = list.map(p => {
      const img = p.image || `https://placehold.co/80x80/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
      return `
        <div class="drawer-product-row" id="drow-${p.id}">
          <img src="${img}" alt="${p.name}"
               onerror="this.src='https://placehold.co/80x80/ecfdf5/16a34a?text=No+Image'"/>
          <div class="drow-info">
            <div class="drow-name">${p.name}</div>
            <div class="drow-cat">${p.category || ''}</div>
            <div class="drow-price">$${parseFloat(p.price || 0).toFixed(2)}</div>
          </div>
          <button class="drow-remove" data-id="${p.id}"><i class="bi bi-x-lg"></i></button>
        </div>`;
    }).join('');

    drawerBody.querySelectorAll('.drow-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromWishlist(btn.dataset.id);
        document.getElementById(`drow-${btn.dataset.id}`)?.remove();
        updateWishNavBadge();
        syncHeartIcons();
        if (getWishlistCount() === 0) renderWishlistDrawer();
      });
    });
  }

  /* ── Navbar auth state ────────────────────────────────────── */
  const accountDropdown = document.getElementById('accountDropdownMenu');
  const accountLabel    = document.getElementById('accountNavLabel');

  function renderAccountMenu() {
    const user = getCurrentUser();
    if (!user) {
      if (accountLabel) accountLabel.textContent = 'Account';
      if (accountDropdown) accountDropdown.innerHTML = `
        <li><h6 class="dropdown-header">Hello, Guest</h6></li>
        <li><a class="dropdown-item" href="Login.html"><i class="bi bi-box-arrow-in-right me-2 text-success"></i>Login</a></li>
        <li><a class="dropdown-item" href="Register.html"><i class="bi bi-person-plus me-2 text-success"></i>Register</a></li>`;
    } else {
      const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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
        <li><a class="dropdown-item" id="navWishlistLink" href="#"><i class="bi bi-heart me-2 text-danger"></i>Wishlist</a></li>
        <li><hr class="dropdown-divider my-1"></li>
        <li><a class="dropdown-item text-danger" id="navLogoutBtn" href="#"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>`;

      document.getElementById('navLogoutBtn')?.addEventListener('click', e => {
        e.preventDefault(); logoutUser();
      });
      document.getElementById('navWishlistLink')?.addEventListener('click', e => {
        e.preventDefault(); openWishlistDrawer();
      });
    }
  }
  renderAccountMenu();
});
