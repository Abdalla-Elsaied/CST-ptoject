// ============================================================
// SeedData.js
// Seeds essential data on first run and patches incomplete
// records from old versions.
//
// Contains:
//   1. seedAdmin()         → Admin + 2 complete seed sellers
//   2. patchSeedSellers()  → Updates incomplete sellers via PUT
//   3. seedCategories()    → Default marketplace categories
//
// Does NOT contain:
//   ✗ seedTestimonials()   → Testimonials come from real users via UI
//   ✗ seedProducts()       → Products added by sellers via UI
//
// Call order in admin-panel.js (after await initUsers()):
//   await patchSeedSellers();
//   invalidateCaches();
//   seedAdmin() is called separately before initUsers()
// ============================================================

import { getLS, setLS, updateItem } from './Storage.js';
import { KEY_USERS, KEY_CATEGORIES } from './Constants.js';


// ─── 1. SEED ADMIN + SELLERS ─────────────────────────────────

/**
 * Seeds the admin user and 2 complete seed sellers if they
 * do not already exist. Runs once — skipped if admin exists.
 *
 * Seed accounts:
 *   Admin  → admin@cst.com      / password123
 *   Seller → seller@cst.com     / password1233  (Karim Mostafa)
 *   Seller → seller3@cst.com    / password1233  (Nour Khaled)
 */
export function seedAdmin() {
    const users = getLS(KEY_USERS) || [];
    const hasAdmin = users.some(u => u.role === 'admin');

    if (hasAdmin) return; // already seeded

    const existingEmails = new Set(users.map(u => (u.email || '').toLowerCase()));

    // ── Platform Admin ────────────────────────────────────
    const newAdmin = {
        id: 'admin-001',
        fullName: 'Platform Administrator',
        name: 'Admin',
        email: 'admin@cst.com',
        password: 'password123',
        role: 'admin',
        createdAt: new Date().toISOString()
    };

    // ── Seed Seller 1 — Karim Mostafa ─────────────────────
    const sellerKarim = {
        id: 'seller-001',
        fullName: 'Karim Mostafa',
        name: 'Karim Mostafa',
        email: 'seller@cst.com',
        password: 'password1233',
        role: 'seller',
        storeName: 'TechZone Egypt',
        storeDescription: 'Your go-to store for the latest electronics and gadgets at the best prices in Egypt.',
        category: 'Electronics',
        city: 'Cairo',
        phone: '01012345678',
        paymentMethod: 'Bank Transfer',
        sellerApprovedAt: new Date('2025-11-15').toISOString(),
        createdAt: new Date('2025-11-15').toISOString()
    };

    // ── Seed Seller 2 — Nour Khaled ───────────────────────
    const sellerNour = {
        id: 'seller-0012033',
        fullName: 'Nour Khaled',
        name: 'Nour Khaled',
        email: 'seller3@cst.com',
        password: 'password1233',
        role: 'seller',
        storeName: 'Nour Fashion Boutique',
        storeDescription: 'Trendy women and men fashion — handpicked collections from local Egyptian designers.',
        category: 'Women Fashion',
        city: 'Tanta',
        phone: '01198765432',
        paymentMethod: 'Vodafone Cash',
        sellerApprovedAt: new Date('2025-12-01').toISOString(),
        createdAt: new Date('2025-12-01').toISOString()
    };

    const toSeed = [newAdmin, sellerKarim, sellerNour]
        .filter(u => !existingEmails.has(u.email.toLowerCase()));

    if (toSeed.length > 0) {
        // ✅ Pass ONLY truly new users
        setLS(KEY_USERS, toSeed);
        console.log(`[SEED] ${toSeed.length} user(s) seeded successfully`);
    }
}


// ─── 2. PATCH INCOMPLETE SEED SELLERS ────────────────────────

/**
 * Patches existing seed sellers on MockAPI that are missing
 * store metadata — happens when the old seedAdmin() ran before
 * the complete seller fields were added.
 *
 * Uses updateItem() which sends a PUT request to MockAPI →
 * updates the existing record instead of creating a duplicate.
 *
 * Safe to call on every startup — only patches if storeName
 * is missing. Never overwrites real user data.
 *
 * Called in admin-panel.js after await initUsers().
 */
