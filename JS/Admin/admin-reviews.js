/**
 * admin-reviews.js
 * Admin view for Home Testimonials and Product Reviews.
 * Features: view all, delete, toggle featured (testimonials), search/filter.
 */

import { getLS, setLS } from '../Core/Storage.js';
import { showConfirm, showToast, escapeHTML, getCustomerName } from './admin-helpers.js';
import { seedTestimonials } from '../Core/SeedData.js';

const KEY_TESTIMONIALS    = 'ls_testimonials';
const KEY_PRODUCT_REVIEWS = 'ls_productReviews';

let currentTab = 'testimonials';

// ─── HELPERS ─────────────────────────────────────────────────

function starsHTML(rating) {
    const n = Math.round(Number(rating) || 0);
    return `<span style="color:#f59e0b;letter-spacing:2px;">${'★'.repeat(Math.min(n,5))}${'☆'.repeat(Math.max(0,5-n))}</span>`;
}

function deleteTestimonial(id) {
    const list = getLS(KEY_TESTIMONIALS) || [];
    setLS(KEY_TESTIMONIALS, list.filter(t => String(t.id) !== String(id)));
}

function toggleFeatured(id) {
    const list = getLS(KEY_TESTIMONIALS) || [];
    const idx  = list.findIndex(t => String(t.id) === String(id));
    if (idx === -1) return;
    list[idx].featured = !list[idx].featured;
    setLS(KEY_TESTIMONIALS, list);
}

function deleteProductReview(productId, reviewId) {
    const all = getLS(KEY_PRODUCT_REVIEWS) || {};
    if (!all[productId]) return;
    all[productId] = all[productId].filter(r => String(r.id) !== String(reviewId));
    setLS(KEY_PRODUCT_REVIEWS, all);
}

function recalculateProductRating(productId) {
    try {
        const all      = getLS(KEY_PRODUCT_REVIEWS) || {};
        const reviews  = all[productId] || [];
        const products = getLS('ls_products') || [];
        const idx      = products.findIndex(p => String(p.id) === String(productId));
        if (idx === -1) return;
        if (reviews.length === 0) {
            products[idx].rating      = 0;
            products[idx].reviewCount = 0;
        } else {
            const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
            products[idx].rating      = Math.round(avg * 10) / 10;
            products[idx].reviewCount = reviews.length;
        }
        setLS('ls_products', products);
    } catch (e) {
        console.error('[RATING]', e);
    }
}

// ─── MAIN ENTRY ──────────────────────────────────────────────

export function renderReviews() {
    seedTestimonials(); // ensure seed data exists on first admin visit
    initTabs();
    if (currentTab === 'testimonials') renderTestimonialsTable();
    else renderProductReviewsTable();
}

function initTabs() {
    const t1 = document.getElementById('revTabTestimonials');
    const t2 = document.getElementById('revTabProduct');
    if (!t1 || !t2) return;

    const n1 = t1.cloneNode(true);
    const n2 = t2.cloneNode(true);
    t1.replaceWith(n1);
    t2.replaceWith(n2);

    n1.onclick = () => {
        currentTab = 'testimonials';
        n1.classList.add('active');    n2.classList.remove('active');
        document.getElementById('testimonialsCard').style.display    = 'block';
        document.getElementById('productReviewsCard').style.display  = 'none';
        renderTestimonialsTable();
    };
    n2.onclick = () => {
        currentTab = 'product';
        n2.classList.add('active');    n1.classList.remove('active');
        document.getElementById('testimonialsCard').style.display    = 'none';
        document.getElementById('productReviewsCard').style.display  = 'block';
        renderProductReviewsTable();
    };
}

// ─── TESTIMONIALS ────────────────────────────────────────────

