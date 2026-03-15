// ============================================================
// Storage.js
// Central data access layer.
// Users → MockAPI (remote) via in-memory cache
// Everything else → localStorage
// ============================================================

import { KEY_USERS } from './Constants.js';

const BASE_URL = 'https://69abf0bc9ca639a5217dcac2.mockapi.io/api';

// ─── Private in-memory cache ─────────────────────────────────
let _usersCache = null;


// ─── PUBLIC API ───────────────────────────────────────────────

/**
 * Safely get value from localStorage.
 * Special case: KEY_USERS reads from in-memory MockAPI cache.
 */
export function getLS(key) {
    if (key === KEY_USERS) return getUsers();
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (err) {
        console.error(`[STORAGE] Error reading key "${key}":`, err);
        return null;
    }
}

/**
 * Safely set value to localStorage.
 * Special case: KEY_USERS writes to MockAPI cache + remote.
 * FIX: Uses smart upsert — POST for new users, PUT for existing.
 */
export function setLS(key, value) {
    if (key === KEY_USERS) return setUsers(value);
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.error(`[STORAGE] Error writing key "${key}":`, err);
    }
}

/**
 * Remove item from localStorage.
 */
export function removeLS(key) {
    if (key === KEY_USERS) {
        console.warn('[STORAGE] Cannot remove KEY_USERS directly. Use deleteItem() instead.');
        return;
    }
    localStorage.removeItem(key);
}

/**
 * Append a single item to an array in localStorage.
 */
export function pushItem(key, item) {
    const arr = getLS(key) || [];
    arr.push(item);
    setLS(key, arr);
}

/**
 * Update a single item in an array by id.
 * For KEY_USERS: updates cache + sends PUT to MockAPI.
 */
export function updateItem(key, id, updates) {
    if (key === KEY_USERS) {
        const index = _usersCache?.findIndex(u => String(u.id) === String(id));
        if (index !== undefined && index !== -1) {
            _usersCache[index] = { ..._usersCache[index], ...updates };

            // Sync to MockAPI via PUT (update existing record)
            fetch(`${BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(_usersCache[index])
            }).catch(err => console.error('[STORAGE] Failed to update user on MockAPI:', err));
        }
        return;
    }
    const arr = getLS(key) || [];
    const index = arr.findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
        arr[index] = { ...arr[index], ...updates };
        setLS(key, arr);
    }
}

/**
 * Delete a single item from an array by id.
 * For KEY_USERS: removes from cache + sends DELETE to MockAPI.
 */
export function deleteItem(key, id) {
    if (key === KEY_USERS) {
        _usersCache = (_usersCache || []).filter(u => String(u.id) !== String(id));

        // Sync deletion to MockAPI
        fetch(`${BASE_URL}/users/${id}`, {
            method: 'DELETE'
        }).catch(err => console.error('[STORAGE] Failed to delete user from MockAPI:', err));
        return;
    }
    let arr = getLS(key) || [];
    arr = arr.filter(item => String(item.id) !== String(id));
    setLS(key, arr);
}

/**
 * Clear ALL localStorage data.
 */
export function clearAllLS() {
    _usersCache = null;
    localStorage.clear();
}


// ─── MOCKAPI INIT ─────────────────────────────────────────────

/**
 * Loads all users from MockAPI into the in-memory cache.
 * MUST be called once at app startup before any user lookups.
 * Also deduplicates users that were created multiple times
 * due to the old buggy setUsers() that always used POST.
 */
export async function initUsers() {
    try {
        const res = await fetch(`${BASE_URL}/users`);
        if (!res.ok) throw new Error(`MockAPI responded with ${res.status}`);
        const all = await res.json();

        // ── 1. Deduplicate by logical id ──────────────────────
        // Keep the first (original) occurrence of each logical id.
        const seen = new Map();
        const toDeleteIds = [];

        for (const user of all) {
            const key = String(user.id);
            if (!seen.has(key)) {
                seen.set(key, user);
            } else {
                toDeleteIds.push(user);
            }
        }

        // ── 2. Deduplicate by email (Role Priority) ───────────
        // Keep the record with the highest authority role.
        const emailMap = new Map();
        const emailDups = [];
        const priority = { admin: 3, seller: 2, customer: 1 };

        for (const user of seen.values()) {
            const email = (user.email || '').toLowerCase();
            if (!email) continue;

            if (emailMap.has(email)) {
                const existing = emailMap.get(email);
                const existingScore = priority[existing.role?.toLowerCase()] || 0;
                const userScore = priority[user.role?.toLowerCase()] || 0;

                if (userScore > existingScore) {
                    emailDups.push(existing);
                    emailMap.set(email, user);
                } else {
                    emailDups.push(user);
                }
            } else {
                emailMap.set(email, user);
            }
        }

        _usersCache = [...emailMap.values()];
        console.log(`[STORAGE] ${_usersCache.length} unique users loaded`);

        // ── 3. Silent cleanup ─────────────────────────────────
        const allDups = [...toDeleteIds, ...emailDups];
        if (allDups.length > 0) {
            console.warn(`[STORAGE] Purging ${allDups.length} duplicates from MockAPI...`);
            allDups.forEach(dup => {
                fetch(`${BASE_URL}/users/${dup.id}`, { method: 'DELETE' })
                    .catch(() => {});
            });

            // If a massive amount was cleaned, notify UI
            if (allDups.length > 10) {
                window.dispatchEvent(new CustomEvent('duplicates-detected', { detail: allDups.length }));
            }
        }

    } catch (err) {
        console.error('[STORAGE] Failed to load users from MockAPI:', err);
        _usersCache = _usersCache || [];
    }
}


// ─── INTERNAL HELPERS ─────────────────────────────────────────

function getUsers() {
    return _usersCache || [];
}

/**
 * Smart upsert for users array.
 * FIX: Now blocks duplicate emails before creation.
 * Now: POST only truly new IDs, PUT existing ones.
 */
function setUsers(users) {
    const incoming = Array.isArray(users) ? users : [users];
    const existingIds = new Set((_usersCache || []).map(u => String(u.id)));

    // Split: genuinely new vs already exists
    const toCreate = incoming.filter(u => !existingIds.has(String(u.id)));
    const toUpdate = incoming.filter(u =>  existingIds.has(String(u.id)));

    // Check email uniqueness before creating
    const existingEmails = new Set(
        (_usersCache || []).map(u => (u.email || '').toLowerCase())
    );

    const safeToCreate = toCreate.filter(u => {
        const email = (u.email || '').toLowerCase();
        if (!email) return true; // allow empty email if logic allows, usually not
        if (existingEmails.has(email)) {
            console.warn(`[STORAGE] Blocked duplicate email creation for: ${email}`);
            return false;
        }
        existingEmails.add(email);
        return true;
    });

    // Update cache atomically
    const updatedCache = (_usersCache || []).map(cached => {
        const update = toUpdate.find(u => String(u.id) === String(cached.id));
        return update ? { ...cached, ...update } : cached;
    });
    _usersCache = [...updatedCache, ...safeToCreate];

    // POST only verified new users
    safeToCreate.forEach(user => {
        fetch(`${BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        }).catch(err => console.error('[STORAGE] POST failed:', err));
    });

    // PUT existing users that changed
    toUpdate.forEach(user => {
        fetch(`${BASE_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        }).catch(err => console.error('[STORAGE] PUT failed:', err));
    });
}
