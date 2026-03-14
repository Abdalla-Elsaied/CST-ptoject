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
        console.log('default Users had been Seeded successfully ');
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

export function seedTestimonials() {

    const seedTestimonials = [
        { id: 't1', userId: null, name: 'Emily R.', avatar: 'https://i.pravatar.cc/60?img=1', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-01T10:00:00Z', featured: true },

        { id: 't2', userId: null, name: 'John D.', avatar: 'https://i.pravatar.cc/60?img=12', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-05T14:00:00Z', featured: true },

        { id: 't3', userId: null, name: 'Ahmed M.', avatar: 'https://i.pravatar.cc/60?img=7', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-10T09:00:00Z', featured: true },

        { id: 't4', userId: null, name: 'Alex T.', avatar: 'https://i.pravatar.cc/60?img=33', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-12T11:00:00Z', featured: false },

        { id: 't5', userId: null, name: 'Priya R.', avatar: 'https://i.pravatar.cc/60?img=45', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-14T08:00:00Z', featured: false },

        { id: 't6', userId: null, name: 'David H.', avatar: 'https://i.pravatar.cc/60?img=22', rating: 5, comment: 'Fast delivery and fantastic quality! The customer support team was quick to resolve my query. Dealport has earned a loyal customer!', createdAt: '2025-12-16T16:00:00Z', featured: false },
    ];

    const existing = getLS(KEY_TESTIMONIALS);

    if (Array.isArray(existing) && existing.length > 0) return;

    setLS(KEY_TESTIMONIALS, seedTestimonials);
}