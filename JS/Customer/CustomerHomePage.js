/**
 * script.js  –  DEALPORT main entry point
 * type="module" in index.html
 */

import { loadProductsFromFolder }                          from '../Core/FileStorage.js';
import { renderProductsByCategory, showSkeleton, showError } from './JS/Core/ProductRenderer.js';
import { getCurrentUser, logoutUser, getCartCount }        from '../Core/Auth.js';
import {
  getWishlist, addToWishlist, removeFromWishlist,
  toggleWishlist, isWishlisted, getWishlistCount,
} from './Wishlist.js';
import { addToCart } from './Cart.js';
import { getLS, setLS }  from '../Core/FileStorage.js';
import { KEY_LOCATION }  from '../Core/Constants.js';
import {
  getTestimonials, addTestimonial, hasUserTestimonial,
  starsHTML as reviewStarsHTML, formatDate,
} from './Reviews.js';

document.addEventListener('DOMContentLoaded', async () => {

  /* ══════════════════════════════════════════════════
     1. SWIPERS
  ══════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════
     2. NAVBAR – AUTH STATE
  ══════════════════════════════════════════════════ */
  const accountDropdown = document.getElementById('accountDropdownMenu');
  const accountLabel    = document.getElementById('accountNavLabel');

  function renderAccountMenu() {
    const user = getCurrentUser();
    if (!user) {
      accountLabel.textContent = 'Account';
      accountDropdown.innerHTML = `
        <li><h6 class="dropdown-header">Hello, Guest</h6></li>
        <li><a class="dropdown-item" href="login.html"><i class="bi bi-box-arrow-in-right me-2 text-success"></i>Login</a></li>
        <li><a class="dropdown-item" href="register.html"><i class="bi bi-person-plus me-2 text-success"></i>Register</a></li>`;
    } else {
      const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      accountLabel.textContent = user.name.split(' ')[0];
      accountDropdown.innerHTML = `
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
        <li><a class="dropdown-item" id="navWishlistLink" href="#"><i class="bi bi-heart me-2 text-danger"></i>Wishlist <span id="dropWishCount" class="badge bg-danger ms-1">0</span></a></li>
        <li><hr class="dropdown-divider my-1"></li>
        <li><a class="dropdown-item text-danger" id="navLogoutBtn" href="#"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>`;

      document.getElementById('navLogoutBtn')?.addEventListener('click', e => {
        e.preventDefault();
        logoutUser();
      });
      document.getElementById('navWishlistLink')?.addEventListener('click', e => {
        e.preventDefault();
        openWishlistDrawer();
      });
      updateDropWishCount();
    }
  }
  renderAccountMenu();

  function updateDropWishCount() {
    const el = document.getElementById('dropWishCount');
    if (el) el.textContent = getWishlistCount();
  }

  /* ══════════════════════════════════════════════════
     3. CART BADGE from auth helper
  ══════════════════════════════════════════════════ */
  const cartBadgeEl = document.getElementById('cartBadge');
  function refreshCartBadge() {
    const count = getCartCount();
    if (cartBadgeEl) cartBadgeEl.textContent = count;
  }
  refreshCartBadge();

  function bumpCart() {
    if (!cartBadgeEl) return;
    cartBadgeEl.textContent = (parseInt(cartBadgeEl.textContent) || 0) + 1;
    cartBadgeEl.style.transform = 'scale(1.5)';
    cartBadgeEl.style.transition = 'transform 0.2s';
    setTimeout(() => { cartBadgeEl.style.transform = ''; }, 300);
  }

  /* ══════════════════════════════════════════════════
     4. WISHLIST DRAWER
  ══════════════════════════════════════════════════ */
  const wishlistNavBtn  = document.getElementById('wishlistNavBtn');
  const wishlistDrawer  = document.getElementById('wishlistDrawer');
  const drawerBackdrop  = document.getElementById('drawerBackdrop');
  const closeWishBtn    = document.getElementById('closeWishlistDrawer');
  const drawerBody      = document.getElementById('wishlistDrawerBody');
  const wishNavBadge    = document.querySelector('.wishlist-nav-badge');

  function updateWishNavBadge() {
    const count = getWishlistCount();
    if (!wishNavBadge) return;
    wishNavBadge.textContent = count;
    wishNavBadge.classList.toggle('d-none', count === 0);
  }
  updateWishNavBadge();

  function openWishlistDrawer() {
    renderWishlistDrawer();
    wishlistDrawer.classList.add('open');
    drawerBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeWishlistDrawer() {
    wishlistDrawer.classList.remove('open');
    drawerBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  wishlistNavBtn?.addEventListener('click', openWishlistDrawer);
  closeWishBtn?.addEventListener('click', closeWishlistDrawer);
  drawerBackdrop?.addEventListener('click', closeWishlistDrawer);

  function renderWishlistDrawer() {
    const list = getWishlist();
    if (list.length === 0) {
      drawerBody.innerHTML = `
        <div class="drawer-empty">
          <i class="bi bi-heart fs-1 text-muted"></i>
          <p class="mt-3 text-muted">Your wishlist is empty.<br>Click ♡ on any product to save it.</p>
          <a href="#" class="btn btn-add-cart mt-2" style="width:auto;padding:8px 20px" onclick="closeDrawer()">Browse Products</a>
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
          <button class="drow-remove" data-id="${p.id}" title="Remove"><i class="bi bi-x-lg"></i></button>
        </div>`;
    }).join('');

    drawerBody.querySelectorAll('.drow-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromWishlist(btn.dataset.id);
        document.getElementById(`drow-${btn.dataset.id}`)?.remove();
        updateWishNavBadge();
        updateDropWishCount();
        // update heart icons on page
        syncHeartIcons();
        if (getWishlistCount() === 0) renderWishlistDrawer();
      });
    });
  }

  /* ══════════════════════════════════════════════════
     5. HEART ICON SYNC (persist wishlist state on page)
  ══════════════════════════════════════════════════ */
  function syncHeartIcons() {
    document.querySelectorAll('.btn-wishlist[data-id]').forEach(btn => {
      const icon = btn.querySelector('i');
      if (!icon) return;
      const wished = isWishlisted(btn.dataset.id);
      icon.className = wished ? 'bi bi-heart-fill' : 'bi bi-heart';
      btn.style.color = wished ? '#ef4444' : '';
    });
  }

  /* ══════════════════════════════════════════════════
     6. DELEGATED EVENTS – Cart & Wishlist
  ══════════════════════════════════════════════════ */
  document.body.addEventListener('click', e => {
    // Add to cart
    const cartBtn = e.target.closest('.btn-add-cart');
    if (cartBtn && !cartBtn.disabled) {
      const card = cartBtn.closest('.product-card');
      const product = {
        id:       cartBtn.dataset.id || card?.dataset.id || String(Date.now()),
        name:     cartBtn.dataset.name     || card?.querySelector('.product-name')?.textContent || 'Product',
        price:    parseFloat(cartBtn.dataset.price)    || parseFloat(card?.querySelector('.price-now')?.textContent?.replace('$','') || 0),
        oldPrice: cartBtn.dataset.oldPrice ? parseFloat(cartBtn.dataset.oldPrice) : null,
        category: cartBtn.dataset.category || card?.querySelector('.product-category')?.textContent || '',
        image:    cartBtn.dataset.image    || card?.querySelector('.product-img')?.src || '',
      };
      addToCart(product, 1);
      const original = cartBtn.innerHTML;
      cartBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Added!';
      cartBtn.style.background = '#16a34a';
      cartBtn.disabled = true;
      bumpCart();
      setTimeout(() => {
        cartBtn.innerHTML = original;
        cartBtn.style.background = '';
        cartBtn.disabled = false;
      }, 1800);
    }

    // Wishlist toggle — reads product data from card
    const wishBtn = e.target.closest('.btn-wishlist');
    if (wishBtn) {
      const card = wishBtn.closest('.product-card');
      const id       = card?.dataset.id  || wishBtn.dataset.id || String(Date.now());
      const name     = card?.querySelector('.product-name')?.textContent     || 'Product';
      const price    = card?.querySelector('.price-now')?.textContent?.replace('$','') || '0';
      const category = card?.querySelector('.product-category')?.textContent || '';
      const image    = card?.querySelector('.product-img')?.src               || '';

      const added = toggleWishlist({ id, name, price: parseFloat(price), category, image });
      const icon  = wishBtn.querySelector('i');
      if (icon) {
        icon.className = added ? 'bi bi-heart-fill' : 'bi bi-heart';
        wishBtn.style.color = added ? '#ef4444' : '';
      }
      updateWishNavBadge();
      updateDropWishCount();
    }
  });

  /* ══════════════════════════════════════════════════
     7. LOCATION POPUP (Leaflet + Geolocation API)
  ══════════════════════════════════════════════════ */
  const locationBtn      = document.getElementById('locationBtn');
  const locAddrText      = document.getElementById('locAddrText');
  const detectBtn        = document.getElementById('detectLocationBtn');
  const saveLocationBtn  = document.getElementById('saveLocationBtn');
  const manualInput      = document.getElementById('manualAddressInput');
  const detectedBox      = document.getElementById('detectedAddress');
  const detectedText     = document.getElementById('detectedAddressText');
  const mapPlaceholder   = document.getElementById('mapPlaceholder');
  const leafletMapDiv    = document.getElementById('leafletMap');

  let locationModal, leafletMap, leafletMarker;
  let pendingLocation = null;   // { lat, lng, address }

  // Restore saved location label
  const savedLoc = getLS(KEY_LOCATION);
  if (savedLoc?.address) {
    locAddrText.innerHTML = truncateAddr(savedLoc.address) + ' <i class="bi bi-chevron-down small"></i>';
  }

  function truncateAddr(addr) {
    return addr.length > 28 ? addr.slice(0, 28) + '…' : addr;
  }

  locationBtn?.addEventListener('click', () => {
    if (!locationModal) locationModal = new bootstrap.Modal(document.getElementById('locationModal'));
    locationModal.show();
  });

  detectBtn?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    detectBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Detecting…';
    detectBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        pendingLocation = { lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };

        // Show Leaflet map
        mapPlaceholder.style.display = 'none';
        leafletMapDiv.style.display  = 'block';

        if (!leafletMap) {
          leafletMap = L.map('leafletMap').setView([lat, lng], 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(leafletMap);
        } else {
          leafletMap.setView([lat, lng], 14);
        }

        if (leafletMarker) leafletMarker.remove();
        leafletMarker = L.marker([lat, lng]).addTo(leafletMap);
        // Invalidate size after display change
        setTimeout(() => leafletMap.invalidateSize(), 200);

        // Reverse geocode with Nominatim (free, no key needed)
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const data = await res.json();
          const addr = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          pendingLocation.address = addr;
          detectedText.textContent = addr;
          detectedBox.classList.remove('d-none');
          leafletMarker.bindPopup(addr).openPopup();
        } catch {
          detectedText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          detectedBox.classList.remove('d-none');
        }

        detectBtn.innerHTML = '<i class="bi bi-crosshair me-1"></i> Detected!';
        detectBtn.disabled = false;
      },
      err => {
        detectBtn.innerHTML = '<i class="bi bi-crosshair me-1"></i> Detect My Location';
        detectBtn.disabled  = false;
        alert('Could not detect location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  saveLocationBtn?.addEventListener('click', () => {
    const manual = manualInput?.value.trim();
    const loc = manual
      ? { address: manual }
      : pendingLocation;

    if (!loc) { alert('Please detect or type your location first.'); return; }

    setLS(KEY_LOCATION, loc);
    locAddrText.innerHTML = truncateAddr(loc.address) + ' <i class="bi bi-chevron-down small"></i>';
    locationModal?.hide();
  });

  /* ══════════════════════════════════════════════════
     8. STICKY NAVBAR SHADOW
  ══════════════════════════════════════════════════ */
  const navbar = document.querySelector('.navbar-top');
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.scrollY > 10
      ? '0 4px 20px rgba(0,0,0,0.10)' : 'none';
  });

  /* ══════════════════════════════════════════════════
     9. NEWSLETTER
  ══════════════════════════════════════════════════ */
  const newsletterBtn = document.querySelector('.btn-newsletter');
  newsletterBtn?.addEventListener('click', function () {
    const input = this.previousElementSibling;
    if (!input.value.trim()) {
      input.style.borderColor = '#ef4444';
      input.placeholder = 'Please enter your email';
      setTimeout(() => { input.style.borderColor = ''; input.placeholder = 'Enter your email address'; }, 2000);
      return;
    }
    this.closest('.newsletter-group').innerHTML =
      '<div class="d-flex align-items-center gap-2 px-3 py-2 text-success fw-bold">' +
      '<i class="bi bi-check-circle-fill"></i> You\'re subscribed!</div>';
  });

  /* ══════════════════════════════════════════════════
     10. SEARCH
  ══════════════════════════════════════════════════ */
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
        const ok    = (!query || name.includes(query)) && (category === 'All' || cat === category);
        col?.classList.toggle('d-none', !ok);
        if (ok) visible++;
      });
      section.style.display = visible === 0 && query ? 'none' : '';
    });

    const nr = document.getElementById('no-results-msg');
    const allHidden = [...document.querySelectorAll('.category-section')].every(s => s.style.display === 'none');
    if (nr) nr.style.display = allHidden && query ? 'block' : 'none';
  }

  searchBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
  searchCat?.addEventListener('change', doSearch);
  searchInput?.addEventListener('input', () => {
    if (!searchInput.value.trim()) {
      document.querySelectorAll('.category-section').forEach(s => {
        s.style.display = '';
        s.querySelectorAll('[class*="col-"]').forEach(c => c.classList.remove('d-none'));
      });
      const nr = document.getElementById('no-results-msg');
      if (nr) nr.style.display = 'none';
    }
  });

  /* ══════════════════════════════════════════════════
     11. SCROLL REVEAL
  ══════════════════════════════════════════════════ */
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
      '.testimonial-card:not([data-obs]), .explore-card:not([data-obs]), .promo-card:not([data-obs])'
    ).forEach(el => {
      el.dataset.obs = '1';
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(24px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.3s, border-color 0.3s';
      revealObs.observe(el);
    });
  }
  observeCards();

  /* ══════════════════════════════════════════════════
     12. LOAD & RENDER API PRODUCTS
  ══════════════════════════════════════════════════ */
  const dynContainer = document.getElementById('dynamic-categories');
  if (dynContainer) {
    showSkeleton(dynContainer);
    try {
      const products = await loadProductsFromFolder();
      if (!products || products.length === 0) {
        showError(dynContainer, 'The server returned an empty product list.');
      } else {
        renderProductsByCategory(products, dynContainer);
        observeCards();
        syncHeartIcons(); // mark already-wishlisted products
      }
    } catch (err) {
      showError(dynContainer, err.message);
    }
  }

  /* ══════════════════════════════════════════════════
     13. TESTIMONIALS – dynamic render + add form
  ══════════════════════════════════════════════════ */
  const testiGrid      = document.getElementById('testimonialsGrid');
  const testiLoggedIn  = document.getElementById('testiFormLoggedIn');
  const testiGuest     = document.getElementById('testiFormGuest');
  const starPicker     = document.getElementById('starPicker');
  const testiRatingIn  = document.getElementById('testiRating');
  const testiCommentIn = document.getElementById('testiComment');
  const testiError     = document.getElementById('testiError');
  const submitTestiBtn = document.getElementById('submitTestiBtn');

  function renderTestimonials() {
    if (!testiGrid) return;
    const list = getTestimonials();
    if (list.length === 0) {
      testiGrid.innerHTML = '<div class="col-12 text-center text-muted py-4">No reviews yet. Be the first!</div>';
      return;
    }
    testiGrid.innerHTML = list.map((t, i) => {
      const isFeatured = t.featured || i < 3;
      const stars = reviewStarsHTML(t.rating);
      const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      const avatarImg = t.avatar
        ? `<img src="${t.avatar}" alt="${t.name}" class="testi-avatar"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
           <div class="testi-avatar-fallback" style="display:none">${initials}</div>`
        : `<div class="testi-avatar-fallback">${initials}</div>`;
      return `
        <div class="col-md-6 col-lg-4">
          <div class="testimonial-card ${isFeatured ? 'featured-testimonial' : ''}">
            <div class="d-flex align-items-center gap-3 mb-3">
              <div class="testi-avatar-wrap">${avatarImg}</div>
              <div class="flex-grow-1">
                <h6 class="mb-0">${t.name}</h6>
                <div class="testi-stars-row">${stars}</div>
              </div>
              <i class="bi bi-quote testi-quote"></i>
            </div>
            <p class="testi-text">"${t.comment}"</p>
            <div class="testi-footer-row">
              ${isFeatured ? '<span class="testi-badge">Verified</span>' : ''}
              <span class="testi-date ms-auto">${formatDate(t.createdAt)}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }
  renderTestimonials();

  // Show form or guest prompt
  const loggedUser = getCurrentUser();
  if (loggedUser) {
    testiLoggedIn?.classList.remove('d-none');
    testiGuest?.classList.add('d-none');
    if (hasUserTestimonial(loggedUser.id) && testiLoggedIn) {
      testiLoggedIn.innerHTML = `
        <div class="testi-already-reviewed">
          <i class="bi bi-patch-check-fill text-success fs-2 mb-2 d-block"></i>
          <p class="fw-700 mb-1">Thanks for your review!</p>
          <p class="text-muted small">You've already shared your experience.</p>
        </div>`;
    }
  } else {
    testiLoggedIn?.classList.add('d-none');
    testiGuest?.classList.remove('d-none');
  }

  // Star picker
  let selectedRating = 0;
  starPicker?.querySelectorAll('.star-pick').forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = +star.dataset.val;
      starPicker.querySelectorAll('.star-pick').forEach((s, i) => {
        s.className = i < val ? 'bi bi-star-fill star-pick hovered' : 'bi bi-star star-pick';
      });
    });
    star.addEventListener('mouseleave', () => {
      starPicker.querySelectorAll('.star-pick').forEach((s, i) => {
        s.className = i < selectedRating ? 'bi bi-star-fill star-pick selected' : 'bi bi-star star-pick';
      });
    });
    star.addEventListener('click', () => {
      selectedRating = +star.dataset.val;
      if (testiRatingIn) testiRatingIn.value = selectedRating;
      starPicker.querySelectorAll('.star-pick').forEach((s, i) => {
        s.className = i < selectedRating ? 'bi bi-star-fill star-pick selected' : 'bi bi-star star-pick';
      });
    });
  });

  // Submit testimonial
  submitTestiBtn?.addEventListener('click', () => {
    if (testiError) testiError.classList.add('d-none');
    const rating  = parseInt(testiRatingIn?.value || 0);
    const comment = testiCommentIn?.value.trim();
    const user    = getCurrentUser();
    const showErr = msg => { if (testiError) { testiError.textContent = msg; testiError.classList.remove('d-none'); } };

    if (!user)           return showErr('You must be logged in.');
    if (rating < 1)      return showErr('Please select a star rating.');
    if (!comment || comment.length < 10) return showErr('Comment must be at least 10 characters.');

    addTestimonial({ userId: user.id, name: user.name, avatar: null, rating, comment });
    renderTestimonials();
    if (testiCommentIn) testiCommentIn.value = '';
    selectedRating = 0;
    if (testiRatingIn) testiRatingIn.value = 0;
    starPicker?.querySelectorAll('.star-pick').forEach(s => { s.className = 'bi bi-star star-pick'; });
    if (testiLoggedIn) testiLoggedIn.innerHTML = `
      <div class="testi-already-reviewed">
        <i class="bi bi-patch-check-fill text-success fs-2 mb-2 d-block"></i>
        <p class="fw-700 mb-1">Thanks for your review!</p>
        <p class="text-muted small">Your experience has been shared with the community.</p>
      </div>`;
  });

});
