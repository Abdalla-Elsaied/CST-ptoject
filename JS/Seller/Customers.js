import { getLS } from '../Core/FileStorage.js';
import { KEY_USERS } from '../Core/Constants.js';

const searchInput = document.getElementById('customerSearchInput');
const roleFilter = document.getElementById('roleFilter');
const sortFilter = document.getElementById('sortFilter');
const tableBody = document.getElementById('customersTableBody');
const emptyState = document.getElementById('customersEmpty');
const exportBtn = document.getElementById('exportCustomersBtn');

const stats = {
  totalCustomers: document.getElementById('statTotalCustomers'),
  newCustomers: document.getElementById('statNewCustomers'),
  totalUsers: document.getElementById('statTotalUsers'),
  totalSellers: document.getElementById('statTotalSellers')
};

let users = [];

function safeLower(value) {
  return String(value ?? '').trim().toLowerCase();
}

function loadUsers() {
  const stored = getLS(KEY_USERS);
  if (Array.isArray(stored)) return stored;
  return [];
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

function handleExport() {
  const payload = {
    generatedAt: new Date().toISOString(),
    users
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'customers.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function init() {
  users = loadUsers();
  computeStats();
  renderTable();
}

searchInput.addEventListener('input', renderTable);
roleFilter.addEventListener('change', renderTable);
sortFilter.addEventListener('change', renderTable);

if (exportBtn) exportBtn.addEventListener('click', handleExport);

init();
