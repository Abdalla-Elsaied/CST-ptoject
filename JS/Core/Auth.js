// auth.js
import {
  KEY_USERS,
  KEY_CURRENT_USER,
  KEY_CART,
} from './Constants.js';

import {
  getLS,
  setLS,
  removeLS,
} from './Storage.js';

// ────────────────────────────────────────────────
//  Static role definitions (all role logic in one place)
// ────────────────────────────────────────────────

const ROLES = {
  CUSTOMER: 'customer',
  SELLER:   'seller',
  ADMIN:    'admin',
};

const ALLOWED_SELF_REGISTER_ROLES = [
  ROLES.CUSTOMER,           // only customers can self-register
];

const ALL_VALID_ROLES = [
  ROLES.CUSTOMER,
  ROLES.SELLER,
  ROLES.ADMIN,
];

// ────────────────────────────────────────────────
//  Private helpers
// ────────────────────────────────────────────────

function generateId() {
  return 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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

// ────────────────────────────────────────────────
//  Public Auth Functions
// ────────────────────────────────────────────────

/**
 * Register a new CUSTOMER only (self-registration)
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export function registerUser(name, email, password) {
  if (!isValidName(name)) {
    return { success: false, error: 'Name is required' };
  }
  if (!isValidEmail(email)) {
    return { success: false, error: 'Invalid email format' };
  }
  if (!isValidPassword(password)) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  const users = getLS(KEY_USERS) || [];

  const normalizedEmail = normalizeEmail(email);
  if (users.some(u => u.email === normalizedEmail)) {
    return { success: false, error: 'Email already registered' };
  }

  const newUser = {
    id: generateId(),
    name: name.trim(),
    email: normalizedEmail,
    password,                   // IMPORTANT: In a real app → hash this!
    role: ROLES.CUSTOMER,
    createdAt: new Date().toISOString(),
  };

  setLS(KEY_USERS, [...users, newUser]);

  return { success: true, user: newUser };
}

/**
 * Admin-only: create any type of user (customer, seller, admin)
 * @param {object} currentUser - must be an admin
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {string} role - one of ALL_VALID_ROLES
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export function adminCreateUser(currentUser, name, email, password, role) {
  if (!currentUser || currentUser.role !== ROLES.ADMIN) {
    return { success: false, error: 'Only admins can create users' };
  }

  if (!ALL_VALID_ROLES.includes(role)) {
    return { success: false, error: `Invalid role. Allowed: ${ALL_VALID_ROLES.join(', ')}` };
  }

  if (!isValidName(name)) {
    return { success: false, error: 'Invalid name' };
  }
  if (!isValidEmail(email)) {
    return { success: false, error: 'Invalid email format' };
  }
  if (!isValidPassword(password)) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  const users = getLS(KEY_USERS) || [];
  const normalizedEmail = normalizeEmail(email);

  if (users.some(u => u.email === normalizedEmail)) {
    return { success: false, error: 'Email already exists' };
  }

  const newUser = {
    id: generateId(),
    name: name.trim(),
    email: normalizedEmail,
    password,                   // IMPORTANT: In a real app → hash this!
    role,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.id,  // optional audit trail
  };

  setLS(KEY_USERS, [...users, newUser]);

  return { success: true, user: newUser };
}

/**
 * Log in user and set current session
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, role?: string, error?: string }}
 */
export function loginUser(email, password) {
  const users = getLS(KEY_USERS) || [];
  const normalizedEmail = normalizeEmail(email);

  const user = users.find(u => u.email === normalizedEmail);

  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }

  // In real app: compare hashed password
  if (user.password !== password) {
    return { success: false, error: 'Invalid credentials' };
  }

  setLS(KEY_CURRENT_USER, user);

  return { success: true, role: user.role };
}

/**
 * Log out current user and redirect
 */
export function logoutUser() {
  removeLS(KEY_CURRENT_USER);
  removeLS(KEY_CART);           // optional: clear cart on logout
  window.location.href = 'login.html';
}

/**
 * Get currently logged in user (or null)
 * @returns {object | null}
 */
export function getCurrentUser() {
  return getLS(KEY_CURRENT_USER) || null;
}

/**
 * Protect pages by required roles
 * Call this at the VERY TOP of protected page scripts
 * @param {string[]} allowedRoles
 * @returns {boolean} true if access granted
 */
export function requireRole(allowedRoles) {
  const user = getCurrentUser();

  if (!user) {
    window.location.href = 'login.html';
    return false;
  }

  if (!allowedRoles.includes(user.role)) {
    // You can customize redirect per role if desired
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

/**
 * Update both ls_users and ls_currentUser atomically
 * Solves the "dual-sync / stale session" problem
 * @param {object} updates - e.g. { name: "New Name", phone: "012345" }
 * @returns {boolean} success
 */
export function updateCurrentUserInStorage(updates) {
  const current = getCurrentUser();
  if (!current) return false;

  const users = getLS(KEY_USERS) || [];
  const index = users.findIndex(u => u.id === current.id);

  if (index === -1) {
    console.warn('Current user not found in users list');
    return false;
  }

  const updatedUser = { ...users[index], ...updates };
  users[index] = updatedUser;

  setLS(KEY_USERS, users);
  setLS(KEY_CURRENT_USER, updatedUser);

  return true;
}

/**
 * Helper for customer navbar cart badge
 * @returns {number}
 */
export function getCartCount() {
  const cart = getLS(KEY_CART) || [];
  return cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

// ────────────────────────────────────────────────
//  Optional: Export roles if needed in other files
// ────────────────────────────────────────────────
export { ROLES };