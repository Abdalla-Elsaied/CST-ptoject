// ============================================================
// Auth.js
// Authentication, registration, role management, session.
//
// FIX: acceptCustomerSellerRequest() now uses updateItem()
//      instead of setLS(KEY_USERS, fullArray) — prevents
//      duplicate users being created on MockAPI on every approve.
// ============================================================

import {
    KEY_USERS,
    KEY_CURRENT_USER,
    KEY_CART,
    KEY_APPROVAL,
    KEY_SELLER_OUTCOMES
} from './Constants.js';

import {
    getLS,
    setLS,
    removeLS,
    updateItem,
} from './Storage.js';


// ─── ROLES ───────────────────────────────────────────────────

const ROLES = {
    CUSTOMER: 'customer',
    SELLER:   'seller',
    ADMIN:    'admin',
};

const LOGIN_URL        = '/Html/Customer/Login.html';
const CUSTOMER_HOME_URL = '/Html/Customer/Home.html';
const SELLER_HOME_URL   = '/Html/Seller/SellerHomePage.html';
const ADMIN_HOME_URL    = '/Html/Admin/admin-panel.html';

const ALL_VALID_ROLES = [
    ROLES.CUSTOMER,
    ROLES.SELLER,
    ROLES.ADMIN,
];


// ─── PRIVATE HELPERS ─────────────────────────────────────────

function generateId() {
    return 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6;
}

function isValidName(name) {
    return typeof name === 'string' && name.trim().length >= 1;
}

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}


// ─── REGISTRATION ─────────────────────────────────────────────

/**
 * Register a new CUSTOMER (self-registration only).
 */
export function registerUser(name, email, password) {
    if (!isValidName(name))     return { success: false, error: 'Name is required' };
    if (!isValidEmail(email))   return { success: false, error: 'Invalid email format' };
    if (!isValidPassword(password)) return { success: false, error: 'Password must be at least 6 characters' };

    const users           = getLS(KEY_USERS) || [];
    const normalizedEmail = normalizeEmail(email);

    // ✅ Block duplicate email
    if (users.some(u => (u.email || '').toLowerCase() === normalizedEmail)) {
        return { success: false, error: 'This email is already registered. Please login instead.' };
    }

    const newUser = {
        id:        generateId(),
        name:      name.trim(),
        email:     normalizedEmail,
        password,
        role:      ROLES.CUSTOMER,
        createdAt: new Date().toISOString(),
    };

    setLS(KEY_USERS, [newUser]); // Smart setUsers → POST only this new user
    return { success: true, user: newUser };
}

/**
 * Admin-only: create any type of user.
 */
export function adminCreateUser(currentUser, name, email, password, role) {
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
        return { success: false, error: 'Only admins can create users' };
    }
    if (!ALL_VALID_ROLES.includes(role)) {
        return { success: false, error: `Invalid role. Allowed: ${ALL_VALID_ROLES.join(', ')}` };
    }
    if (!isValidName(name))     return { success: false, error: 'Invalid name' };
    if (!isValidEmail(email))   return { success: false, error: 'Invalid email format' };
    if (!isValidPassword(password)) return { success: false, error: 'Password must be at least 6 characters' };

    const users           = getLS(KEY_USERS) || [];
    const normalizedEmail = normalizeEmail(email);

    // ✅ Block duplicate email
    if (users.some(u => (u.email || '').toLowerCase() === normalizedEmail)) {
        return { success: false, error: 'A user with this email already exists.' };
    }

    const newUser = {
        id:        generateId(),
        name:      name.trim(),
        email:     normalizedEmail,
        password,
        role,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
    };

    setLS(KEY_USERS, [newUser]); // Smart setUsers → POST only this new user
    return { success: true, user: newUser };
}


// ─── LOGIN / LOGOUT ───────────────────────────────────────────

/**
 * Log in user and set current session.
 */
export function loginUser(email, password) {
    const users           = getLS(KEY_USERS) || [];
    const normalizedEmail = normalizeEmail(email);
    const user            = users.find(u => u.email === normalizedEmail);

    if (!user)                    return { success: false, error: 'Invalid credentials' };
    if (user.password !== password) return { success: false, error: 'Invalid credentials' };
    if (user.isBanned)            return { success: false, error: 'Your account has been suspended' };
    if (user.isSuspended)         return { success: false, error: 'Your seller account has been suspended' };

    setLS(KEY_CURRENT_USER, user);
    return { success: true, role: user.role };
}

/**
 * Log out current user.
 */
export function logoutUser() {
    removeLS(KEY_CURRENT_USER);
    removeLS(KEY_CART);
    window.location.href = LOGIN_URL;
}

/**
 * Get currently logged-in user.
 */
export function getCurrentUser() {
    return getLS(KEY_CURRENT_USER) || null;
}

export function setCurrentUser(user) {
    setLS(KEY_CURRENT_USER, user);
}


// ─── ROLE PROTECTION ──────────────────────────────────────────

