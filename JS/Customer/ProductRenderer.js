/**
 * ProductRenderer.js
 * ─────────────────────────────────────────────────────────────────
 * Changes vs previous version:
 *
 *  Feature 2 – sellerId stored as data-seller-id on .product-card
 *  Feature 3 – "View All" navigates to categoryProducts.html?category=X
 *              (no inline expand — Show More button removed)
 *  Feature 4 – doSearch() hides entire category <section> when no match
 *              (already wired in CustomerHomePage.js; renderer just ensures
 *               category sections carry the right data-category attribute)
 *  Feature 5 – populateCategoryNav() sorts by product count desc,
 *               shows top 4 in bar, rest in "More" dropdown,
 *               each link navigates to categoryProducts.html?category=X
 */

/* ── Field normaliser helpers ─────────────────────────────────── */

function resolveImage(p) {
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    return first.url || first.src || first.path || first.link || '';
  }
  return p.image || p.img || p.imageUrl || p.thumbnail || p.photo || p.avatar || '';
}

function resolveStock(p) {
  if (typeof p.stockStatus === 'string') {
    return p.stockStatus.toLowerCase() === 'in_stock';
  }
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

/* ── Field normaliser ────────────────────────────────────────── */
function normalise(p) {
  return {
    id: p.id || p.ID || Math.random(),
    sellerId: p.sellerId || p.seller_id || p.userId || null,  // Feature 2
    name: p.name || p.title || p.productName || p.product_name || 'Untitled Product',
    category: p.category || p.Category || p.type || p.Type || 'Other',
    price: resolveCurrentPrice(p),
    oldPrice: resolveOldPrice(p),
    image: resolveImage(p),
    rating: parseFloat(p.rating || p.rate || p.stars || 0),
    reviews: parseInt(p.reviews || p.reviewCount || p.numReviews || 0),
    discount: resolveDiscount(p),
    description: p.description || p.desc || p.details || '',
    stock: resolveStock(p),
    stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : null,
    tag: p.tag || p.badge || null,
  };
}

/* ── Star HTML ───────────────────────────────────────────────── */
function starsHTML(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.4 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    '<i class="bi bi-star-fill"></i>'.repeat(full) +
    '<i class="bi bi-star-half"></i>'.repeat(half) +
    '<i class="bi bi-star"></i>'.repeat(empty)
  );
}

