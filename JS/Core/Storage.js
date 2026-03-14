import { KEY_USERS } from './Constants.js';
const BASE_URL = 'https://69abf0bc9ca639a5217dcac2.mockapi.io/api';

/**
 * Safely get value from localStorage
 * @param {string} key 
 * @returns {any} parsed value or null
 */
export function getLS(key) {
    if (key === KEY_USERS) return getUsers();
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (err) {
        console.error(`Error reading localStorage key "${key}":`, err);
        return null;
    }
}

/**
 * Safely set value to localStorage
 * @param {string} key 
 * @param {any} value 
 */
export function setLS(key, value) {
    if (key === KEY_USERS) return setUsers(value);
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.error(`Error writing to localStorage key "${key}":`, err);
    }
}

/**
 * Remove item from localStorage
 * @param {string} key 
 */
export function removeLS(key) {
    if (key === KEY_USERS) {
        // Users live in MockAPI, not localStorage — nothing to remove locally
        console.warn('removeLS: cannot remove KEY_USERS, use deleteItem instead.');
        return;
    }
    localStorage.removeItem(key);
}

/**
 * Append item to array in localStorage
 * @param {string} key 
 * @param {any} item 
 */
export function pushItem(key, item) {
    const arr = getLS(key) || [];
    arr.push(item);
    setLS(key, arr);
}

/**
 * Update item in array by id
 * @param {string} key 
 * @param {string|number} id 
 * @param {object} updates 
 */
export function updateItem(key, id, updates) {
    if (key === KEY_USERS) {
        // ✅ Update cache
        const index = _usersCache?.findIndex(u => u.id === id);
        if (index !== -1 && index !== undefined) {
            _usersCache[index] = { ..._usersCache[index], ...updates };

            // Sync to MockAPI silently in background using PUT
            fetch(`${BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(_usersCache[index])
            }).catch(err => console.error('Failed to update user in MockAPI:', err));
        }
        return;
    }
    const arr = getLS(key) || [];
    const index = arr.findIndex(item => item.id === id);
    if (index !== -1) {
        arr[index] = { ...arr[index], ...updates };
        setLS(key, arr);
    }
}

/**
 * Delete item from array by id
 * @param {string} key 
 * @param {string|number} id 
 */
export function deleteItem(key, id) {
    if (key === KEY_USERS) {
        // ✅ Remove from cache
        _usersCache = _usersCache?.filter(u => u.id !== id) || [];

        // Sync to MockAPI silently in background using DELETE
        fetch(`${BASE_URL}/users/${id}`, {
            method: 'DELETE'
        }).catch(err => console.error('Failed to delete user from MockAPI:', err));
        return;
    }
    let arr = getLS(key) || [];
    arr = arr.filter(item => item.id !== id);
    setLS(key, arr);
}

/**
 * Clear ALL localStorage data (useful for testing / logout all)
 */
export function clearAllLS() {
    _usersCache = null; // ✅ wipe cache so next initUsers() fetches fresh
    localStorage.clear();
}

// ─── Private in-memory cache (invisible to everyone) ─────────────────────────
let _usersCache = null;

// ─── Call once in main.js before anything else ───────────────────────────────
export async function initUsers() {
    const res = await fetch(`${BASE_URL}/users`);
    _usersCache = await res.json();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
function getUsers() {
    return _usersCache || [];
}

function setUsers(users) {
    const newUsers = Array.isArray(users) ? users : [users];

    // Update cache immediately so getLS returns fresh data right away
    _usersCache = [...(_usersCache || []), ...newUsers];

    // Sync to MockAPI silently in the background — doesn't block anything
    newUsers.forEach(user => {
        fetch(`${BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        }).catch(err => console.error('Failed to sync user to MockAPI:', err));
    });
}