/**
 * Protect pages by required role.
 * Call at the very top of protected page scripts.
 */
export function requireRole(allowedRoles) {
    const user = getCurrentUser();

    if (!user) {
        window.location.href = LOGIN_URL;
        return false;
    }

    if (!allowedRoles.includes(user.role)) {
        switch (user.role) {
            case ROLES.ADMIN:    window.location.href = ADMIN_HOME_URL;    break;
            case ROLES.SELLER:   window.location.href = SELLER_HOME_URL;   break;
            default:             window.location.href = CUSTOMER_HOME_URL; break;
        }
        return false;
    }

    return true;
}


// ─── PROFILE UPDATE ───────────────────────────────────────────

/**
 * Update current user in both MockAPI cache and session.
 * FIX: Uses updateItem() → PUT request, no duplicates.
 */
export function updateCurrentUserInStorage(updates) {
    const current = getCurrentUser();
    if (!current) return false;

    // updateItem → updates _usersCache + sends PUT to MockAPI
    updateItem(KEY_USERS, current.id, updates);

    // Update session
    const updatedUser = { ...current, ...updates };
    setLS(KEY_CURRENT_USER, updatedUser);

    return true;
}


// ─── CART ─────────────────────────────────────────────────────

export function getCartCount() {
    const cart = getLS(KEY_CART) || [];
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}


// ─── SELLER REQUESTS ──────────────────────────────────────────

export function addCustomerToSeller(userId, storeData) {
    const requests = getLS(KEY_APPROVAL) || [];

    const user = (getLS(KEY_USERS) || []).find(u => u.id === userId);
    if (user && user.role !== ROLES.CUSTOMER) {
        return { success: false, error: 'You are already a seller or an administrator' };
    }

    const alreadyRequested = requests.some(
        r => r.userId === userId && r.status === 'pending'
    );
    if (alreadyRequested) {
        return { success: false, error: 'You already submitted a request' };
    }

    const users = getLS(KEY_USERS) || [];
    const nameExists =
        users.some(u => u.storeName?.toLowerCase() === storeData.storeName.toLowerCase()) ||
        requests.some(r => r.storeName?.toLowerCase() === storeData.storeName.toLowerCase());

    if (nameExists) {
        return { success: false, error: 'Store name is already taken. Please choose another.' };
    }

    const newRequest = {
        id:        'req-' + Date.now().toString().slice(2, 9),
        userId,
        ...storeData,
        status:    'pending',
        createdAt: new Date().toISOString()
    };

    setLS(KEY_APPROVAL, [...requests, newRequest]);
    return { success: true, request: newRequest };
}

export function getAllCustomerToApproved() {
    return getLS(KEY_APPROVAL) || [];
}

/**
 * Approve a seller request.
 *
 * FIX: Was calling setLS(KEY_USERS, fullArray) which caused
 *      setUsers() to POST every user → mass duplicates on MockAPI.
 *      Now uses updateItem() → sends PUT for just the one changed user.
 */
export function acceptCustomerSellerRequest(requestId) {
    const requests     = getLS(KEY_APPROVAL) || [];
    const requestIndex = requests.findIndex(r => r.id === requestId);

    if (requestIndex === -1) {
        return { success: false, error: 'Request not found' };
    }

    const request = requests[requestIndex];
    const users   = getLS(KEY_USERS) || [];
    const user    = users.find(u => u.id === request.userId);

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    // Build the seller updates
    const sellerUpdates = {
        role:              ROLES.SELLER,
        storeName:         request.storeName,
        storeDescription:  request.description,
        category:          request.category,
        city:              request.city,
        phone:             request.phone,
        paymentMethod:     request.paymentMethod,
        sellerApprovedAt:  new Date().toISOString()
    };

    // FIX: Use updateItem → PUT to MockAPI for just this user
    // Old code: setLS(KEY_USERS, users) → POST all users → duplicates
    updateItem(KEY_USERS, user.id, sellerUpdates);

    // Remove request from pending list
    requests.splice(requestIndex, 1);
    setLS(KEY_APPROVAL, requests);

    return { success: true };
}

export function rejectCustomerSellerRequest(requestId) {
    const requests = getLS(KEY_APPROVAL) || [];
    const index    = requests.findIndex(r => r.id === requestId);

    if (index === -1) return { success: false, error: 'Request not found' };

    const request = requests[index];

    // Save outcome for the user to see on their homepage
    const outcomes = getLS(KEY_SELLER_OUTCOMES) || [];
    outcomes.push({
        userId:    request.userId,
        storeName: request.storeName,
        status:    'rejected',
        at:        new Date().toISOString()
    });
    setLS(KEY_SELLER_OUTCOMES, outcomes);

    // Remove from pending
    requests.splice(index, 1);
    setLS(KEY_APPROVAL, requests);

    return { success: true };
}


// ─── EXPORTS ─────────────────────────────────────────────────

export { ROLES };
