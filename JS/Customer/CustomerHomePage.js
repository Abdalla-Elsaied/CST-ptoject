/**
 * CustomerHomePage.js
 * Feature 1 – Mobile dropdown: toggles on tap/click for small screens
 * Feature 2 – Role-based access: redirect admin away from this page
 */

import { loadProductsFromFolder }                              from '../Core/FileStorage.js';
import { renderProductsByCategory, showSkeleton, showError }   from './ProductRenderer.js';
import { getCurrentUser, logoutUser, getCartCount, ROLES }     from '../Core/Auth.js';
import {
  getWishlist, removeFromWishlist,
  toggleWishlist, isWishlisted, getWishlistCount,
} from './Wishlist.js';
import { addToCart, getCart }   from './Cart.js';
import { getLS, setLS }         from '../Core/Storage.js';
import { KEY_LOCATION }         from '../Core/Constants.js';
import {
  getTestimonials, addTestimonial, hasUserTestimonial,
  starsHTML as reviewStarsHTML, formatDate,
} from './Reviews.js';
import { seedTestimonials } from '../Core/SeedData.js';

document.addEventListener('DOMContentLoaded', async () => {

  /* ══════════════════════════════════════════════════
     FEATURE 2 – Role-based access control
     All roles (admin, seller, customer) can view the storefront.
     Admins access it via the "View Storefront" link in the admin panel.
  ══════════════════════════════════════════════════ */
  const currentUser = getCurrentUser();

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

  function escapeHTML(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])
    );
  }

  function renderAccountMenu() {
    const user = getCurrentUser();
    if (!user) {
      accountLabel.textContent = 'Account';
      accountDropdown.innerHTML = `
        <li><h6 class="dropdown-header">Hello, Guest</h6></li>
        <li><a class="dropdown-item" href="Login.html"><i class="bi bi-box-arrow-in-right me-2 text-success"></i>Login</a></li>
        <li><a class="dropdown-item" href="Register.html"><i class="bi bi-person-plus me-2 text-success"></i>Register</a></li>`;
      return;
    }

    // ── ADMIN: show read-only badge + back-to-panel link ──────────────────
    if (user.role === ROLES.ADMIN || user.role === 'admin') {
      const adminName = escapeHTML(user.name || 'Admin');
      const initial   = (user.name || 'A').charAt(0).toUpperCase();

      // Replace the dropdown button with a static admin badge row
      const dropdownWrapper = accountDropdown.closest('.dropdown');
      if (dropdownWrapper) {
        dropdownWrapper.outerHTML = `
          <div class="admin-storefront-badge d-none d-md-flex align-items-center gap-2" id="adminNavBadge">
            <div class="admin-nav-avatar">${initial}</div>
            <span class="admin-nav-name" title="Viewing as Admin — profile managed in Admin Panel">
              ${adminName}
            </span>
            <span class="admin-nav-pill">Admin</span>
            <a href="../Admin/admin-panel.html" class="admin-nav-back-btn">
              <i class="bi bi-arrow-left-circle me-1"></i>Admin Panel
            </a>
          </div>`;
      }

      // Hide customer-only nav items
      document.getElementById('wishlistNavBtn')?.style.setProperty('display', 'none');
      document.querySelector('a[href="Cart.html"]')?.style.setProperty('display', 'none');

      // Inject top banner
      if (!document.getElementById('adminViewBanner')) {
        const banner = document.createElement('div');
        banner.id = 'adminViewBanner';
        banner.innerHTML = `
          <i class="bi bi-eye me-1"></i>
          You are viewing the storefront as Admin — profile is managed in the Admin Panel.
          <a href="../Admin/admin-panel.html">← Back to Admin Panel</a>`;
        document.body.insertBefore(banner, document.body.firstChild);
      }
      return;
    }

    // ── Customer / Seller: normal dropdown ───────────────────────────────
    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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
  renderAccountMenu();

  function updateDropWishCount() {
    const el = document.getElementById('dropWishCount');
    if (el) el.textContent = getWishlistCount();
  }

  /* ══════════════════════════════════════════════════
     FEATURE 1 – Mobile dropdown fix
     Bootstrap's data-bs-toggle="dropdown" only works on
     elements that Bootstrap can bind to. On mobile (touch),
     the account button is hidden (d-none d-md-flex), so we
     wire a mobile menu button separately.
     We also ensure any dropdown opened via JS closes properly.
  ══════════════════════════════════════════════════ */
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');

  // Mobile hamburger → show a compact offcanvas-style dropdown below navbar
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', e => {
      e.stopPropagation();
      let mobileMenu = document.getElementById('mobileNavMenu');

      if (mobileMenu) {
        // toggle
        const isOpen = mobileMenu.classList.contains('mobile-nav-open');
        mobileMenu.classList.toggle('mobile-nav-open', !isOpen);
        mobileMenu.style.display = isOpen ? 'none' : 'block';
        return;
      }

      // Build menu once
      mobileMenu = document.createElement('div');
      mobileMenu.id = 'mobileNavMenu';
      mobileMenu.className = 'mobile-nav-menu mobile-nav-open';

      const user = getCurrentUser();
      if (!user) {
        mobileMenu.innerHTML = `
          <a class="mobile-nav-item" href="Login.html"><i class="bi bi-box-arrow-in-right me-2"></i>Login</a>
          <a class="mobile-nav-item" href="Register.html"><i class="bi bi-person-plus me-2"></i>Register</a>
          <a class="mobile-nav-item" href="Cart.html"><i class="bi bi-cart3 me-2"></i>Cart</a>`;
      } else if (user.role === ROLES.ADMIN || user.role === 'admin') {
        // Admin mobile menu — no customer actions
        const initial = (user.name || 'A').charAt(0).toUpperCase();
        mobileMenu.innerHTML = `
          <div class="mobile-nav-user">
            <div class="mobile-nav-avatar" style="background:linear-gradient(135deg,#f59e0b,#d97706)">${initial}</div>
            <div>
              <div class="mobile-nav-name">${escapeHTML(user.name || 'Admin')}</div>
              <div class="mobile-nav-email" style="color:#f59e0b;font-weight:600;font-size:11px">Administrator</div>
            </div>
          </div>
          <a class="mobile-nav-item" href="../Admin/admin-panel.html">
            <i class="bi bi-arrow-left-circle me-2 text-warning"></i>Back to Admin Panel
          </a>
          <hr class="my-1"/>
          <a class="mobile-nav-item text-danger" id="mobileLogoutBtn" href="#">
            <i class="bi bi-box-arrow-right me-2"></i>Logout
          </a>`;
      } else {
        const initials = user.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
        mobileMenu.innerHTML = `
          <div class="mobile-nav-user">
            <div class="mobile-nav-avatar">${initials}</div>
            <div>
              <div class="mobile-nav-name">${user.name}</div>
              <div class="mobile-nav-email">${user.email}</div>
            </div>
          </div>
          <a class="mobile-nav-item" href="profile.html"><i class="bi bi-person-circle me-2 text-success"></i>My Profile</a>
          <a class="mobile-nav-item" href="profile.html#orders"><i class="bi bi-bag-check me-2 text-success"></i>My Orders</a>
          <a class="mobile-nav-item" id="mobileWishlistLink" href="#"><i class="bi bi-heart me-2 text-danger"></i>Wishlist</a>
          <a class="mobile-nav-item" href="Cart.html"><i class="bi bi-cart3 me-2 text-success"></i>Cart</a>
          <hr class="my-1"/>
          <a class="mobile-nav-item text-danger" id="mobileLogoutBtn" href="#"><i class="bi bi-box-arrow-right me-2"></i>Logout</a>`;
      }

      // Insert below header
      document.querySelector('header.navbar-top').insertAdjacentElement('afterend', mobileMenu);

      document.getElementById('mobileLogoutBtn')?.addEventListener('click', e => {
        e.preventDefault(); logoutUser();
      });
      document.getElementById('mobileWishlistLink')?.addEventListener('click', e => {
        e.preventDefault();
        mobileMenu.style.display = 'none';
        mobileMenu.classList.remove('mobile-nav-open');
        openWishlistDrawer();
      });
    });

    // Close mobile menu when tapping outside
    document.addEventListener('click', e => {
      const menu = document.getElementById('mobileNavMenu');
      if (menu && !mobileMenuBtn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
        menu.classList.remove('mobile-nav-open');
      }
    });
  }

  // Ensure Bootstrap dropdowns work on touch devices
  // Bootstrap 5 handles this natively but we add a touch fallback just in case
  document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(trigger => {
    trigger.addEventListener('touchstart', function(e) {
      e.preventDefault(); // prevent double-fire on mobile
      const dropdownEl = bootstrap.Dropdown.getOrCreateInstance(this);
      dropdownEl.toggle();
    }, { passive: false });
  });

  /* ══════════════════════════════════════════════════
     3. CART BADGE
  ══════════════════════════════════════════════════ */
  const cartBadgeEl = document.getElementById('cartBadge');

  function refreshCartBadge() {
    if (cartBadgeEl) cartBadgeEl.textContent = getCartCount();
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
  const wishlistNavBtn = document.getElementById('wishlistNavBtn');
  const wishlistDrawer = document.getElementById('wishlistDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const closeWishBtn   = document.getElementById('closeWishlistDrawer');
  const drawerBody     = document.getElementById('wishlistDrawerBody');
  const wishNavBadge   = document.querySelector('.wishlist-nav-badge');

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

  function closeWishlistDrawer() {
    wishlistDrawer?.classList.remove('open');
    drawerBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
  }

  wishlistNavBtn?.addEventListener('click', openWishlistDrawer);
  closeWishBtn?.addEventListener('click', closeWishlistDrawer);
  drawerBackdrop?.addEventListener('click', closeWishlistDrawer);

  function renderWishlistDrawer() {
    if (!drawerBody) return;
    const list = getWishlist();

    if (list.length === 0) {
      drawerBody.innerHTML = `
        <div class="drawer-empty">
          <i class="bi bi-heart fs-1 text-muted"></i>
          <p class="mt-3 fw-700 text-muted">Your wishlist is empty.</p>
          <p class="text-muted small">Add your favorite products to the wishlist so you can buy them later.</p>
        </div>`;
      return;
    }

    drawerBody.innerHTML = list.map(p => {
      const img = p.image || `https://placehold.co/80x80/ecfdf5/16a34a?text=${encodeURIComponent(p.name)}`;
      return `
        <div class="drawer-product-row" id="drow-${p.id}">
          <a href="product-details.html?id=${p.id}" class="drow-link" title="View product">
            <img src="${img}" alt="${p.name}"
                 onerror="this.src='https://placehold.co/80x80/ecfdf5/16a34a?text=No+Image'"/>
          </a>
          <div class="drow-info">
            <a href="product-details.html?id=${p.id}" class="drow-name text-decoration-none text-dark">${p.name}</a>
            <div class="drow-cat">${p.category || ''}</div>
            <div class="drow-price">$${parseFloat(p.price || 0).toFixed(2)}</div>
          </div>
          <button class="drow-remove" data-id="${p.id}" title="Remove from wishlist">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>`;
    }).join('');

    drawerBody.querySelectorAll('.drow-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromWishlist(btn.dataset.id);
        document.getElementById(`drow-${btn.dataset.id}`)?.remove();
        updateWishNavBadge();
        updateDropWishCount();
        syncHeartIcons();
        if (getWishlistCount() === 0) renderWishlistDrawer();
      });
    });
  }

  /* ══════════════════════════════════════════════════
     5. HEART ICON SYNC
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
     6. DELEGATED EVENTS – Cart & Wishlist (stock validation)
  ══════════════════════════════════════════════════ */
  document.body.addEventListener('click', e => {
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

      const stockQtyForCart = stockQtyRaw !== '' ? parseInt(stockQtyRaw) : null;
      const product = {
        id:            productId,
        name:          cartBtn.dataset.name     || card?.querySelector('.product-name')?.textContent || 'Product',
        price:         parseFloat(cartBtn.dataset.price)    || 0,
        oldPrice:      cartBtn.dataset.oldPrice ? parseFloat(cartBtn.dataset.oldPrice) : null,
        category:      cartBtn.dataset.category || card?.querySelector('.product-category')?.textContent || '',
        image:         cartBtn.dataset.image    || card?.querySelector('.product-img')?.src || '',
        stockQuantity: stockQtyForCart,
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

    const wishBtn = e.target.closest('.btn-wishlist');
    if (wishBtn) {
      const card     = wishBtn.closest('.product-card');
      const id       = card?.dataset.id  || wishBtn.dataset.id || String(Date.now());
      const name     = card?.querySelector('.product-name')?.textContent     || 'Product';
      const price    = card?.querySelector('.price-now')?.textContent?.replace('$', '') || '0';
      const category = card?.querySelector('.product-category')?.textContent || '';
      const image    = card?.querySelector('.product-img')?.src               || '';
      const added    = toggleWishlist({ id, name, price: parseFloat(price), category, image });
      const icon     = wishBtn.querySelector('i');
      if (icon) {
        icon.className = added ? 'bi bi-heart-fill' : 'bi bi-heart';
        wishBtn.style.color = added ? '#ef4444' : '';
      }
      updateWishNavBadge();
      updateDropWishCount();
    }
  });

  /* ══════════════════════════════════════════════════
     7. LOCATION POPUP
  ══════════════════════════════════════════════════ */
  const locationBtn     = document.getElementById('locationBtn');
  const locAddrText     = document.getElementById('locAddrText');
  const detectBtn       = document.getElementById('detectLocationBtn');
  const saveLocationBtn = document.getElementById('saveLocationBtn');
  const manualInput     = document.getElementById('manualAddressInput');
  const detectedBox     = document.getElementById('detectedAddress');
  const detectedText    = document.getElementById('detectedAddressText');
  const mapPlaceholder  = document.getElementById('mapPlaceholder');
  const leafletMapDiv   = document.getElementById('leafletMap');

  let locationModal, leafletMap, leafletMarker, pendingLocation = null;

  const savedLoc = getLS(KEY_LOCATION);
  if (savedLoc?.address) {
    locAddrText.innerHTML = truncateAddr(savedLoc.address) + ' <i class="bi bi-chevron-down small"></i>';
  }
  function truncateAddr(addr) { return addr.length > 28 ? addr.slice(0, 28) + '…' : addr; }

  locationBtn?.addEventListener('click', () => {
    if (!locationModal) locationModal = new bootstrap.Modal(document.getElementById('locationModal'));
    locationModal.show();
  });

  detectBtn?.addEventListener('click', () => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    detectBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Detecting…';
    detectBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        pendingLocation = { lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
        mapPlaceholder.style.display = 'none';
        leafletMapDiv.style.display  = 'block';
        if (!leafletMap) {
          leafletMap = L.map('leafletMap').setView([lat, lng], 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(leafletMap);
        } else { leafletMap.setView([lat, lng], 14); }
        if (leafletMarker) leafletMarker.remove();
        leafletMarker = L.marker([lat, lng]).addTo(leafletMap);
        setTimeout(() => leafletMap.invalidateSize(), 200);
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
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
    const loc = manual ? { address: manual } : pendingLocation;
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
    navbar.style.boxShadow = window.scrollY > 10 ? '0 4px 20px rgba(0,0,0,0.10)' : 'none';
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
      '<div class="d-flex align-items-center gap-2 px-3 py-2 text-success fw-bold"><i class="bi bi-check-circle-fill"></i> You\'re subscribed!</div>';
  });

  /* ══════════════════════════════════════════════════
     10. SEARCH
  ══════════════════════════════════════════════════ */
  const searchInput = document.querySelector('.search-input');
  const searchBtn   = document.querySelector('.btn-search');
  const searchCat   = document.querySelector('.search-cat');

  function doSearch() {
    const query    = (searchInput?.value || '').trim().toLowerCase();
    const category = searchCat?.value || 'All';

    document.querySelectorAll('.category-section').forEach(section => {
      const sectionCategory = section.dataset.category || '';
      if (category !== 'All' && sectionCategory !== category) {
        section.style.display = 'none'; return;
      }
      if (query) {
        let visibleCount = 0;
        section.querySelectorAll('.product-card').forEach(card => {
          const name = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
          const col  = card.closest('[class*="col-"]');
          if (name.includes(query)) { col?.classList.remove('d-none'); visibleCount++; }
          else col?.classList.add('d-none');
        });
        section.style.display = visibleCount === 0 ? 'none' : '';
      } else {
        section.style.display = '';
        section.querySelectorAll('[class*="col-"].d-none').forEach(c => c.classList.remove('d-none'));
      }
    });

    const noResults = document.getElementById('no-results-msg');
    const allHidden = [...document.querySelectorAll('.category-section')].every(s => s.style.display === 'none');
    if (noResults) noResults.style.display = allHidden && (query || category !== 'All') ? 'block' : 'none';
  }

  searchBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
  searchCat?.addEventListener('change', doSearch);
  searchInput?.addEventListener('input', () => {
    if (!searchInput.value.trim()) {
      const cat = searchCat?.value || 'All';
      document.querySelectorAll('.category-section').forEach(s => {
        s.style.display = (cat === 'All' || s.dataset.category === cat) ? '' : 'none';
        if (s.style.display !== 'none') s.querySelectorAll('[class*="col-"].d-none').forEach(c => c.classList.remove('d-none'));
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
        syncHeartIcons();
      }
    } catch (err) {
      showError(dynContainer, err.message);
    }
  }

  /* ══════════════════════════════════════════════════
     13. TESTIMONIALS
  ══════════════════════════════════════════════════ */
  const testiGrid      = document.getElementById('testimonialsGrid');
  const testiLoggedIn  = document.getElementById('testiFormLoggedIn');
  const testiGuest     = document.getElementById('testiFormGuest');
  const starPicker     = document.getElementById('starPicker');
  const testiRatingIn  = document.getElementById('testiRating');
  const testiCommentIn = document.getElementById('testiComment');
  const testiError     = document.getElementById('testiError');
  const submitTestiBtn = document.getElementById('submitTestiBtn');

  // Seed default testimonials on first visit (no-op if already seeded)
  seedTestimonials();

  function renderTestimonials() {
    if (!testiGrid) return;
    const list = getTestimonials();
    if (list.length === 0) {
      testiGrid.innerHTML = '<div class="col-12 text-center text-muted py-4">No reviews yet. Be the first!</div>';
      return;
    }
    testiGrid.innerHTML = list.map((t, i) => {
      const isFeatured = t.featured || i < 3;
      const stars    = reviewStarsHTML(t.rating);
      const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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
              <div class="flex-grow-1"><h6 class="mb-0">${t.name}</h6><div class="testi-stars-row">${stars}</div></div>
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

  submitTestiBtn?.addEventListener('click', () => {
    if (testiError) testiError.classList.add('d-none');
    const rating  = parseInt(testiRatingIn?.value || 0);
    const comment = testiCommentIn?.value.trim();
    const user    = getCurrentUser();
    const showErr = msg => { if (testiError) { testiError.textContent = msg; testiError.classList.remove('d-none'); } };
    if (!user)                           return showErr('You must be logged in.');
    if (rating < 1)                      return showErr('Please select a star rating.');
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
