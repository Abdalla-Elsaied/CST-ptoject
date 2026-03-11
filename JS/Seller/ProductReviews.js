import { getLS } from '../Core/FileStorage.js';
import { KEY_PRODUCTS } from '../Core/Constants.js';
import { KEY_PRODUCT_REVIEWS, starsHTML, formatDate } from '../Customer/Reviews.js';

const searchInput = document.getElementById('reviewSearchInput');
const productFilter = document.getElementById('reviewProductFilter');
const ratingFilter = document.getElementById('reviewRatingFilter');
const sortSelect = document.getElementById('reviewSort');
const reviewsList = document.getElementById('reviewsList');
const emptyState = document.getElementById('reviewsEmpty');
const exportBtn = document.getElementById('exportReviewsBtn');

const stats = {
  total: document.getElementById('statTotalReviews'),
  avg: document.getElementById('statAvgRating'),
  five: document.getElementById('statFiveStar'),
  products: document.getElementById('statProductsReviewed')
};

let allReviews = [];
let productMap = new Map();

function safeLower(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getCategoryValue(raw) {
  const direct =
    raw?.category ??
    raw?.productCategory ??
    raw?.product_category ??
    raw?.categoryName ??
    raw?.productCategoryName ??
    raw?.type ??
    raw?.tag;

  if (Array.isArray(direct)) {
    const first = direct[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      return first.name ?? first.title ?? first.label ?? first.value ?? '';
    }
    return '';
  }

  if (direct && typeof direct === 'object') {
    return direct.name ?? direct.title ?? direct.label ?? direct.value ?? '';
  }

  return direct ?? '';
}

function normalizeProduct(raw, idx) {
  const name = raw?.productName ?? raw?.name ?? 'Unknown Product';
  const categoryRaw = getCategoryValue(raw);
  const category = String(categoryRaw || '').trim();
  const image =
    raw?.image ??
    raw?.imageUrl ??
    raw?.productImage ??
    (Array.isArray(raw?.images) && raw.images.length
      ? (typeof raw.images[0] === 'string' ? raw.images[0] : raw.images[0]?.url)
      : '');
  return {
    id: raw?.id ?? String(idx + 1),
    name,
    category: category || 'Uncategorized',
    image:
      image ||
      `https://placehold.co/120x120/ecfdf5/166534?text=${encodeURIComponent(name)}`,
  };
}

function loadProducts() {
  const keys = [KEY_PRODUCTS, 'products', 'sellerProducts'];
  let list = [];
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(parsed) && parsed.length) {
        list = parsed;
        break;
      }
    } catch (_err) {
      // try next key
    }
  }
  productMap = new Map(
    list.map((item, idx) => {
      const normalized = normalizeProduct(item, idx);
      return [String(normalized.id), normalized];
    })
  );
}

function flattenReviews() {
  const all = getLS(KEY_PRODUCT_REVIEWS) || {};
  const rows = [];

  Object.entries(all).forEach(([productId, reviews]) => {
    if (!Array.isArray(reviews)) return;
    reviews.forEach((review) => {
      rows.push({
        ...review,
        productId: String(productId)
      });
    });
  });

  return rows;
}

function buildProductFilter() {
  const uniqueIds = new Map();
  allReviews.forEach((review) => {
    const pid = String(review.productId);
    const product = productMap.get(pid);
    const name = product?.name ?? `Product #${pid}`;
    uniqueIds.set(pid, name);
  });

  const options = [
    `<option value="all">All products</option>`,
    ...Array.from(uniqueIds.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => `<option value="${id}">${name}</option>`)
  ];

  productFilter.innerHTML = options.join('');
}

function calcStats(list) {
  const total = list.length;
  const avg = total ? list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / total : 0;
  const five = list.filter((r) => Number(r.rating) === 5).length;
  const productCount = new Set(list.map((r) => String(r.productId))).size;

  stats.total.textContent = String(total);
  stats.avg.textContent = avg.toFixed(1);
  stats.five.textContent = String(five);
  stats.products.textContent = String(productCount);
}

function sortReviews(list, sortMode) {
  const sorted = list.slice();
  if (sortMode === 'oldest') {
    sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (sortMode === 'helpful') {
    sorted.sort((a, b) => (Number(b.helpful) || 0) - (Number(a.helpful) || 0));
  } else if (sortMode === 'rating-high') {
    sorted.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sortMode === 'rating-low') {
    sorted.sort((a, b) => (Number(a.rating) || 0) - (Number(b.rating) || 0));
  } else {
    sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }
  return sorted;
}

function renderReviews() {
  const query = safeLower(searchInput.value);
  const selectedProduct = productFilter.value;
  const selectedRating = ratingFilter.value;
  const sortMode = sortSelect.value;

  let list = allReviews.slice();

  if (selectedProduct !== 'all') {
    list = list.filter((r) => String(r.productId) === String(selectedProduct));
  }

  if (selectedRating !== 'all') {
    list = list.filter((r) => String(r.rating) === String(selectedRating));
  }

  if (query) {
    list = list.filter((r) => {
      const product = productMap.get(String(r.productId));
      const haystack = [
        r.title,
        r.comment,
        r.name,
        product?.name,
        product?.category
      ].map(safeLower).join(' ');
      return haystack.includes(query);
    });
  }

  list = sortReviews(list, sortMode);
  calcStats(list);

  if (!list.length) {
    reviewsList.innerHTML = '';
    emptyState.classList.remove('d-none');
    return;
  }

  emptyState.classList.add('d-none');

  reviewsList.innerHTML = list.map((review) => {
    const product = productMap.get(String(review.productId));
    const productName = product?.name ?? `Product #${review.productId}`;
    const productCategory = product?.category ?? 'Uncategorized';
    const productImage = product?.image ?? `https://placehold.co/120x120/ecfdf5/166534?text=${encodeURIComponent(productName)}`;
    const rating = Number(review.rating) || 0;
    const ratingLabel = `${rating.toFixed(1)} / 5`;
    return `
      <article class="review-card">
        <div class="review-card-header">
          <div class="review-product">
            <img src="${productImage}" alt="${productName}" />
            <div>
              <h5>${productName}</h5>
              <span>${productCategory}</span>
            </div>
          </div>
          <div class="review-meta">
            <div class="review-stars">${starsHTML(rating)}</div>
            <span class="review-rating-badge">${ratingLabel}</span>
          </div>
        </div>
        <div class="review-body">
          ${review.title ? `<div class="review-title">${review.title}</div>` : ''}
          <p class="review-comment">${review.comment || 'No review text provided.'}</p>
        </div>
        <div class="review-footer">
          <span>By <strong>${review.name || 'Anonymous'}</strong></span>
          <span>${formatDate(review.createdAt || new Date().toISOString())}</span>
          <div class="review-helpful">
            <i class="bi bi-hand-thumbs-up"></i>
            <span>${Number(review.helpful) || 0} helpful</span>
          </div>
          <div class="review-badges">
            ${review.verified ? '<span class="review-badge">Verified</span>' : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function handleExport() {
  const payload = {
    generatedAt: new Date().toISOString(),
    reviews: allReviews
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'product-reviews.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function init() {
  loadProducts();
  allReviews = flattenReviews();
  buildProductFilter();
  renderReviews();
}

searchInput.addEventListener('input', renderReviews);
productFilter.addEventListener('change', renderReviews);
ratingFilter.addEventListener('change', renderReviews);
sortSelect.addEventListener('change', renderReviews);

if (exportBtn) exportBtn.addEventListener('click', handleExport);

init();
