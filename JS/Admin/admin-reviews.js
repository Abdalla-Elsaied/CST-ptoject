/**
 * admin-reviews.js
 * Handles rendering and deletion of Home Testimonials and Product Reviews.
 * ✅ FIXED: Import conflicts and rating recalculation
 */

import { 
    getTestimonials, 
    deleteTestimonial, 
    deleteProductReview, 
    KEY_PRODUCT_REVIEWS, 
    starsHTML,
    formatDate as formatReviewDate
} from '../Customer/Reviews.js';
import { getLS, setLS } from '../Core/Storage.js';
import { showConfirm, showToast, formatDate, escapeHTML, getCustomerName } from './admin-helpers.js';

let currentTab = 'testimonials'; // 'testimonials' or 'product'
let tabsInitialized = false;

export function renderReviews() {
    if (!tabsInitialized) {
        initTabs();
        tabsInitialized = true;
    }

    if (currentTab === 'testimonials') {
        renderTestimonialsTable();
    } else {
        renderProductReviewsTable();
    }
}

function initTabs() {
    const tabTesti = document.getElementById('revTabTestimonials');
    const tabProduct = document.getElementById('revTabProduct');

    if (!tabTesti || !tabProduct) return;

    tabTesti.onclick = () => {
        currentTab = 'testimonials';
        tabTesti.classList.add('active');
        tabProduct.classList.remove('active');
        document.getElementById('testimonialsCard').style.display = 'block';
        document.getElementById('productReviewsCard').style.display = 'none';
        renderTestimonialsTable();
    };

    tabProduct.onclick = () => {
        currentTab = 'product';
        tabProduct.classList.add('active');
        tabTesti.classList.remove('active');
        document.getElementById('testimonialsCard').style.display = 'none';
        document.getElementById('productReviewsCard').style.display = 'block';
        renderProductReviewsTable();
    };
}

function renderTestimonialsTable() {
    const tbody = document.getElementById('testimonialsTableBody');
    if (!tbody) return;

    const list = getTestimonials(true); // true = get ALL for admin

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="bi bi-chat-quote fs-1 text-muted d-block mb-3"></i>
                    <strong>No Testimonials Yet</strong>
                    <p class="text-muted mb-0">Customer testimonials will appear here.</p>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = list.map(t => `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <img src="${t.avatar}" class="rounded-circle" width="32" height="32" 
                        onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}'">
                    <div>
                        <div class="fw-bold">${escapeHTML(t.name)}</div>
                        <div class="small text-muted">ID: ${t.userId}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="text-warning small">${starsHTML(t.rating)}</div>
            </td>
            <td>
                <div class="comment-text" style="max-width: 350px; font-size: 13px;">
                    ${escapeHTML(t.comment)}
                </div>
            </td>
            <td><small>${formatDate(t.createdAt)}</small></td>
            <td class="text-center">
                <button class="btn-action btn-delete btn-sm" 
                    onclick="handleDeleteTestimonial('${t.id}')" 
                    title="Delete testimonial">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function renderProductReviewsTable() {
    const tbody = document.getElementById('productReviewsTableBody');
    if (!tbody) return;

    const allProductReviews = getLS(KEY_PRODUCT_REVIEWS) || {};
    const flatList = [];

    // Flatten keys to show all reviews in one list
    for (const productId in allProductReviews) {
        allProductReviews[productId].forEach(rev => {
            flatList.push({ ...rev, productId });
        });
    }

    // Sort newest first
    flatList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (flatList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="bi bi-star fs-1 text-muted d-block mb-3"></i>
                    <strong>No Product Reviews Yet</strong>
                    <p class="text-muted mb-0">Product reviews will appear here.</p>
                </td>
            </tr>`;
        return;
    }

    const products = getLS('ls_products') || [];
    const getProdName = (id) => {
        const p = products.find(x => String(x.id) === String(id));
        return p ? p.name : `Product #${id}`;
    };

    tbody.innerHTML = flatList.map(r => `
        <tr>
            <td>
                <span class="badge bg-light text-dark border">
                    ${escapeHTML(getProdName(r.productId))}
                </span>
            </td>
            <td>
                <div class="fw-bold">${escapeHTML(r.name || getCustomerName(r.userId))}</div>
                <div class="small text-muted">ID: ${r.userId}</div>
            </td>
            <td>
                <div class="text-warning small">${starsHTML(r.rating)}</div>
            </td>
            <td>
                <div class="comment-text" style="max-width: 350px; font-size: 13px;">
                    ${r.title ? `<strong class="d-block mb-1 text-dark">${escapeHTML(r.title)}</strong>` : ''}
                    ${escapeHTML(r.comment)}
                </div>
            </td>
            <td><small>${formatDate(r.createdAt)}</small></td>
            <td class="text-center">
                <button class="btn-action btn-delete btn-sm" 
                    onclick="handleDeleteProductReview('${r.productId}', '${r.id}')" 
                    title="Delete review">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

// ✅ FIX: Global handlers with proper error handling
window.handleDeleteTestimonial = (id) => {
    showConfirm('Delete this testimonial? It will be removed from the storefront.', () => {
        try {
            deleteTestimonial(id);
            showToast('Testimonial deleted successfully', 'success');
            renderTestimonialsTable();
        } catch (err) {
            console.error('[REVIEWS] Error deleting testimonial:', err);
            showToast('Error deleting testimonial', 'error');
        }
    });
};

window.handleDeleteProductReview = (prodId, revId) => {
    showConfirm('Delete this product review? This action cannot be undone.', () => {
        try {
            deleteProductReview(prodId, revId);
            
            // ✅ MAJOR: Recalculate product rating after review deletion
            recalculateProductRating(prodId);
            
            showToast('Review deleted successfully', 'success');
            renderProductReviewsTable();
        } catch (err) {
            console.error('[REVIEWS] Error deleting review:', err);
            showToast('Error deleting review', 'error');
        }
    });
};

/**
 * Recalculates a product's average rating after a review is deleted.
 * Updates the product's rating field in localStorage.
 * @param {string|number} productId - The product ID
 */
function recalculateProductRating(productId) {
    try {
        const allProductReviews = getLS(KEY_PRODUCT_REVIEWS) || {};
        const reviews = allProductReviews[productId] || [];
        
        const products = getLS('ls_products') || [];
        const productIndex = products.findIndex(p => String(p.id) === String(productId));
        
        if (productIndex === -1) return;
        
        if (reviews.length === 0) {
            // No reviews left - reset rating
            products[productIndex].rating = 0;
            products[productIndex].reviewCount = 0;
            console.log(`[RATING] Product ${productId} rating reset (no reviews)`);
        } else {
            // Calculate new average
            const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
            const avgRating = totalRating / reviews.length;
            products[productIndex].rating = Math.round(avgRating * 10) / 10; // Round to 1 decimal
            products[productIndex].reviewCount = reviews.length;
            console.log(`[RATING] Product ${productId} rating updated to ${products[productIndex].rating} (${reviews.length} reviews)`);
        }
        
        setLS('ls_products', products);
    } catch (err) {
        console.error('[RATING] Error recalculating rating:', err);
    }
}
