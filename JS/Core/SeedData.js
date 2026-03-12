import { getLS, setLS } from './Storage.js';
import { KEY_USERS, KEY_CATEGORIES } from './Constants.js';

/**
 * Seeds the admin user if one does not already exist, ensuring an admin is always available.
 */
export function seedAdmin() {
    const users = getLS(KEY_USERS) || [];
    const hasAdmin = users.some(u => u.role === 'admin');

    if (!hasAdmin) {
        const newAdmin = {
            id: 'admin-001',
            fullName: 'Platform Administrator',
            name: 'Admin',
            email: 'admin@cst.com',
            password: 'password123',
            role: 'admin',
            createdAt: new Date().toISOString()
        };
        const newSeller = {
            id: 'seller-001',
            fullName: 'Platform Seller',
            name: 'Seller',
            email: 'seller@cst.com',
            password: 'password1233',
            role: 'seller',
            createdAt: new Date().toISOString()
        };
        const newSeller2003 = {
            id: 'seller-0012033',
            fullName: 'Platform Seller 2003',
            name: 'Seller2003',
            email: 'seller3@cst.com',
            password: 'password1233',
            role: 'seller',
            createdAt: new Date().toISOString()
        };


        users.push(newAdmin);
        users.push(newSeller);
        users.push(newSeller2003);
        setLS(KEY_USERS, users);
        console.log('Admin user seeded: admin@cst.com / password123');
        console.log('Seller user seeded: seller@cst.com / password1233');
        console.log('Seller2003 user seeded: seller3@cst.com / password1233');
    }
}

export function seedCategories() {

    const seedCategories = [
        { id: "cat-1", name: "Women Fashion", products: 214, visibility: "active", updated: "Mar 06, 2026", description: "" },
        { id: "cat-2", name: "Men Essentials", products: 162, visibility: "active", updated: "Mar 02, 2026", description: "" },
        { id: "cat-3", name: "Beauty & Care", products: 88, visibility: "hidden", updated: "Feb 28, 2026", description: "" },
        { id: "cat-4", name: "Electronics", products: 132, visibility: "active", updated: "Mar 08, 2026", description: "" },
        { id: "cat-5", name: "Home & Living", products: 104, visibility: "draft", updated: "Feb 22, 2026", description: "" },
        { id: "cat-6", name: "Shoes", products: 96, visibility: "active", updated: "Mar 01, 2026", description: "" },
    ];

    const existing = getLS(KEY_CATEGORIES);
    if (Array.isArray(existing) && existing.length > 0) return;
    setLS(KEY_CATEGORIES, seedCategories);
}