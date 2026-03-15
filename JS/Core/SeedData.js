// ============================================================
// SeedData.js
// Seeds essential data on first run.
//
// ARCHITECTURE:
//   Users        → MockAPI (remote) via Storage.js setLS/initUsers
//   Categories   → localStorage (KEY_CATEGORIES)
//   Testimonials → localStorage (KEY_TESTIMONIALS)
//
// WHAT THIS FILE DOES:
//   seedAdmin()         → Admin only → MockAPI via setLS(KEY_USERS)
//   seedCategories()    → Default categories → localStorage
//   patchSeedSellers()  → Patches existing sellers with required fields
//   seedTestimonials()  → Default testimonials → localStorage
//
// NOTE: Sellers are NO LONGER seeded here.
//       All sellers must be added through the UI (Seller Requests).
//
// CALL ORDER in admin-panel.js:
//   await initUsers()        ← loads MockAPI cache
//   invalidateCaches()       ← rebuilds name Maps
//   patchSeedSellers()       ← patches existing sellers with required fields
//   initMetricsTracking()    ← starts metrics
// ============================================================

import { getLS, setLS } from './Storage.js';
import {
    KEY_USERS,
    KEY_CATEGORIES,
    KEY_TESTIMONIALS
} from './Constants.js';


// ─── 1. SEED ADMIN ONLY ───────────────────────────────────────

/**
 * Seeds the admin account if no admin exists yet.
 * Skipped entirely if any admin is already in the MockAPI cache.
 *
 * Account:
 *   Admin → admin@cst.com / password123
 *
 * Sellers are intentionally NOT seeded here.
 * They must be registered and approved through the UI.
 */
export function seedAdmin() {
    const users    = getLS(KEY_USERS) || [];
    const hasAdmin = users.some(u => u.role === 'admin');
    if (hasAdmin) return;

    const existingEmails = new Set(
        users.map(u => (u.email || '').toLowerCase())
    );

    const newAdmin = {
        id:        'admin-001',
        fullName:  'Platform Administrator',
        name:      'Admin',
        email:     'admin@cst.com',
        password:  'password123',
        role:      'admin',
        createdAt: new Date().toISOString()
    };

    // Skip if admin email already exists
    if (existingEmails.has(newAdmin.email.toLowerCase())) return;

    setLS(KEY_USERS, [newAdmin]);
    console.log('[SEED] Admin account seeded → MockAPI');
}


// ─── 2. SEED CATEGORIES ───────────────────────────────────────

/**
 * Seeds default marketplace categories to localStorage.
 * Skipped if categories already exist.
 *
 * NOTE: Categories are managed via:
 *   - This seed (first run only)
 *   - Admin UI (Add Category → Suggestions tab)
 *   - NOT stored on MockAPI
 *
 * Visibility rules:
 *   active → visible on storefront + seller product forms
 *   hidden → exists but not shown on storefront
 *   draft  → pending approval in Suggestions tab
 *            (admin-created drafts or seller suggestions)
 */
export function seedCategories() {
    const existing = getLS(KEY_CATEGORIES);
    if (Array.isArray(existing) && existing.length > 0) return;

    const categories = [
        {
            id:          'cat-1',
            name:        'Women Fashion',
            description: 'Clothing, accessories, and footwear for women.',
            visibility:  'active',
            source:      'admin',
            suggestedBy: null,
            products:    214,
            updated:     'Mar 06, 2026',
            createdAt:   new Date('2025-10-01').toISOString()
        },
        {
            id:          'cat-2',
            name:        'Men Essentials',
            description: 'Everyday clothing and essentials for men.',
            visibility:  'active',
            source:      'admin',
            suggestedBy: null,
            products:    162,
            updated:     'Mar 02, 2026',
            createdAt:   new Date('2025-10-01').toISOString()
        },
        {
            id:          'cat-3',
            name:        'Beauty & Care',
            description: 'Skincare, haircare, and beauty products.',
            visibility:  'hidden',
            source:      'admin',
            suggestedBy: null,
            products:    88,
            updated:     'Feb 28, 2026',
            createdAt:   new Date('2025-10-01').toISOString()
        },
        {
            id:          'cat-4',
            name:        'Electronics',
            description: 'Gadgets, devices, and tech accessories.',
            visibility:  'active',
            source:      'admin',
            suggestedBy: null,
            products:    132,
            updated:     'Mar 08, 2026',
            createdAt:   new Date('2025-10-01').toISOString()
        },
        {
            id:          'cat-5',
            name:        'Home & Living',
            description: 'Furniture, decor, and home essentials.',
            visibility:  'hidden',
            source:      'admin',
            suggestedBy: null,
            products:    104,
            updated:     'Feb 22, 2026',
            createdAt:   new Date('2025-10-01').toISOString()
        },
        {
            id:          'cat-6',
            name:        'Shoes',
            description: 'Footwear for all occasions and styles.',
            visibility:  'active',
            source:      'admin',
            suggestedBy: null,
            products:    96,
            updated:     'Mar 01, 2026',
            createdAt:   new Date('2025-10-01').toISOString()
        }
    ];

    setLS(KEY_CATEGORIES, categories);
    console.log('[SEED] Default categories seeded → localStorage');
}


