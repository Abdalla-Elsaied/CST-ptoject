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

        users.push(newAdmin);
        setLS(KEY_USERS, users);
        console.log('Admin user seeded: admin@cst.com / password123');
    }
}