export async function patchSeedSellers() {
    const users = getLS(KEY_USERS) || [];

    const patches = {

        // Karim Mostafa — TechZone Egypt
        'seller-001': {
            fullName: 'Karim Mostafa',
            name: 'Karim Mostafa',
            storeName: 'TechZone Egypt',
            storeDescription: 'Your go-to store for the latest electronics and gadgets.',
            category: 'Electronics',
            city: 'Cairo',
            phone: '01012345678',
            paymentMethod: 'Bank Transfer',
            sellerApprovedAt: new Date('2025-11-15').toISOString()
        },

        // Nour Khaled — Nour Fashion Boutique
        'seller-0012033': {
            fullName: 'Nour Khaled',
            name: 'Nour Khaled',
            storeName: 'Nour Fashion Boutique',
            storeDescription: 'Trendy fashion from local Egyptian designers.',
            category: 'Women Fashion',
            city: 'Tanta',
            phone: '01198765432',
            paymentMethod: 'Vodafone Cash',
            sellerApprovedAt: new Date('2025-12-01').toISOString()
        }
    };

    for (const user of users) {
        // Only patch if:
        // 1. This user has a patch defined
        // 2. The user is missing storeName (incomplete old seed)
        if (patches[user.id] && !user.storeName) {
            // updateItem → updates _usersCache + sends PUT to MockAPI
            // Correct: updates existing record, no duplicates created
            updateItem(KEY_USERS, user.id, patches[user.id]);
            console.log(`[SEED] Patched seller ${user.id} — ${patches[user.id].fullName}`);
        }
    }
}


// ─── 3. SEED CATEGORIES ───────────────────────────────────────

/**
 * Seeds the default marketplace categories on first run.
 * Skipped if categories already exist in localStorage.
 *
 * Visibility:
 *   active → visible on storefront and in seller product forms
 *   hidden → not visible on storefront
 *   draft  → pending admin approval (shows in Category Suggestions)
 */
export function seedCategories() {
    const existing = getLS(KEY_CATEGORIES);
    if (Array.isArray(existing) && existing.length > 0) return;

    const categories = [
        {
            id: 'cat-1',
            name: 'Women Fashion',
            products: 214,
            visibility: 'active',
            source: 'admin',
            suggestedBy: null,
            updated: 'Mar 06, 2026',
            createdAt: new Date('2025-10-01').toISOString(),
            description: 'Clothing, accessories, and footwear for women.'
        },
        {
            id: 'cat-2',
            name: 'Men Essentials',
            products: 162,
            visibility: 'active',
            source: 'admin',
            suggestedBy: null,
            updated: 'Mar 02, 2026',
            createdAt: new Date('2025-10-01').toISOString(),
            description: 'Everyday clothing and essentials for men.'
        },
        {
            id: 'cat-3',
            name: 'Beauty & Care',
            products: 88,
            visibility: 'hidden',
            source: 'admin',
            suggestedBy: null,
            updated: 'Feb 28, 2026',
            createdAt: new Date('2025-10-01').toISOString(),
            description: 'Skincare, haircare, and beauty products.'
        },
        {
            id: 'cat-4',
            name: 'Electronics',
            products: 132,
            visibility: 'active',
            source: 'admin',
            suggestedBy: null,
            updated: 'Mar 08, 2026',
            createdAt: new Date('2025-10-01').toISOString(),
            description: 'Gadgets, devices, and tech accessories.'
        },
        {
            id: 'cat-5',
            name: 'Home & Living',
            products: 104,
            visibility: 'draft',
            source: 'admin',
            suggestedBy: null,
            updated: 'Feb 22, 2026',
            createdAt: new Date('2025-10-01').toISOString(),
            description: 'Furniture, decor, and home essentials.'
        },
        {
            id: 'cat-6',
            name: 'Shoes',
            products: 96,
            visibility: 'active',
            source: 'admin',
            suggestedBy: null,
            updated: 'Mar 01, 2026',
            createdAt: new Date('2025-10-01').toISOString(),
            description: 'Footwear for all occasions and styles.'
        },
    ];

    setLS(KEY_CATEGORIES, categories);
    console.log('[SEED] Default categories seeded successfully');
}
