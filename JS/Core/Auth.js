// auth.js
import {
  KEY_USERS,
  KEY_CURRENT_USER,
  KEY_CART,
  KEY_APPROVAL,
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
  SELLER: 'seller',
  ADMIN: 'admin',
};

const LOGIN_URL = '/Html/Customer/Login.html';
const CUSTOMER_HOME_URL = '/Html/Customer/Home.html';
const SELLER_HOME_URL = '/Html/Seller/SellerHomePage.html';
const ADMIN_HOME_URL = '/Html/Admin/admin-panel.html';

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
  window.location.href = LOGIN_URL;
}

/**
 * Get currently logged in user (or null)
 * @returns {object | null}
 */


/**
 * Protect pages by required roles
 * Call this at the VERY TOP of protected page scripts
 * @param {string[]} allowedRoles
 * @returns {boolean} true if access granted
 */
export function requireRole(allowedRoles) {
  const user = getCurrentUser();

  if (!user) {
    window.location.href = LOGIN_URL;
    return false;
  }

  if (!allowedRoles.includes(user.role)) {
    switch (user.role) {
      case ROLES.ADMIN:
        window.location.href = ADMIN_HOME_URL;
        break;
      case ROLES.SELLER:
        window.location.href = SELLER_HOME_URL;
        break;
      case ROLES.CUSTOMER:
      default:
        window.location.href = CUSTOMER_HOME_URL;
        break;
    }
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

export function getCurrentUser() {
  return getLS(KEY_CURRENT_USER) || null;
}

export function setCurrentUser(user) {
  setLS(KEY_CURRENT_USER, user);
}

export function addCustomerToSeller(userId, storeData) {

  const requests = getLS(KEY_APPROVAL) || [];

  // prevent duplicate requests
  const alreadyRequested = requests.some(r => r.userId === userId && r.status === "pending");

  if (alreadyRequested) {
    return { success: false, error: "You already submitted a request" };
  }

  // check store name uniqueness
  const users = getLS(KEY_USERS) || [];
  const nameExists = users.some(u => u.storeName?.toLowerCase() === storeData.storeName.toLowerCase()) ||
    requests.some(r => r.storeName?.toLowerCase() === storeData.storeName.toLowerCase());

  if (nameExists) {
    return { success: false, error: "Store name is already taken. Please choose another." };
  }

  const newRequest = {
    id: "req-" + Date.now().toString().slice(2, 9),
    userId,
    ...storeData,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  setLS(KEY_APPROVAL, [...requests, newRequest]);

  return { success: true, request: newRequest };
}

export function getAllCustomerToApproved() {
  return getLS(KEY_APPROVAL) || [];
}

export function acceptCustomerSellerRequest(requestId) {

  const requests = getLS(KEY_APPROVAL) || [];

  const requestIndex = requests.findIndex(r => {
    console.log("Checking request ID:", r.id);
    console.log("request id: ", requestId);
    return r.id === requestId;
  });
  if (requestIndex === -1) {
    console.log("Request not found")
    return { success: false, error: "Request not found" };
  }

  const request = requests[requestIndex];

  // get users
  const users = getLS(KEY_USERS) || [];
  const userIndex = users.findIndex(u => u.id === request.userId);

  if (userIndex === -1) {
    console.log("User not found")
    return { success: false, error: "User not found" };

  }

  console.log(users[userIndex])
  // update user role to seller
  users[userIndex].role = ROLES.SELLER;

  // attach seller/store info from request
  users[userIndex].storeName = request.storeName;
  users[userIndex].storeDescription = request.description;
  users[userIndex].category = request.category;
  users[userIndex].city = request.city;
  users[userIndex].phone = request.phone;
  users[userIndex].paymentMethod = request.paymentMethod;

  // optional timestamp
  users[userIndex].sellerApprovedAt = new Date().toISOString();

  // save updated users
  setLS(KEY_USERS, users);

  // remove request from pending approvals
  requests.splice(requestIndex, 1);
  setLS(KEY_APPROVAL, requests);

  return { success: true };
}

export function rejectCustomerSellerRequest(requestId) {
  const requests = getLS(KEY_APPROVAL) || [];
  const index = requests.findIndex(r => r.id === requestId);

  if (index === -1) return { success: false, error: "Request not found" };

  requests.splice(index, 1);
  setLS(KEY_APPROVAL, requests);
  return { success: true };
}

// ────────────────────────────────────────────────
//  Optional: Export roles if needed in other files
// ────────────────────────────────────────────────
export { ROLES };
