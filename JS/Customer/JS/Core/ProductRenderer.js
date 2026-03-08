/**
 * ProductRenderer.js
 * ─────────────────────────────────────────────────────────────────
 * Normalises raw API products, groups them by category,
 * and renders one section per category inside #dynamic-categories.
 * Works with any common field-name convention from MockAPI.
 */

/* ── 1. Field normaliser helpers ─────────────────────────────── */

// Extracts image URL from flat field OR images[0].url array format
function resolveImage(p) {
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    return first.url || first.src || first.path || first.link || '';
  }
  return p.image || p.img || p.imageUrl || p.thumbnail || p.photo || p.avatar || '';
}

// Handles "in_stock"/"out_of_stock" string OR numeric stockQuantity OR boolean
function resolveStock(p) {
  if (typeof p.stockStatus === 'string') {
    return p.stockStatus.toLowerCase() === 'in_stock';
  }
  if (typeof p.stockQuantity === 'number') return p.stockQuantity > 0;
  const v = p.stock ?? p.inStock ?? p.available;
  return v !== undefined ? Boolean(v) : true;
}

// discountPrice = amount saved → compute % off; fallback to discount field
function resolveDiscount(p) {
  if (p.discountPrice && p.price && parseFloat(p.price) > 0) {
    const pct = Math.round((parseFloat(p.discountPrice) / parseFloat(p.price)) * 100);
    if (pct > 0 && pct < 100) return pct;
  }
  return parseInt(p.discount || p.discountPercent || p.sale || 0) || null;
}

// When discountPrice exists: original = price, sale = price - discountPrice
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

/* ── 1. Field normaliser ─────────────────────────────────────── */
function normalise(p) {
  return {
    id:          p.id          || p.ID          || Math.random(),
    name:        p.name        || p.title       || p.productName || p.product_name || 'Untitled Product',
    category:    p.category    || p.Category    || p.type        || p.Type         || 'Other',
    price:       resolveCurrentPrice(p),
    oldPrice:    resolveOldPrice(p),
    image:       resolveImage(p),
    rating:      parseFloat(p.rating || p.rate || p.stars || 0),
    reviews:     parseInt(p.reviews  || p.reviewCount || p.numReviews || 0),
    discount:    resolveDiscount(p),
    description: p.description || p.desc || p.details || '',
    stock:       resolveStock(p),
    tag:         p.tag || p.badge || null,
  };
}

/* ── 2. Star HTML helper ─────────────────────────────────────── */
function starsHTML(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.4 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    '<i class="bi bi-star-fill"></i>'.repeat(full)  +
    '<i class="bi bi-star-half"></i>'.repeat(half)  +
    '<i class="bi bi-star"></i>'.repeat(empty)
  );
}

