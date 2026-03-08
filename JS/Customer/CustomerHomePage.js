/**
 * script.js  –  DEALPORT main entry point
 * Uses ES modules; index.html must load this with type="module"
 */

import { loadProductsFromFolder } from './JS/Core/FileStorage.js';
import { renderProductsByCategory, showSkeleton, showError } from './JS/Core/ProductRenderer.js';

document.addEventListener('DOMContentLoaded', async () => {

  /* ── Swipers ─────────────────────────────────────── */
  new Swiper('.hero-swiper', {
    loop: true,
    autoplay: { delay: 5000, disableOnInteraction: false },
    speed: 700,
    effect: 'fade',
    fadeEffect: { crossFade: true },
    navigation: { prevEl: '.hero-prev', nextEl: '.hero-next' },
    pagination: { el: '.hero-pagination', clickable: true },
  });

  new Swiper('.best-swiper', {
    slidesPerView: 1.2,
    spaceBetween: 16,
    loop: true,
    navigation: { prevEl: '.best-prev', nextEl: '.best-next' },
    breakpoints: {
      480:  { slidesPerView: 2,   spaceBetween: 14 },
      768:  { slidesPerView: 3,   spaceBetween: 16 },
      1024: { slidesPerView: 4,   spaceBetween: 16 },
    },
  });

  /* ── Sticky navbar shadow ────────────────────────── */
  const navbar = document.querySelector('.navbar-top');
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.scrollY > 10
      ? '0 4px 20px rgba(0,0,0,0.10)'
      : 'none';
  });

  /* ── Newsletter ──────────────────────────────────── */
  const newsletterBtn = document.querySelector('.btn-newsletter');
  if (newsletterBtn) {
    newsletterBtn.addEventListener('click', function () {
      const input = this.previousElementSibling;
      if (!input.value.trim()) {
        input.style.borderColor = '#ef4444';
        input.placeholder = 'Please enter your email';
        setTimeout(() => {
          input.style.borderColor = '';
          input.placeholder = 'Enter your email address';
        }, 2000);
        return;
      }
      this.closest('.newsletter-group').innerHTML =
        '<div class="d-flex align-items-center gap-2 px-3 py-2 text-success fw-bold">' +
        '<i class="bi bi-check-circle-fill"></i> You\'re subscribed!</div>';
    });
  }

  /* ── Search / filter ─────────────────────────────── */
  const searchInput = document.querySelector('.search-input');
  const searchBtn   = document.querySelector('.btn-search');
  const searchCat   = document.querySelector('.search-cat');

  function doSearch() {
    const query    = searchInput?.value.trim().toLowerCase() || '';
    const category = searchCat?.value || 'All';

    document.querySelectorAll('.category-section').forEach(section => {
      let visible = 0;

      section.querySelectorAll('.product-card').forEach(card => {
        const name  = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
        const cat   = card.querySelector('.product-category')?.textContent || '';
        const col   = card.closest('[class*="col-"]');
        const matchQ = !query    || name.includes(query);
        const matchC = category === 'All' || cat === category;

        if (matchQ && matchC) {
          col?.classList.remove('d-none');
          visible++;
        } else {
          col?.classList.add('d-none');
        }
      });

      section.style.display = visible === 0 && query ? 'none' : '';
    });

    const noResults = document.getElementById('no-results-msg');
    const allHidden = [...document.querySelectorAll('.category-section')]
      .every(s => s.style.display === 'none');
    if (noResults) noResults.style.display = allHidden && query ? 'block' : 'none';
  }

  searchBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
  searchCat?.addEventListener('change', doSearch);
  searchInput?.addEventListener('input', () => {
    if (!searchInput.value.trim()) {
      document.querySelectorAll('.col-6.d-none, .col-md-4.d-none, .col-lg-3.d-none')
        .forEach(el => el.classList.remove('d-none'));
      document.querySelectorAll('.category-section').forEach(s => s.style.display = '');
      const nr = document.getElementById('no-results-msg');
      if (nr) nr.style.display = 'none';
    }
  });

  /* ── Cart badge helper ───────────────────────────── */
  function bumpCart() {
    const badge = document.querySelector('.cart-badge');
    if (!badge) return;
    badge.textContent = (parseInt(badge.textContent) || 0) + 1;
    badge.style.transform = 'scale(1.5)';
    badge.style.transition = 'transform 0.2s';
    setTimeout(() => { badge.style.transform = ''; }, 300);
  }

  /* ── Add-to-cart animation (delegated) ───────────── */
  function handleCartClick(btn) {
    if (!btn || btn.disabled) return;
    const original = btn.innerHTML;
    btn.innerHTML  = '<i class="bi bi-check-lg me-1"></i>Added!';
    btn.style.background = '#16a34a';
    btn.disabled   = true;
    bumpCart();
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.disabled  = false;
    }, 1800);
  }

  /* ── Wishlist toggle (delegated) ─────────────────── */
  function handleWishlistClick(btn) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (!icon) return;
    const isFilled = icon.classList.contains('bi-heart-fill');
    icon.classList.toggle('bi-heart',      isFilled);
    icon.classList.toggle('bi-heart-fill', !isFilled);
    btn.style.color = isFilled ? '' : '#ef4444';
  }

  document.body.addEventListener('click', e => {
    const cartBtn    = e.target.closest('.btn-add-cart');
    const wishBtn    = e.target.closest('.btn-wishlist');
    if (cartBtn)  handleCartClick(cartBtn);
    if (wishBtn)  handleWishlistClick(wishBtn);
  });

  /* ── Intersection Observer – scroll reveal ───────── */
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.style.opacity   = '1';
      entry.target.style.transform = 'translateY(0)';
      revealObs.unobserve(entry.target);
    });
  }, { threshold: 0.08 });

  function observeCards() {
    document.querySelectorAll(
      '.product-card:not([data-obs]), .feat-card:not([data-obs]), ' +
      '.testimonial-card:not([data-obs]), .explore-card:not([data-obs]), ' +
      '.promo-card:not([data-obs])'
    ).forEach(el => {
      el.dataset.obs  = '1';
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(24px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.3s, border-color 0.3s';
      revealObs.observe(el);
    });
  }
  observeCards();   // static cards

  /* ── Load & render API products ─────────────────── */
  const dynContainer = document.getElementById('dynamic-categories');
  if (dynContainer) {
    showSkeleton(dynContainer);
    try {
      const products = await loadProductsFromFolder();
      console.log(products)
      if (!products || products.length === 0) {
        showError(dynContainer, 'The server returned an empty product list.');
      } else {
        renderProductsByCategory(products, dynContainer);
        observeCards();   // newly rendered cards
      }
    } catch (err) {
      showError(dynContainer, err.message);
    }
  }

});