// ─── 3. PATCH SEED SELLERS ────────────────────────────────────

/**
 * Patches existing sellers in the database with required fields.
 * This ensures sellers created before certain features were added
 * have all necessary properties (storeName, isApproved, etc.).
 *
 * Called by admin-panel.js on page load.
 * Does NOT create new sellers — only patches existing ones.
 */
export function patchSeedSellers() {
    const users = getLS(KEY_USERS) || [];
    let changed = false;

    const patched = users.map(u => {
        if (u.role === 'seller') {
            const updates = {};
            
            // Ensure isApproved exists (default to true for existing sellers)
            if (u.isApproved === undefined) {
                updates.isApproved = true;
                changed = true;
            }
            
            // Ensure storeName exists (fallback to name or email)
            if (!u.storeName) {
                updates.storeName = u.name || u.fullName || u.email?.split('@')[0] || 'Store';
                changed = true;
            }
            
            // Ensure other seller fields exist
            if (!u.city) {
                updates.city = 'Cairo';
                changed = true;
            }
            
            if (!u.paymentMethod) {
                updates.paymentMethod = 'Bank Transfer';
                changed = true;
            }
            
            if (Object.keys(updates).length > 0) {
                return { ...u, ...updates };
            }
        }
        return u;
    });

    if (changed) {
        setLS(KEY_USERS, patched);
        console.log('[PATCH] Sellers patched with required fields');
    }
}


// ─── 4. SEED TESTIMONIALS ─────────────────────────────────────

/**
 * Seeds default testimonials to localStorage.
 * Skipped if testimonials already exist.
 *
 * NOTE: In production, testimonials come from real customers.
 *       This seed provides initial data for a fresh install
 *       so the storefront homepage looks populated.
 *
 * The admin Reviews section reads from this same key.
 * Customers can add/delete testimonials via the storefront.
 */
export function seedTestimonials() {
    const existing = getLS(KEY_TESTIMONIALS);
    if (Array.isArray(existing) && existing.length > 0) return;

    const testimonials = [
        {
            id:        't1',
            userId:    null,
            name:      'Emily R.',
            avatar:    'https://i.pravatar.cc/60?img=1',
            rating:    5,
            comment:   'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!',
            createdAt: '2025-12-01T10:00:00Z',
            featured:  true
        },
        {
            id:        't2',
            userId:    null,
            name:      'John D.',
            avatar:    'https://i.pravatar.cc/60?img=12',
            rating:    5,
            comment:   'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!',
            createdAt: '2025-12-05T14:00:00Z',
            featured:  true
        },
        {
            id:        't3',
            userId:    null,
            name:      'Ahmed M.',
            avatar:    'https://i.pravatar.cc/60?img=7',
            rating:    5,
            comment:   'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!',
            createdAt: '2025-12-10T09:00:00Z',
            featured:  true
        },
        {
            id:        't4',
            userId:    null,
            name:      'Alex T.',
            avatar:    'https://i.pravatar.cc/60?img=33',
            rating:    5,
            comment:   'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!',
            createdAt: '2025-12-12T11:00:00Z',
            featured:  false
        },
        {
            id:        't5',
            userId:    null,
            name:      'Priya R.',
            avatar:    'https://i.pravatar.cc/60?img=45',
            rating:    5,
            comment:   'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!',
            createdAt: '2025-12-14T08:00:00Z',
            featured:  false
        },
        {
            id:        't6',
            userId:    null,
            name:      'David H.',
            avatar:    'https://i.pravatar.cc/60?img=22',
            rating:    5,
            comment:   'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!',
            createdAt: '2025-12-16T16:00:00Z',
            featured:  false
        }
    ];

    setLS(KEY_TESTIMONIALS, testimonials);
    console.log('[SEED] Default testimonials seeded → localStorage');
}