/* ── 3. Single product-card HTML ─────────────────────────────── */
function productCardHTML(p) {
  const discountBadge = p.discount
    ? `<span class="badge-discount">${p.discount}% OFF</span>` : '';
  const tagBadge = !p.discount && p.tag
    ? `<span class="badge-tag badge-tag--${p.tag.toLowerCase().replace(/\s+/g,'-')}">${p.tag}</span>` : '';
  const oldPriceHTML  = p.oldPrice && p.oldPrice !== p.price
    ? `<span class="price-old">$${p.oldPrice.toFixed(2)}</span>` : '';
  const reviewText    = p.reviews ? `(${p.reviews} reviews)` : '';
  const imgSrc        = p.image
    ? p.image
    : `https://placehold.co/400x300/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
  const outOfStock    = !p.stock;

  return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="product-card" data-id="${p.id}">
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
                    ${outOfStock ? 'disabled' : ''}>
              <i class="bi bi-cart-plus me-1"></i>
              ${outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <a href="#" class="btn-view">View Details</a>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── 4. Category section HTML ────────────────────────────────── */
function categorySectionHTML(category, products, sectionIndex) {
  const bgClass = sectionIndex % 2 === 0 ? '' : 'bg-page';
  const cards   = products.map(productCardHTML).join('');
  const catId   = `cat-${category.replace(/\s+/g, '-').toLowerCase()}`;

  return `
    <section class="section-pad ${bgClass} category-section" id="${catId}">
      <div class="container-fluid px-3 px-lg-4">

        <!-- Section header -->
        <div class="section-header">
          <div>
            <h2 class="section-title">${category}</h2>
            <p class="section-sub">${products.length} product${products.length !== 1 ? 's' : ''} available</p>
          </div>
          <a href="#" class="btn btn-view-all">View All <i class="bi bi-arrow-right"></i></a>
        </div>

        <!-- Product grid -->
        <div class="row g-3 products-grid" id="${catId}-grid">
          ${cards}
        </div>

        <!-- Show-more (hidden when ≤4 products) -->
        ${products.length > 4 ? `
        <div class="text-center mt-4 show-more-wrap">
          <button class="btn btn-show-more" data-target="${catId}-grid">
            Show More <i class="bi bi-chevron-down ms-1"></i>
          </button>
        </div>` : ''}

      </div>
    </section>`;
}

/* ── 5. Loading skeleton ─────────────────────────────────────── */
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

/* ── 6. Error state ──────────────────────────────────────────── */
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

/* ── 7. Main render function ─────────────────────────────────── */
export function renderProductsByCategory(products, container) {
  if (!products || products.length === 0) {
    showError(container, 'No products were returned from the server.');
    return;
  }

  // Normalise all products
  const normalised = products.map(normalise);

  // Group by category (preserve insertion order)
  const groups = {};
  for (const p of normalised) {
    const cat = p.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }

  // Build HTML for every category
  const html = Object.entries(groups)
    .map(([cat, items], idx) => categorySectionHTML(cat, items, idx))
    .join('');

  container.innerHTML = html;

  // Populate the search <select> with real categories
  const select = document.querySelector('.search-cat');
  if (select) {
    const existing = ['All', ...Object.keys(groups)];
    select.innerHTML = existing
      .map(c => `<option value="${c}">${c}</option>`)
      .join('');
  }

  // Populate category nav bar with real categories
  populateCategoryNav(Object.keys(groups));

  // Wire "Show More" buttons
  container.querySelectorAll('.btn-show-more').forEach(btn => {
    btn.addEventListener('click', function () {
      const gridId = this.dataset.target;
      const grid   = document.getElementById(gridId);
      const hidden = grid.querySelectorAll('.col-6.d-none');
      if (hidden.length) {
        hidden.forEach(c => c.classList.remove('d-none'));
        this.textContent = 'Show Less';
        this.innerHTML   = 'Show Less <i class="bi bi-chevron-up ms-1"></i>';
      } else {
        // hide cards beyond first 4
        const all = grid.querySelectorAll('.col-6');
        all.forEach((c, i) => { if (i >= 4) c.classList.add('d-none'); });
        this.innerHTML = 'Show More <i class="bi bi-chevron-down ms-1"></i>';
        // scroll back to section
        document.getElementById(gridId.replace('-grid', '')).scrollIntoView({ behavior: 'smooth' });
      }
    });
    // Hide cards beyond 4 on initial load
    const grid = document.getElementById(btn.dataset.target);
    grid.querySelectorAll('.col-6').forEach((c, i) => {
      if (i >= 4) c.classList.add('d-none');
    });
  });
}

/* ── 8. Category nav population ─────────────────────────────── */
function populateCategoryNav(categories) {
  const scroll = document.querySelector('.cat-scroll');
  if (!scroll) return;

  // Keep the "More" dropdown, replace the static links
  const dropdown = scroll.querySelector('.dropdown');
  const moreLinks = categories.slice(8); // extras go into "More"

  // Build category links
  const links = categories.slice(0, 8).map(cat => {
    const id = `cat-${cat.replace(/\s+/g, '-').toLowerCase()}`;
    return `<a href="#${id}" class="cat-link">${cat}</a>`;
  }).join('');

  // Build "More" dropdown items
  const moreItems = moreLinks.map(cat => {
    const id = `cat-${cat.replace(/\s+/g, '-').toLowerCase()}`;
    return `<li><a class="dropdown-item" href="#${id}">${cat}</a></li>`;
  }).join('');

  if (dropdown) {
    dropdown.querySelector('.dropdown-menu').innerHTML = moreItems ||
      '<li><a class="dropdown-item" href="#">No more categories</a></li>';
    scroll.innerHTML = links;
    scroll.appendChild(dropdown);
  } else {
    scroll.innerHTML = links;
  }

  // Active highlight on scroll
  scroll.querySelectorAll('.cat-link:not(.dropdown-toggle)').forEach(link => {
    link.addEventListener('click', () => {
      scroll.querySelectorAll('.cat-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}
