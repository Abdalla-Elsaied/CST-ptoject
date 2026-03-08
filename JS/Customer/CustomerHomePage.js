/* =====================================================
   DEALPORT – script.js
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Hero Swiper ───────────────────────────────────
  new Swiper('.hero-swiper', {
    loop: true,
    autoplay: { delay: 5000, disableOnInteraction: false },
    speed: 700,
    effect: 'fade',
    fadeEffect: { crossFade: true },
    navigation: {
      prevEl: '.hero-prev',
      nextEl: '.hero-next',
    },
    pagination: {
      el: '.hero-pagination',
      clickable: true,
    },
  });

  // ─── Best Selling Swiper ───────────────────────────
  new Swiper('.best-swiper', {
    slidesPerView: 1.2,
    spaceBetween: 16,
    loop: true,
    navigation: {
      prevEl: '.best-prev',
      nextEl: '.best-next',
    },
    breakpoints: {
      480:  { slidesPerView: 2, spaceBetween: 14 },
      768:  { slidesPerView: 3, spaceBetween: 16 },
      1024: { slidesPerView: 4, spaceBetween: 16 },
    },
  });

  // ─── Deals Swiper ──────────────────────────────────
  new Swiper('.deals-swiper', {
    slidesPerView: 1.2,
    spaceBetween: 16,
    loop: true,
    navigation: {
      prevEl: '.deals-prev',
      nextEl: '.deals-next',
    },
    breakpoints: {
      480:  { slidesPerView: 2,   spaceBetween: 14 },
      768:  { slidesPerView: 3,   spaceBetween: 16 },
      1024: { slidesPerView: 4.5, spaceBetween: 16 },
    },
  });

  // ─── Add to Cart Interaction ───────────────────────
  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', function () {
      const original = this.innerHTML;
      this.innerHTML = '<i class="bi bi-check-lg me-1"></i>Added!';
      this.style.background = '#16a34a';
      this.disabled = true;
      setTimeout(() => {
        this.innerHTML = original;
        this.style.background = '';
        this.disabled = false;
      }, 1800);

      // Bump cart badge
      const badge = document.querySelector('.cart-badge');
      if (badge) {
        const count = parseInt(badge.textContent) || 0;
        badge.textContent = count + 1;
        badge.style.transform = 'scale(1.4)';
        setTimeout(() => { badge.style.transform = ''; }, 300);
      }
    });
  });

  // ─── Wishlist Toggle ───────────────────────────────
  document.querySelectorAll('.btn-wishlist').forEach(btn => {
    btn.addEventListener('click', function () {
      const icon = this.querySelector('i');
      if (icon.classList.contains('bi-heart')) {
        icon.classList.replace('bi-heart', 'bi-heart-fill');
        this.style.color = '#ef4444';
      } else {
        icon.classList.replace('bi-heart-fill', 'bi-heart');
        this.style.color = '';
      }
    });
  });

  // ─── Sticky Navbar Shadow ─────────────────────────
  const navbar = document.querySelector('.navbar-top');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
    } else {
      navbar.style.boxShadow = 'none';
    }
  });

  // ─── Newsletter Subscribe ─────────────────────────
  const newsletterBtn = document.querySelector('.btn-newsletter');
  if (newsletterBtn) {
    newsletterBtn.addEventListener('click', function () {
      const input = this.previousElementSibling;
      if (!input.value.trim()) {
        input.style.borderColor = '#ef4444';
        input.placeholder = 'Please enter your email';
        setTimeout(() => { input.style.borderColor = ''; input.placeholder = 'Enter your email address'; }, 2000);
        return;
      }
      const wrap = this.closest('.newsletter-group');
      wrap.innerHTML = '<div class="d-flex align-items-center gap-2 px-3 py-2 text-success fw-bold"><i class="bi bi-check-circle-fill"></i> You\'re subscribed!</div>';
    });
  }

  // ─── Explore Cards Hover Glow ─────────────────────
  document.querySelectorAll('.explore-card').forEach(card => {
    card.addEventListener('click', function () {
      this.querySelector('.explore-icon').style.outline = '3px solid #22c55e';
      setTimeout(() => {
        this.querySelector('.explore-icon').style.outline = '';
      }, 600);
    });
  });

  // ─── Intersection Observer - Reveal Animations ────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.product-card, .feat-card, .testimonial-card, .explore-card, .promo-card').forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.3s, border-color 0.3s';
    observer.observe(el);
  });

  // ─── Search Suggestions (simple demo) ────────────
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        this.blur();
      }
    });
  }

});
