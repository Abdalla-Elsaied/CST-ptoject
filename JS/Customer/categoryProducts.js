/**
 * categoryProducts.js
 * Reads ?category=X from URL, loads all products from MockAPI,
 * filters to that category, and renders them all.
 * Feature 3 – dedicated category page
 * Feature 6 – stock validation on Add to Cart
 */

import { loadProductsFromFolder }   from '../Core/FileStorage.js';
import { getCurrentUser, logoutUser, getCartCount } from '../Core/Auth.js';
import { addToCart, getCart }       from './Cart.js';
import { toggleWishlist, isWishlisted, getWishlistCount } from './Wishlist.js';

/* ── URL param ─────────────────────────────────────── */
const params   = new URLSearchParams(location.search);
const CATEGORY = decodeURIComponent(params.get('category') || '');

/* ── DOM refs ──────────────────────────────────────── */
const $ = id => document.getElementById(id);
const catPageTitle    = $('catPageTitle');
const catPageSub      = $('catPageSub');
const bcCategoryName  = $('bcCategoryName');
const catLoading      = $('catLoading');
const catMain         = $('catMain');
const catNoResults    = $('catNoResults');
const catProductGrid  = $('catProductGrid');
const catSearchEmpty  = $('catSearchEmpty');
const catSortSelect   = $('catSortSelect');
const cartBadgeEl     = $('cartBadge');

/* ── Helpers ───────────────────────────────────────── */
function resolveImage(p) {
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    return first.url || first.src || first.path || '';
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
    id:            p.id || String(Math.random()),
    sellerId:      p.sellerId || p.seller_id || null,
    name:          p.name || p.title || 'Product',
    category:      p.category || 'Other',
    price:         resolveCurrentPrice(p),
    oldPrice:      resolveOldPrice(p),
    image:         resolveImage(p),
    rating:        parseFloat(p.rating || 0),
    reviews:       parseInt(p.reviews || 0),
    discount:      resolveDiscount(p),
    stock:         resolveStock(p),
    stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : null,
    tag:           p.tag || null,
  };
}

function refreshCartBadge() {
  if (cartBadgeEl) cartBadgeEl.textContent = getCartCount();
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
    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    if (label) label.textContent = user.name.split(' ')[0];
    dropdown.innerHTML = `
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
      <li><hr class="dropdown-divider my-1"></li>
      <li><a class="dropdown-item text-danger" id="catLogoutBtn" href="#"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>`;
    $('catLogoutBtn')?.addEventListener('click', e => { e.preventDefault(); logoutUser(); });
  }
}