function renderTestimonialsTable(filter = '') {
    const tbody = document.getElementById('testimonialsTableBody');
    if (!tbody) return;

    let list = (getLS(KEY_TESTIMONIALS) || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filter) {
        const q = filter.toLowerCase();
        list = list.filter(t =>
            (t.name    || '').toLowerCase().includes(q) ||
            (t.comment || '').toLowerCase().includes(q)
        );
    }

    // Inject/update search bar
    injectSearchBar('testimonialsCard', 'testiSearch', 'Search by name or comment…', val => renderTestimonialsTable(val));

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="empty-state">
                <div class="empty-content py-5">
                    <i class="bi bi-chat-quote fs-1 text-muted d-block mb-3"></i>
                    <strong>No testimonials found</strong>
                    <p class="text-muted mb-0">Customer testimonials appear here once submitted on the homepage.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(t => {
        const name    = escapeHTML(t.name || 'User');
        const rating  = Math.min(5, Math.max(0, Math.round(Number(t.rating) || 0)));
        const dateStr = t.createdAt
            ? new Date(t.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : '—';
        const featuredBadge = t.featured
            ? `<span class="rev-badge rev-featured">⭐ Featured</span>`
            : `<span class="rev-badge rev-plain">—</span>`;
        const featuredTitle = t.featured ? 'Remove from featured' : 'Mark as featured';
        const featuredIcon  = t.featured ? 'bi-star-fill' : 'bi-star';

        return `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <img src="${escapeHTML(t.avatar || '')}"
                         style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;"
                         onerror="this.outerHTML='<span class=\\'table-avatar\\'>${name.charAt(0)}</span>'"
                         alt="${name}">
                    <div>
                        <div class="fw-semibold" style="font-size:13px;">${name}</div>
                        ${t.userId ? `<div style="font-size:11px;color:var(--text-muted);">ID: ${t.userId}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>${starsHTML(rating)}<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${rating}/5</div></td>
            <td>
                <div title="${escapeHTML(t.comment)}" style="max-width:320px;font-size:12px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                    ${escapeHTML(t.comment)}
                </div>
            </td>
            <td>${featuredBadge}</td>
            <td><small style="color:var(--text-muted);">${dateStr}</small></td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn-action" onclick="handleToggleFeatured('${t.id}')" title="${featuredTitle}" style="color:#f59e0b;">
                        <i class="bi ${featuredIcon}"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="handleDeleteTestimonial('${t.id}')" title="Delete testimonial">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ─── PRODUCT REVIEWS ─────────────────────────────────────────

function renderProductReviewsTable(filter = '') {
    const tbody = document.getElementById('productReviewsTableBody');
    if (!tbody) return;

    const allReviews = getLS(KEY_PRODUCT_REVIEWS) || {};
    let flatList = [];
    for (const productId in allReviews) {
        allReviews[productId].forEach(rev => flatList.push({ ...rev, productId }));
    }
    flatList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const products   = getLS('ls_products') || [];
    const getProdName = id => (products.find(x => String(x.id) === String(id)) || {}).name || `Product #${id}`;

    if (filter) {
        const q = filter.toLowerCase();
        flatList = flatList.filter(r =>
            getProdName(r.productId).toLowerCase().includes(q) ||
            (r.name    || '').toLowerCase().includes(q) ||
            (r.comment || '').toLowerCase().includes(q) ||
            (r.title   || '').toLowerCase().includes(q)
        );
    }

    // Inject/update search bar
    injectSearchBar('productReviewsCard', 'prodRevSearch', 'Search by product, reviewer, or comment…', val => renderProductReviewsTable(val));

    if (flatList.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="empty-state">
                <div class="empty-content py-5">
                    <i class="bi bi-star fs-1 text-muted d-block mb-3"></i>
                    <strong>No product reviews found</strong>
                    <p class="text-muted mb-0">Product reviews appear here once customers review products.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = flatList.map(r => {
        const rating   = Math.min(5, Math.max(0, Math.round(Number(r.rating) || 0)));
        const dateStr  = r.createdAt
            ? new Date(r.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : '—';
        const reviewer = escapeHTML(r.name || getCustomerName(r.userId) || '—');
        const prodName = escapeHTML(getProdName(r.productId));

        return `
        <tr>
            <td>
                <span class="rev-prod-badge" title="${prodName}">${prodName}</span>
            </td>
            <td>
                <div class="fw-semibold" style="font-size:13px;">${reviewer}</div>
                ${r.userId ? `<div style="font-size:11px;color:var(--text-muted);">ID: ${r.userId}</div>` : ''}
            </td>
            <td>${starsHTML(rating)}<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${rating}/5</div></td>
            <td style="max-width:280px;">
                ${r.title ? `<div style="font-weight:600;font-size:12px;margin-bottom:3px;">${escapeHTML(r.title)}</div>` : ''}
                <div style="font-size:12px;color:var(--text-secondary);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;" title="${escapeHTML(r.comment)}">
                    ${escapeHTML(r.comment)}
                </div>
                ${r.helpful ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px;"><i class="bi bi-hand-thumbs-up"></i> ${r.helpful} helpful</div>` : ''}
            </td>
            <td><small style="color:var(--text-muted);">${dateStr}</small></td>
            <td class="text-center">
                <button class="btn-action btn-delete" onclick="handleDeleteProductReview('${r.productId}','${r.id}')" title="Delete review">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ─── SEARCH BAR INJECTION ────────────────────────────────────

function injectSearchBar(cardId, inputId, placeholder, onInput) {
    const card = document.getElementById(cardId);
    if (!card) return;

    // Only inject once
    if (card.querySelector(`#${inputId}`)) return;

    const bar = document.createElement('div');
    bar.className = 'rev-search-bar';
    bar.innerHTML = `
        <div style="position:relative;max-width:360px;">
            <i class="bi bi-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;pointer-events:none;"></i>
            <input id="${inputId}" type="text" class="filter-input" placeholder="${placeholder}"
                   style="padding-left:32px;width:100%;">
        </div>`;
    card.insertBefore(bar, card.firstChild);

    card.querySelector(`#${inputId}`).addEventListener('input', e => onInput(e.target.value.trim()));
}

// ─── GLOBAL HANDLERS ─────────────────────────────────────────

window.handleDeleteTestimonial = (id) => {
    showConfirm('Delete this testimonial? It will be removed from the storefront.', () => {
        deleteTestimonial(id);
        showToast('Testimonial deleted', 'success');
        renderTestimonialsTable(document.getElementById('testiSearch')?.value.trim() || '');
    });
};

window.handleToggleFeatured = (id) => {
    const list = getLS(KEY_TESTIMONIALS) || [];
    const t    = list.find(x => String(x.id) === String(id));
    if (!t) return;
    const action = t.featured ? 'Remove from featured?' : 'Mark as featured on homepage?';
    showConfirm(action, () => {
        toggleFeatured(id);
        showToast(t.featured ? 'Removed from featured' : 'Marked as featured', 'success');
        renderTestimonialsTable(document.getElementById('testiSearch')?.value.trim() || '');
    });
};

window.handleDeleteProductReview = (prodId, revId) => {
    showConfirm('Delete this product review? This cannot be undone.', () => {
        deleteProductReview(prodId, revId);
        recalculateProductRating(prodId);
        showToast('Review deleted', 'success');
        renderProductReviewsTable(document.getElementById('prodRevSearch')?.value.trim() || '');
    });
};
