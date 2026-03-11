import { getLS, setLS } from './Storage.js';
import { KEY_USERS, KEY_SEEDED } from './Constants.js';

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
