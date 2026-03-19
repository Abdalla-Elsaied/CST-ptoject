# DEALPORT — Multi-Actor E-Commerce Marketplace

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)
![jQuery](https://img.shields.io/badge/jQuery-3.7-0769AD?style=for-the-badge&logo=jquery&logoColor=white)

A frontend-only multi-role e-commerce platform project built for the **Information Technology Institute (ITI)**.  
Supports three distinct user roles — Customer, Seller, and Admin — each with a fully dedicated interface.

[Live Demo](https://cst-ptoject.vercel.app/Html/Customer/Login.html) · [Documentation](./CST-Team1-Technical-Documentation.docx) · [Report a Bug](https://github.com/Abdalla-Elsaied/CST-ptoject/issues)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Default Credentials](#default-credentials)
- [Architecture](#architecture)
- [Roles & Permissions](#roles--permissions)
- [Team](#team)

---

## Overview

DEALPORT is a fully client-side e-commerce web application with **no traditional backend**. All data persistence is handled through:

- **MockAPI** — remote storage for users and products
- **Browser localStorage** — cart, orders, wishlist, categories, seller requests
- **Cloudinary** — image hosting for products and profile photos

The platform supports a complete marketplace lifecycle: customers browse and purchase, sellers manage their store and inventory, and admins oversee the entire platform.

---

## Features

### 👤 Customer
- Browse products grouped by category loaded from MockAPI
- Search and filter by name and category in real time
- Grid/list view toggle with sort and load-more pagination per category page
- Product detail page with image gallery, color swatches, stock validation, and related products
- Shopping cart with quantity controls, promo codes, and a 3-step checkout modal (address → payment → confirmation)
- Payment methods: Cash on Delivery, Credit/Debit Card (with full validation), InstaPay
- Stock decremented on MockAPI after each successful order
- Wishlist with persistent drawer and badge
- Order history with cancel (pending) and delete (delivered) actions
- Order detail page with progress tracker (Pending → Shipped → Delivered)
- Per-product reviews with star ratings and "Helpful" voting
- Site-wide testimonials with one review per user
- Delivery location detection via browser Geolocation + Leaflet.js map + Nominatim reverse geocoding
- Profile page: edit name/phone/city/bio, change password with strength meter, wishlist grid, order history
- **Profile photo upload** to Cloudinary — appears in navbar, profile sidebar, and admin tables
- Apply to become a seller via inline modal on the homepage (no page navigation required)
- Seller application status notifications (pending / approved / rejected) shown as a dismissable banner

### 🏪 Seller
- Dashboard with weekly sales chart, order status bar chart, best-selling products table, and category breakdown
- Real seller info (store name, email, profile photo) displayed in sidebar and topbar
- Product CRUD: add, edit, delete products with Cloudinary image uploads
- Stock status filtering: In Stock / Low Stock / Out of Stock
- Order management with status and payment updates; handles mixed orders across multiple sellers
- Category suggestions (submitted as "draft" pending admin approval)
- Customer list showing users who ordered the seller's products
- Product reviews viewer
- Dark/light theme toggle persisted across sessions

### 🔐 Admin
- Single-page admin panel with sidebar-driven section switching
- Platform metrics overview: total sellers, customers, products, revenue
- User management: view, ban/unban, reset password, delete — for all roles
- Seller management: suspend/unsuspend, approve/reject seller upgrade requests
- **Email fallback** for seller approval: resolves user by email if MockAPI ID has changed
- Full product moderation across all sellers
- Category management: approve/reject seller suggestions, create, hide, delete
- Order management: view all orders, update status, delete
- Analytics section with Chart.js charts
- **Admin profile photo upload** — persists to MockAPI and updates topbar + sidebar instantly
- Admin profile: edit full name, change password, recent activity log

### 🛡️ Security & Navigation
- Role-based route guard (`requireRole()`) on every protected page
- Live ban/suspend detection on every page load
- `preventBackNavigation()` — blocks browser back/forward after logout
- `watchSessionChange()` — detects new login via direct URL and redirects immediately
- All redirects use `window.location.replace()` to clear browser history

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 + Bootstrap 5.3 |
| Logic | Vanilla JavaScript (ES Modules) + jQuery 3.7 |
| Remote Data (Users) | [MockAPI](https://mockapi.io) — `/users` |
| Remote Data (Products) | [MockAPI](https://mockapi.io) — `/Products` |
| Local Data | Browser `localStorage` |
| Image Storage | [Cloudinary](https://cloudinary.com) |
| Charts | [Chart.js](https://chartjs.org) |
| Maps | [Leaflet.js](https://leafletjs.com) + OpenStreetMap + Nominatim |
| Sliders | [Swiper.js](https://swiperjs.com) |
| Icons | [Bootstrap Icons](https://icons.getbootstrap.com) |

---

## Project Structure

```
CST-ptoject/
├── Html/
│   ├── Customer/          # Customer-facing pages
│   │   ├── CustomerHomePage.html
│   │   ├── Login.html
│   │   ├── register.html
│   │   ├── product-details.html
│   │   ├── categoryProducts.html
│   │   ├── Cart.html
│   │   ├── profile.html
│   │   └── orderDetails.html
│   ├── Seller/            # Seller dashboard shell + sub-pages
│   │   ├── SellerHomePage.html
│   │   ├── addProductPage.html
│   │   ├── updateProductPage.html
│   │   ├── ProductList.html
│   │   ├── OrderManagement.html
│   │   └── ...
│   └── Admin/
│       └── admin-panel.html
│
├── JS/
│   ├── Core/              # Shared modules (all roles)
│   │   ├── Auth.js        # Login, logout, requireRole, session guards
│   │   ├── Storage.js     # getLS/setLS abstraction + MockAPI cache
│   │   ├── Constants.js   # All localStorage key names
│   │   ├── FileStorage.js # MockAPI products + Cloudinary uploads
│   │   └── SeedData.js    # Default admin + category seeding
│   ├── Customer/          # Customer-specific modules
│   │   ├── CustomerHomePage.js
│   │   ├── Cart.js / CartPage.js
│   │   ├── Wishlist.js
│   │   ├── Reviews.js
│   │   ├── profile.js
│   │   ├── ProductRenderer.js
│   │   ├── product-details.js
│   │   ├── categoryProducts.js
│   │   ├── orderDetails.js
│   │   ├── Login.js / Register.js
│   │   └── SellerRequestNotifications.js
│   ├── Seller/            # Seller-specific modules
│   │   ├── home.js
│   │   ├── ProductList.js
│   │   ├── ProductClass.js
│   │   ├── updateProduct.js
│   │   ├── OrderManagement.js
│   │   ├── CategoryPage.js
│   │   ├── CategorySuggest.js
│   │   ├── Customers.js
│   │   ├── ProductMedia.js
│   │   └── ProductReviews.js
│   └── Admin/             # Admin-specific modules
│       ├── admin-panel.js
│       ├── admin-dashboard.js
│       ├── admin-customers.js
│       ├── admin-sellers.js
│       ├── admin-requests.js
│       ├── admin-products.js
│       ├── admin-orders.js
│       ├── admin-categories.js
│       ├── admin-analytics.js
│       ├── admin-profile.js
│       ├── admin-helpers.js
│       ├── admin-data-orders.js
│       └── admin-data-products.js
│
├── CSS/
│   ├── Customer/          # Per-page customer stylesheets
│   ├── Seller/            # Seller dashboard styles
│   └── Admin/             # Admin panel styles
│
└── Libraries/
    └── JQuery.js
```

---

## Getting Started

DEALPORT is a static frontend project — no build step or server required.

### Prerequisites

- A modern browser (Chrome, Firefox, Edge, Safari)
- A local static file server (or just open with VS Code Live Server)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Abdalla-Elsaied/CST-ptoject.git

# 2. Open with VS Code
cd CST-ptoject
code .

# 3. Start Live Server
# Right-click Html/Customer/Login.html → Open with Live Server
```

> **Note:** The project must be served over HTTP (not opened as `file://`) because ES Modules require a server. VS Code's Live Server extension works perfectly.

### External Services

The project connects to two external services. Both are pre-configured:

| Service | Purpose | Config location |
|---------|---------|----------------|
| MockAPI | User and product storage | `JS/Core/Storage.js` — `BASE_URL` |
| Cloudinary | Image uploads | `JS/Core/FileStorage.js` — `CLOUDINARY_URL`, `UPLOAD_PRESET` |

---

## Default Credentials

On first load, `SeedData.js` automatically creates the admin account if none exists.

| Role | Email | Password |
|------|-------|---------|
| Admin | `admin@cst.com` | `password123` |
| Seller | Register as customer → apply → admin approves | — |
| Customer | Register via `/Html/Customer/register.html` | — |

---

## Architecture

### Data Flow

```
Page Load
    │
    ▼
initUsers()  ──────────────────►  MockAPI /users  (fetches all users into _usersCache)
    │
    ▼
Auth.js (requireRole)  ─────────►  ls_currentUser  (session check)
    │
    ▼
Page Logic
    ├── Users     ──►  Storage.js (_usersCache)  ──►  MockAPI PUT/POST/DELETE
    ├── Products  ──►  FileStorage.js             ──►  MockAPI /Products
    └── Other     ──►  localStorage only
```

### Key Design Decisions

- **MockAPI cache (`_usersCache`)** — `initUsers()` loads all users into memory once. All subsequent reads are O(1) in-memory lookups. Writes (register, update, approve) update the cache synchronously and push to MockAPI in the background.
- **Smart upsert** — `setLS(KEY_USERS, user)` never blindly POSTs. It compares against the cache: new IDs → POST, existing IDs → PUT. Blocks duplicate emails.
- **Dual ID handling** — MockAPI assigns its own numeric ID. All `updateItem()` calls use the MockAPI-assigned ID fetched during `initUsers()`, not the client-generated `user-XXXX` string.
- **No framework** — Pure ES Modules with explicit imports. jQuery is used only in Login and Register pages.

---

## Roles & Permissions

| Feature | Guest | Customer | Seller | Admin |
|---------|-------|---------|--------|-------|
| Browse products | ✅ | ✅ | ✅ | ✅ |
| Add to cart / checkout | ❌ | ✅ | ❌ | ❌ |
| Wishlist | ✅ | ✅ | ❌ | ❌ |
| Write reviews | ❌ | ✅ | ❌ | ❌ |
| Apply to become seller | ❌ | ✅ | ❌ | ❌ |
| Manage own products | ❌ | ❌ | ✅ | ❌ |
| View own orders | ❌ | ✅ | ✅ | ❌ |
| Upload profile photo | ❌ | ✅ | ✅ | ✅ |
| Approve seller requests | ❌ | ❌ | ❌ | ✅ |
| Ban / delete users | ❌ | ❌ | ❌ | ✅ |
| Moderate all products | ❌ | ❌ | ❌ | ✅ |
| Manage categories | ❌ | ❌ | Suggest only | ✅ |

---

## Promo Codes

| Code | Type | Value |
|------|------|-------|
| `DEAL10` | Percent | 10% off |
| `SAVE5` | Fixed | $5 off |
| `WELCOME` | Percent | 15% off |

Codes are case-insensitive and applied in `CartPage.js`.

---

## Known Limitations

- Passwords are stored in **plaintext**. In production, use bcrypt or a similar hashing library.
- MockAPI is a **shared free tier** — concurrent writes from multiple users may cause race conditions.
- `localStorage` has a **5 MB cap**. Large product catalogues or many orders could approach this limit.
- Sessions **do not expire** — `ls_currentUser` persists until explicit logout.
- The Cloudinary upload preset (`Product_images`) must remain **unsigned and active** for image uploads to work.
- Nominatim reverse geocoding has a **1 request/second rate limit**.
- Category approval and seller request decisions send **no automated notifications** to users (status is shown via the homepage banner only).

---

## Team

Built as a CST (Client-Side Technology) faculty project at ITI — March 2026.

| # | Name |
|---|------|
| 1 | Abdalla Elsaied Ali |
| 2 | Ibrahim Khaled Shaban |
| 3 | Mohamed Mahmoud Abdel Ghani |
| 4 | Mohamed Shady Mohamed Mansour |
| 5 | Nourhan Khaled Kamel |

**Track:** Professional Development & BI Infused CRM  
**Institute:** Information Technology Institute (ITI)

---

<div align="center">

**MockAPI Base URL:** `https://69abf0bc9ca639a5217dcac2.mockapi.io/api`

© 2026 DEALPORT — ITI CST Project

</div>
