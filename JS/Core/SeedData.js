import { getLS, setLS } from './Storage.js';
import { KEY_USERS, KEY_SEEDED } from './Constants.js';

/**
 * Seeds only the admin user for initial setup.
 * All other users (sellers, customers) must register through the system.
 */
export function seedAdmin() {
    // Check if we already seeded to avoid double-runs
    if (localStorage.getItem(KEY_SEEDED)) return;

    const users = getLS(KEY_USERS) || [];

    // Only seed if no users exist at all
    if (users.length === 0) {
        const defaultUsers = [
            {
                id: 'admin-001',
                fullName: 'Platform Administrator',
                name: 'Admin',
                email: 'admin@cst.com',
                password: 'password123',
                role: 'admin',
                createdAt: new Date().toISOString()
            }
        ];

        setLS(KEY_USERS, defaultUsers);
        localStorage.setItem(KEY_SEEDED, 'true');
        console.log('✅ Admin user seeded:');
        console.log('   Admin: admin@cst.com / password123');
        console.log('');
        console.log('   All other users must register through the system.');
    }
}

