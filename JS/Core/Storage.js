import { KEY_SEEDED } from './Constants.js';

/**
 * Safely get value from localStorage
 * @param {string} key 
 * @returns {any} parsed value or null
 */
export function getLS(key) {
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
    let arr = getLS(key) || [];
    arr = arr.filter(item => item.id !== id);
    setLS(key, arr);
}

/**
 * Clear ALL localStorage data (useful for testing / logout all)
 */
export function clearAllLS() {
    localStorage.clear();
}