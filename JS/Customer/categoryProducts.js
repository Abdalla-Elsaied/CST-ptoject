/**
 * categoryProducts.js  (Enhanced)
 * Reads ?category=X, loads all products for that category.
 * Adds: view toggle (grid/list), load-more pagination,
 *       toolbar with search chip, skeleton loading.
 */
import { getLS } from '../Core/Storage.js';
import { KEY_CATEGORIES } from '../Core/Constants.js';
import { loadProductsFromFolder } from '../Core/FileStorage.js';
import { getCurrentUser, logoutUser }            from '../Core/Auth.js';
import { addToCart, getCart, getCartCount }                                  from './Cart.js';
import { toggleWishlist, isWishlisted }                        from './Wishlist.js';

/* ── URL param ─────────────────────────────────────── */
const CATEGORY = decodeURIComponent(new URLSearchParams(location.search).get('category') || '');

/* ── Constants ─────────────────────────────────────── */
const PAGE_SIZE = 12;    // products per "page"

/* ── DOM refs ──────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── Image / price helpers (mirrors ProductRenderer) ─ */
function resolveImage(p) {
  if (Array.isArray(p.images) && p.images.length > 0) {
    const f = p.images[0];
    return f.url || f.src || f.path || '';
  }
  return p.image || p.img || p.imageUrl || p.thumbnail || p.photo || '';
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
function resolveCurrentPrice(p) {
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
function normalise(p) {
  return {
    id:            p.id  || String(Math.random()),
    sellerId:      p.sellerId || p.seller_id || null,
    name:          p.name || p.title || 'Product',
    category:      p.category || CATEGORY || 'Other',
    price:         resolveCurrentPrice(p),
    oldPrice:      resolveOldPrice(p),
    image:         resolveImage(p),
    rating:        parseFloat(p.rating || 0),
    reviews:       parseInt(p.reviews || 0),
    discount:      resolveDiscount(p),
    stock:         resolveStock(p),
    stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : null,
    tag:           p.tag || null,
    description:   p.description || '',
  };
}

/* ── Card HTML ─────────────────────────────────────── */
function cardHTML(p) {
  const imgSrc     = p.image || `https://placehold.co/400x300/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
  const discount   = p.discount ? `<span class="badge-discount">${p.discount}% OFF</span>` : '';
  const tagBadge   = !p.discount && p.tag
    ? `<span class="badge-tag badge-tag--${p.tag.toLowerCase().replace(/\s+/g,'-')}">${p.tag}</span>` : '';
  const oldPrice   = p.oldPrice ? `<span class="price-old">$${p.oldPrice.toFixed(2)}</span>` : '';
  const reviewText = p.reviews  ? `(${p.reviews} reviews)` : '';
  const outOfStock = !p.stock;
  const wished     = isWishlisted(p.id);

  return `
    <div class="col-6 col-md-4 col-lg-3 col-cat">
      <div class="product-card"
           data-id="${p.id}"
           data-seller-id="${p.sellerId || ''}"
           data-stock-quantity="${p.stockQuantity !== null ? p.stockQuantity : ''}">
        <div class="product-img-wrap">
          <img src="${imgSrc}" alt="${p.name}" class="product-img" loading="lazy"
               onerror="this.onerror=null;this.src='https://placehold.co/400x300/ecfdf5/16a34a?text=No+Image'"/>
          ${discount}${tagBadge}
          ${outOfStock ? '<span class="badge-out-of-stock">Out of Stock</span>' : ''}
          <button class="btn-wishlist" data-id="${p.id}" title="Wishlist"
                  style="${wished ? 'color:#ef4444' : ''}">
            <i class="bi ${wished ? 'bi-heart-fill' : 'bi-heart'}"></i>
          </button>
        </div>
        <div class="product-body">
          <p class="product-category">${p.category}</p>
          <h5 class="product-name" title="${p.name}">${p.name}</h5>
          <div class="product-stars">${starsHTML(p.rating)}<span>${reviewText}</span></div>
          <div class="product-price">
            <span class="price-now">$${p.price.toFixed(2)}</span>${oldPrice}
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

/* ── Skeleton cards ────────────────────────────────── */
function skeletonHTML(count = 8) {
  return Array(count).fill(`
    <div class="col-6 col-md-4 col-lg-3">
      <div class="cat-skeleton-card">
        <div class="sk-img"></div>
        <div class="sk-body">
          <div class="sk-line w-third"></div>
          <div class="sk-line w-full"></div>
          <div class="sk-line w-half"></div>
          <div class="sk-line w-third mt-2"></div>
        </div>
      </div>
    </div>`).join('');
}

/* ── State ─────────────────────────────────────────── */
let allNormalised = [];
let filtered      = [];
let currentPage   = 1;
let currentView   = 'grid'; // 'grid' | 'list'
let searchQuery   = '';

/* ── Sorting ───────────────────────────────────────── */
function getSorted(list) {
  const val  = $('catSortSelect')?.value || 'default';
  const copy = [...list];
  switch (val) {
    case 'price-asc':   return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':  return copy.sort((a, b) => b.price - a.price);
    case 'rating-desc': return copy.sort((a, b) => b.rating - a.rating);
    case 'name-asc':    return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:            return copy;
  }
}

/* ── Render current page ───────────────────────────── */
function renderPage() {
  const grid = $('catProductGrid');
  if (!grid) return;

  const sorted = getSorted(filtered);
  const total  = sorted.length;
  const start  = (currentPage - 1) * PAGE_SIZE;
  const slice  = sorted.slice(0, currentPage * PAGE_SIZE);  // cumulative

  // Empty search
  const searchEmpty = $('catSearchEmpty');
  if (total === 0 && searchQuery) {
    grid.innerHTML = '';
    searchEmpty?.classList.remove('d-none');
  } else {
    searchEmpty?.classList.add('d-none');
    grid.innerHTML = slice.map(cardHTML).join('');
  }

  // Apply view class
  grid.classList.toggle('list-view', currentView === 'list');

  // Toolbar count
  const toolbarCount = $('toolbarCount');
  if (toolbarCount) {
    toolbarCount.textContent = searchQuery
      ? `${total} result${total !== 1 ? 's' : ''} for "${searchQuery}"`
      : `${total} product${total !== 1 ? 's' : ''}`;
  }

  // Load more button
  const loadMoreWrap = $('catLoadMoreWrap');
  const loadMoreBtn  = $('catLoadMoreBtn');
  if (loadMoreWrap && loadMoreBtn) {
    if (currentPage * PAGE_SIZE < total) {
      loadMoreWrap.classList.remove('d-none');
      loadMoreBtn.disabled = false;
      const remaining = total - currentPage * PAGE_SIZE;
      loadMoreBtn.innerHTML = `<i class="bi bi-arrow-down-circle me-2"></i>Load More (${remaining} left)`;
    } else {
      loadMoreWrap.classList.add('d-none');
    }
  }
}

/* ── Filter by search query ────────────────────────── */
function applySearch(q) {
  searchQuery = (q || '').trim().toLowerCase();
  currentPage = 1;
  filtered = searchQuery
    ? allNormalised.filter(p =>
        p.name.toLowerCase().includes(searchQuery) ||
        p.description.toLowerCase().includes(searchQuery))
    : [...allNormalised];

  // Search chip in toolbar
  const chip      = $('activeSearchChip');
  const chipText  = $('searchChipText');
  if (chip && chipText) {
    if (searchQuery) {
      chipText.textContent = `"${searchQuery}"`;
      chip.classList.remove('d-none');
    } else {
      chip.classList.add('d-none');
    }
  }

  renderPage();
}

/* ── Refresh cart badge ────────────────────────────── */
function refreshCartBadge() {
  const badge = $('cartBadge');
  if (badge) badge.textContent = getCartCount();
}

/* ── Account menu ──────────────────────────────────── */
function renderAccountMenu() {
  const dropdown = $('accountDropdownMenu');
  const label    = $('accountNavLabel');
  if (!dropdown) return;
  const user = getCurrentUser();
  if (!user) {
    if (label) label.textContent = 'Account';
    dropdown.innerHTML = `
      <li><h6 class="dropdown-header">Hello, Guest</h6></li>
      <li><a class="dropdown-item" href="Login.html"><i class="bi bi-box-arrow-in-right me-2 text-success"></i>Login</a></li>`;
  } else {
    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    if (label) label.textContent = user.name.split(' ')[0];
    dropdown.innerHTML = `
      <li>
        <div class="dropdown-user-header">
          ${user.photoUrl 
            ? `<img src="${user.photoUrl}" class="dropdown-user-avatar" style="border-radius:50%;object-fit:cover;"/>`
            : `<div class="dropdown-user-avatar">${initials}</div>`}
          <div>
            <div class="dropdown-user-name">${user.name}</div>
            <div class="dropdown-user-email">${user.email}</div>
          </div>
        </div>
      </li>
      <li><hr class="dropdown-divider my-1"></li>
      <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person-circle me-2 text-success"></i>My Profile</a></li>
      <li><hr class="dropdown-divider my-1"></li>
      <li><a class="dropdown-item text-danger" id="catLogoutBtn" href="#"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>`;
    $('catLogoutBtn')?.addEventListener('click', e => { e.preventDefault(); logoutUser(); });
  }
}

/* ── Main init ─────────────────────────────────────── */
async function init() {
  renderAccountMenu();
  refreshCartBadge();

  if (!CATEGORY) {
    $('catLoading')?.classList.add('d-none');
    $('catNoResults')?.classList.remove('d-none');
    return;
  }

  // Set titles immediately
  document.title = `${CATEGORY} – DEALPORT`;
  [$('catPageTitle'), $('heroCategoryName'), $('bcCategoryName')].forEach(el => {
    if (el) el.textContent = CATEGORY;
  });

  // Show skeleton while loading
  const grid = $('catProductGrid');
  const main  = $('catMain');
  if (grid && main) {
    grid.innerHTML = skeletonHTML(8);
    main.classList.remove('d-none');
    $('catLoading')?.classList.add('d-none');
  }

  let allProducts;
  try {
    allProducts = await loadProductsFromFolder();
  } catch {
    if (grid) grid.innerHTML = '';
    $('catNoResults')?.classList.remove('d-none');
    main?.classList.add('d-none');
    return;
  }

  // Filter to category
  const approvedCategories = new Set(
      (getLS(KEY_CATEGORIES) || [])
          .filter(c => c.visibility === 'active')
          .map(c => c.name.toLowerCase())
  );

  // Block access if category not approved
  if (!approvedCategories.has(CATEGORY.toLowerCase())) {
      if (grid) grid.innerHTML = '';
      main?.classList.add('d-none');
      $('catNoResults')?.classList.remove('d-none');
      return;
  }

  const categoryProducts = allProducts.filter(
      p => (p.category || p.Category || '').toLowerCase() === CATEGORY.toLowerCase()
  );

  if (categoryProducts.length === 0) {
    if (grid) grid.innerHTML = '';
    main?.classList.add('d-none');
    $('catNoResults')?.classList.remove('d-none');
    return;
  }

  allNormalised = categoryProducts.map(normalise);
  filtered      = [...allNormalised];
  currentPage   = 1;

  // Update subtitle & chip
  const subText = `${allNormalised.length} product${allNormalised.length !== 1 ? 's' : ''} available`;
  if ($('catPageSub'))    $('catPageSub').textContent    = subText;
  if ($('catCountText'))  $('catCountText').textContent  = subText;
  const chip = $('catCountChip');
  if (chip) chip.style.removeProperty('display');

  // Show toolbar
  $('catToolbar')?.classList.remove('d-none');

  renderPage();

  /* ── Events ── */

  // Sort
  $('catSortSelect')?.addEventListener('change', () => { currentPage = 1; renderPage(); });

  // Search (desktop + mobile unified via same input in new layout)
  const searchInput = $('catSearchInput');
  $('catSearchBtn')?.addEventListener('click', () => applySearch(searchInput?.value));
  searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') applySearch(searchInput.value); });
  searchInput?.addEventListener('input', () => {
    if (!searchInput.value.trim()) applySearch('');
  });

  // Search chip clear
  $('clearSearchChip')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    applySearch('');
  });

  // Clear search empty state
  $('clearCatSearch')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    applySearch('');
  });

  // Load more
  $('catLoadMoreBtn')?.addEventListener('click', () => {
    currentPage++;
    renderPage();
    // Smooth scroll down a bit
    window.scrollBy({ top: 400, behavior: 'smooth' });
  });

  // View toggle
  $('btnGridView')?.addEventListener('click', () => {
    currentView = 'grid';
    $('btnGridView')?.classList.add('active');
    $('btnListView')?.classList.remove('active');
    renderPage();
  });
  $('btnListView')?.addEventListener('click', () => {
    currentView = 'list';
    $('btnListView')?.classList.add('active');
    $('btnGridView')?.classList.remove('active');
    renderPage();
  });

  // Delegated: cart + wishlist
  grid?.addEventListener('click', e => {

    // Add to Cart (Feature 6 stock check)
    const cartBtn = e.target.closest('.btn-add-cart');
    if (cartBtn && !cartBtn.disabled) {
      const card       = cartBtn.closest('.product-card');
      const pid        = cartBtn.dataset.id || card?.dataset.id;
      const stockQtyRaw = cartBtn.dataset.stockQuantity || card?.dataset.stockQuantity || '';
      const stockQty   = stockQtyRaw !== '' ? parseInt(stockQtyRaw) : null;

      if (stockQty !== null) {
        const cartItem = getCart().find(i => String(i.id) === String(pid));
        const inCart   = cartItem ? (cartItem.quantity || 0) : 0;
        if (inCart >= stockQty) {
          alert('You have reached the maximum available stock for this product.');
          return;
        }
      }

      addToCart({
        id:       pid,
        name:     cartBtn.dataset.name || card?.querySelector('.product-name')?.textContent || 'Product',
        price:    parseFloat(cartBtn.dataset.price) || 0,
        oldPrice: cartBtn.dataset.oldPrice ? parseFloat(cartBtn.dataset.oldPrice) : null,
        category: cartBtn.dataset.category || CATEGORY,
        image:    cartBtn.dataset.image    || card?.querySelector('.product-img')?.src || '',
      }, 1);

      const orig = cartBtn.innerHTML;
      cartBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Added!';
      cartBtn.style.background = '#16a34a';
      cartBtn.disabled = true;
      refreshCartBadge();
      setTimeout(() => {
        cartBtn.innerHTML = orig;
        cartBtn.style.background = '';
        cartBtn.disabled = false;
      }, 1800);
    }

    // Wishlist toggle
    const wishBtn = e.target.closest('.btn-wishlist');
    if (wishBtn) {
      const card  = wishBtn.closest('.product-card');
      const id    = card?.dataset.id || wishBtn.dataset.id;
      const name  = card?.querySelector('.product-name')?.textContent || 'Product';
      const price = card?.querySelector('.price-now')?.textContent?.replace('$','') || '0';
      const image = card?.querySelector('.product-img')?.src || '';
      const added = toggleWishlist({ id, name, price: parseFloat(price), category: CATEGORY, image });
      const icon  = wishBtn.querySelector('i');
      if (icon) icon.className = added ? 'bi bi-heart-fill' : 'bi bi-heart';
      wishBtn.style.color = added ? '#ef4444' : '';
    }
  });
}

init();
