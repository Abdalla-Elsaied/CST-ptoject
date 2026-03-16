import { getLS, initUsers } from '../Core/Storage.js';
import { KEY_USERS, KEY_ORDERS, KEY_PRODUCTS } from '../Core/Constants.js';
import { getCurrentUser, requireRole, ROLES } from '../Core/Auth.js';

const searchInput = document.getElementById('customerSearchInput');
const roleFilter = document.getElementById('roleFilter');
const sortFilter = document.getElementById('sortFilter');
const tableBody = document.getElementById('customersTableBody');
const emptyState = document.getElementById('customersEmpty');

const stats = {
  totalCustomers: document.getElementById('statTotalCustomers'),
  newCustomers: document.getElementById('statNewCustomers'),
  totalUsers: document.getElementById('statTotalUsers'),
  totalSellers: document.getElementById('statTotalSellers')
};

const hasAccess = requireRole([ROLES.SELLER]);
const currentUser = getCurrentUser();
const sellerId = currentUser?.id ? String(currentUser.id) : '';

if (!hasAccess || !sellerId) {
  throw new Error('Seller access required.');
}

let users = [];
let productSellerMap = new Map();

function safeLower(value) {
  return String(value ?? '').trim().toLowerCase();
}

function loadOrders() {
  const stored = getLS(KEY_ORDERS);
  return Array.isArray(stored) ? stored : [];
}

function buildProductSellerMap() {
  const keys = [KEY_PRODUCTS, 'products', 'sellerProducts'];
  const map = new Map();
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((p) => {
        const id = String(p?.id ?? p?.productId ?? p?.product_id ?? '').trim();
        if (!id || map.has(id)) return;
        const sid = String(p?.sellerId ?? p?.seller_id ?? p?.seller?.id ?? '').trim();
        if (sid) map.set(id, sid);
      });
    } catch (_err) {
    }
  }
  return map;
}

function getOrderItems(order) {
  if (Array.isArray(order?.products) && order.products.length) return order.products;
  if (Array.isArray(order?.items) && order.items.length) return order.items;
  return [];
}

function getItemSellerId(item) {
  const direct = String(item?.sellerId ?? item?.seller_id ?? item?.seller?.id ?? '').trim();
  if (direct) return direct;
  const pid = String(item?.id ?? item?.productId ?? item?.product_id ?? '').trim();
  if (!pid) return '';
  return productSellerMap.get(pid) || '';
}

function orderBelongsToSeller(order) {
  if (!order) return false;
  if (String(order?.sellerId ?? '') === sellerId) return true;
  const items = getOrderItems(order);
  return items.some((item) => getItemSellerId(item) === sellerId);
}

function getSellerCustomerIds() {
  const orders = loadOrders();
  const ids = new Set();
  orders.forEach((order) => {
    if (!orderBelongsToSeller(order)) return;
    const cid = order?.customerId ?? order?.userId ?? order?.user?.id ?? null;
    if (cid) ids.add(String(cid));
  });
  return ids;
}

function loadUsers() {
  const stored = getLS(KEY_USERS);
  if (!Array.isArray(stored)) return [];
  const allowedIds = getSellerCustomerIds();
  if (!allowedIds.size) return [];
  return stored.filter((u) => u.role === 'customer' && allowedIds.has(String(u.id)));
}

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CU';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function parseDate(value) {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function computeStats() {
  const totalUsers = users.length;
  const customers = users.filter((u) => u.role === 'customer');
  const sellers = users.filter((u) => u.role === 'seller');

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newCustomers = customers.filter((u) => {
    const createdAt = parseDate(u.createdAt);
    return createdAt && createdAt >= thirtyDaysAgo;
  }).length;

  stats.totalCustomers.textContent = String(customers.length);
  stats.newCustomers.textContent = String(newCustomers);
  stats.totalUsers.textContent = String(totalUsers);
  stats.totalSellers.textContent = String(sellers.length);
}

function sortUsers(list, mode) {
  const sorted = list.slice();
  if (mode === 'oldest') {
    sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (mode === 'name-az') {
    sorted.sort((a, b) => safeLower(a.name).localeCompare(safeLower(b.name)));
  } else if (mode === 'name-za') {
    sorted.sort((a, b) => safeLower(b.name).localeCompare(safeLower(a.name)));
  } else {
    sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }
  return sorted;
}

function renderTable() {
  const query = safeLower(searchInput.value);
  const role = roleFilter.value;
  const sortMode = sortFilter.value;

  let list = users.slice();
  if (role !== 'all') {
    list = list.filter((u) => safeLower(u.role) === role);
  }

  if (query) {
    list = list.filter((u) => {
      const haystack = [u.name, u.fullName, u.email].map(safeLower).join(' ');
      return haystack.includes(query);
    });
  }

  list = sortUsers(list, sortMode);

  if (!list.length) {
    tableBody.innerHTML = '';
    emptyState.classList.remove('d-none');
    return;
  }

  emptyState.classList.add('d-none');

  tableBody.innerHTML = list.map((user) => {
    const name = user.name || user.fullName || 'Customer';
    const email = user.email || '-';
    const roleText = user.role || 'customer';
    const store = user.storeName || '-';
    const joined = formatDate(user.createdAt);
    const initials = initialsFromName(name);

    return `
      <tr>
        <td>
          <div class="customer-cell">
            <div class="customer-avatar">${initials}</div>
            <span>${name}</span>
          </div>
        </td>
        <td>${email}</td>
        <td><span class="role-badge ${roleText}">${roleText}</span></td>
        <td>${store}</td>
        <td>${joined}</td>
      </tr>
    `;
  }).join('');
}

async function init() {
  await initUsers();
  productSellerMap = buildProductSellerMap();
  users = loadUsers();
  computeStats();
  renderTable();
}

searchInput.addEventListener('input', renderTable);
roleFilter.addEventListener('change', renderTable);
sortFilter.addEventListener('change', renderTable);


init();