/* ── Single product card HTML ────────────────────────────────── */
function productCardHTML(p) {
  console.log(p);
  const discountBadge = p.discount
    ? `<span class="badge-discount">${p.discount}% OFF</span>` : '';
  const tagBadge = !p.discount && p.tag
    ? `<span class="badge-tag badge-tag--${p.tag.toLowerCase().replace(/\s+/g, '-')}">${p.tag}</span>` : '';
  const oldPriceHTML = p.oldPrice && p.oldPrice !== p.price
    ? `<span class="price-old">$${p.oldPrice.toFixed(2)}</span>` : '';
  const reviewText = p.reviews ? `(${p.reviews} reviews)` : '';
  const imgSrc = p.image
    ? p.image
    : `https://placehold.co/400x300/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
  const outOfStock = !p.stock;

  // Feature 2: data-seller-id on product card; stockQuantity for stock validation
  return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="product-card"
           data-id="${p.id}"
           data-seller-id="${p.sellerId || ''}"
           data-stock-quantity="${p.stockQuantity !== null ? p.stockQuantity : ''}">
        <div class="product-img-wrap">
          <img src="${imgSrc}"
               alt="${p.name}"
               class="product-img"
               loading="lazy"
               onerror="this.onerror=null;this.src='https://placehold.co/400x300/ecfdf5/16a34a?text=No+Image'"/>
          ${discountBadge}${tagBadge}
          ${outOfStock ? '<span class="badge-out-of-stock">Out of Stock</span>' : ''}
          <button class="btn-wishlist" title="Add to wishlist">
            <i class="bi bi-heart"></i>
          </button>
        </div>
        <div class="product-body">
          <p class="product-category">${p.category}</p>
          <h5 class="product-name" title="${p.name}">${p.name}</h5>
          <div class="product-stars">
            ${starsHTML(p.rating)}
            <span>${reviewText}</span>
          </div>
          <div class="product-price">
            <span class="price-now">$${p.price.toFixed(2)}</span>
            ${oldPriceHTML}
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

/* ── Category section HTML ───────────────────────────────────── */
// Feature 3: View All → categoryProducts.html?category=X (no inline expand)
// Feature 4: data-category on <section> so search can hide entire section
function categorySectionHTML(category, products, sectionIndex) {
  const bgClass = sectionIndex % 2 === 0 ? '' : 'bg-page';
  // Show only first 4 products as preview
  const preview = products.slice(0, 4);
  const cards = preview.map(productCardHTML).join('');
  const catId = `cat-${category.replace(/\s+/g, '-').toLowerCase()}`;
  const catEncoded = encodeURIComponent(category);

  return `
    <section class="section-pad ${bgClass} category-section"
             id="${catId}"
             data-category="${category}">
      <div class="container-fluid px-3 px-lg-4">

        <div class="section-header">
          <div>
            <h2 class="section-title">${category}</h2>
            <p class="section-sub">${products.length} product${products.length !== 1 ? 's' : ''} available</p>
          </div>
          <!-- Feature 3: navigate to category page, never expand inline -->
          <a href="categoryProducts.html?category=${catEncoded}"
             class="btn btn-view-all">
            View All <i class="bi bi-arrow-right"></i>
          </a>
        </div>

        <div class="row g-3 products-grid" id="${catId}-grid">
          ${cards}
        </div>

      </div>
    </section>`;
}

/* ── Loading skeleton ────────────────────────────────────────── */
export function showSkeleton(container) {
  container.innerHTML = `
    <section class="section-pad">
      <div class="container-fluid px-3 px-lg-4">
        <div class="section-header">
          <div class="skeleton-line w-200px"></div>
          <div class="skeleton-line w-80px"></div>
        </div>
        <div class="row g-3">
          ${Array(4).fill(`
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
            </div>`).join('')}
        </div>
      </div>
    </section>`;
}

/* ── Error state ─────────────────────────────────────────────── */
export function showError(container, message) {
  container.innerHTML = `
    <section class="section-pad">
      <div class="container-fluid px-3 px-lg-4">
        <div class="api-error-state">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <h4>Could not load products</h4>
          <p>${message}</p>
          <button class="btn btn-add-cart px-4" onclick="window.location.reload()">
            <i class="bi bi-arrow-clockwise me-2"></i>Try Again
          </button>
        </div>
      </div>
    </section>`;
}

/* ── Main render function ────────────────────────────────────── */
export function renderProductsByCategory(products, container) {
  if (!products || products.length === 0) {
    showError(container, 'No products were returned from the server.');
    return;
  }

  const normalised = products.map(normalise);

  // Feature 5: sort categories by product count descending
  const groups = {};
  for (const p of normalised) {
    const cat = p.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }

  // Sort category keys by count desc
  const sortedCategories = Object.keys(groups).sort(
    (a, b) => groups[b].length - groups[a].length
  );

  // Build HTML in popularity order
  const html = sortedCategories
    .map((cat, idx) => categorySectionHTML(cat, groups[cat], idx))
    .join('');

  container.innerHTML = html;

  // Populate search <select> with sorted categories
  const select = document.querySelector('.search-cat');
  if (select) {
    select.innerHTML = ['All', ...sortedCategories]
      .map(c => `<option value="${c}">${c}</option>`)
      .join('');
  }

  // Feature 5: populate category nav sorted by count
  populateCategoryNav(sortedCategories);
}

/* ── Category nav – Feature 5 ───────────────────────────────── */
// Top 4 categories (by product count) shown directly; rest in "More" dropdown.
// Every link navigates to categoryProducts.html?category=X
function populateCategoryNav(sortedCategories) {
  const scroll = document.querySelector('.cat-scroll');
  if (!scroll) return;

  const top4 = sortedCategories.slice(0, 4);
  const more = sortedCategories.slice(4);

  const links = top4.map(cat => {
    const enc = encodeURIComponent(cat);
    return `<a href="categoryProducts.html?category=${enc}" class="cat-link">${cat}</a>`;
  }).join('');

  const moreItems = more.length
    ? more.map(cat => {
      const enc = encodeURIComponent(cat);
      return `<li><a class="dropdown-item" href="categoryProducts.html?category=${enc}">${cat}</a></li>`;
    }).join('')
    : '<li><a class="dropdown-item text-muted" href="#">No more categories</a></li>';

  scroll.innerHTML = `
    ${links}
    <div class="dropdown d-inline-block">
      <a href="#" class="cat-link dropdown-toggle" data-bs-toggle="dropdown">More</a>
      <ul class="dropdown-menu">${moreItems}</ul>
    </div>`;

  // Active highlight on click (for anchor-only nav)
  scroll.querySelectorAll('.cat-link:not(.dropdown-toggle)').forEach(link => {
    link.addEventListener('click', () => {
      scroll.querySelectorAll('.cat-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}