/* ── Card HTML ─────────────────────────────────────── */
function cardHTML(p) {
  const imgSrc      = p.image || `https://placehold.co/400x300/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
  const discount    = p.discount ? `<span class="badge-discount">${p.discount}% OFF</span>` : '';
  const oldPrice    = p.oldPrice ? `<span class="price-old">$${p.oldPrice.toFixed(2)}</span>` : '';
  const reviewText  = p.reviews  ? `(${p.reviews} reviews)` : '';
  const outOfStock  = !p.stock;
  const wished      = isWishlisted(p.id);

  return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="product-card"
           data-id="${p.id}"
           data-seller-id="${p.sellerId || ''}"
           data-stock-quantity="${p.stockQuantity !== null ? p.stockQuantity : ''}">
        <div class="product-img-wrap">
          <img src="${imgSrc}" alt="${p.name}" class="product-img" loading="lazy"
               onerror="this.onerror=null;this.src='https://placehold.co/400x300/ecfdf5/16a34a?text=No+Image'"/>
          ${discount}
          ${outOfStock ? '<span class="badge-out-of-stock">Out of Stock</span>' : ''}
          <button class="btn-wishlist" data-id="${p.id}" title="Wishlist"
                  style="color:${wished ? '#ef4444' : ''}">
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
                    data-name="${p.name.replace(/"/g, '&quot;')}"
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

/* ── Render grid ───────────────────────────────────── */
let allNormalised = [];   // full list for this category

function renderGrid(products) {
  if (!catProductGrid) return;
  if (products.length === 0) {
    catProductGrid.innerHTML = '';
    catSearchEmpty?.classList.remove('d-none');
    return;
  }
  catSearchEmpty?.classList.add('d-none');
  catProductGrid.innerHTML = products.map(cardHTML).join('');
}

function getSorted(list) {
  const val = catSortSelect?.value || 'default';
  const copy = [...list];
  switch (val) {
    case 'price-asc':   return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':  return copy.sort((a, b) => b.price - a.price);
    case 'rating-desc': return copy.sort((a, b) => b.rating - a.rating);
    case 'name-asc':    return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:            return copy;
  }
}

/* ── Search within page ────────────────────────────── */
function doInlineSearch(query) {
  const q = (query || '').trim().toLowerCase();
  const filtered = q
    ? allNormalised.filter(p => p.name.toLowerCase().includes(q))
    : allNormalised;
  renderGrid(getSorted(filtered));
}

/* ── Main init ─────────────────────────────────────── */
async function init() {
  renderAccountMenu();
  refreshCartBadge();

  if (!CATEGORY) {
    catLoading?.classList.add('d-none');
    catNoResults?.classList.remove('d-none');
    return;
  }

  // Set titles
  document.title = `${CATEGORY} – DEALPORT`;
  if (catPageTitle)   catPageTitle.textContent   = CATEGORY;
  if (bcCategoryName) bcCategoryName.textContent = CATEGORY;
  if (catPageSub)     catPageSub.textContent     = 'Loading products…';

  let allProducts;
  try {
    allProducts = await loadProductsFromFolder();
  } catch {
    catLoading?.classList.add('d-none');
    catNoResults?.classList.remove('d-none');
    return;
  }

  // Filter to this category
  const categoryProducts = allProducts.filter(
    p => (p.category || p.Category || '').toLowerCase() === CATEGORY.toLowerCase()
  );

  catLoading?.classList.add('d-none');

  if (categoryProducts.length === 0) {
    catNoResults?.classList.remove('d-none');
    return;
  }

  allNormalised = categoryProducts.map(normalise);
  if (catPageSub) catPageSub.textContent = `${allNormalised.length} product${allNormalised.length !== 1 ? 's' : ''} found`;
  catMain.style.display = '';

  renderGrid(getSorted(allNormalised));

  // Sort change
  catSortSelect?.addEventListener('change', () => {
    const q = $('catSearchInput')?.value || $('catSearchInputMobile')?.value || '';
    doInlineSearch(q);
  });

  // Search
  [$('catSearchBtn'), $('catSearchBtnMobile')].forEach(btn => {
    btn?.addEventListener('click', () => {
      const q = $('catSearchInput')?.value || $('catSearchInputMobile')?.value || '';
      doInlineSearch(q);
    });
  });
  [$('catSearchInput'), $('catSearchInputMobile')].forEach(inp => {
    inp?.addEventListener('input', () => doInlineSearch(inp.value));
    inp?.addEventListener('keypress', e => { if (e.key === 'Enter') doInlineSearch(inp.value); });
  });
  $('clearCatSearch')?.addEventListener('click', () => {
    if ($('catSearchInput'))       $('catSearchInput').value = '';
    if ($('catSearchInputMobile')) $('catSearchInputMobile').value = '';
    renderGrid(getSorted(allNormalised));
  });

  /* ── Delegated events: Cart + Wishlist ──────────── */
  catProductGrid?.addEventListener('click', e => {

    // Add to Cart – Feature 6: stock validation
    const cartBtn = e.target.closest('.btn-add-cart');
    if (cartBtn && !cartBtn.disabled) {
      const card        = cartBtn.closest('.product-card');
      const pid         = cartBtn.dataset.id || card?.dataset.id;
      const stockQtyRaw = cartBtn.dataset.stockQuantity || card?.dataset.stockQuantity || '';
      const stockQty    = stockQtyRaw !== '' ? parseInt(stockQtyRaw) : null;

      if (stockQty !== null) {
        const cart     = getCart();
        const item     = cart.find(i => String(i.id) === String(pid));
        const inCart   = item ? (item.quantity || 0) : 0;
        if (inCart >= stockQty) {
          alert('You have reached the maximum available stock for this product.');
          return;
        }
      }

      const product = {
        id:       pid,
        name:     cartBtn.dataset.name || card?.querySelector('.product-name')?.textContent || 'Product',
        price:    parseFloat(cartBtn.dataset.price) || 0,
        oldPrice: cartBtn.dataset.oldPrice ? parseFloat(cartBtn.dataset.oldPrice) : null,
        category: cartBtn.dataset.category || CATEGORY,
        image:    cartBtn.dataset.image    || card?.querySelector('.product-img')?.src || '',
      };
      addToCart(product, 1);

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
      const card     = wishBtn.closest('.product-card');
      const id       = card?.dataset.id || wishBtn.dataset.id;
      const name     = card?.querySelector('.product-name')?.textContent || 'Product';
      const price    = card?.querySelector('.price-now')?.textContent?.replace('$', '') || '0';
      const image    = card?.querySelector('.product-img')?.src || '';
      const added    = toggleWishlist({ id, name, price: parseFloat(price), category: CATEGORY, image });
      const icon     = wishBtn.querySelector('i');
      if (icon) icon.className = added ? 'bi bi-heart-fill' : 'bi bi-heart';
      wishBtn.style.color = added ? '#ef4444' : '';
    }
  });
}

init();
