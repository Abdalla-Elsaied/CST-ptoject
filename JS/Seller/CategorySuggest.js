/**
 * CategorySuggest.js — Isolated module for Seller category suggestions.
 * Sellers suggest new categories; Admin approves in Admin panel.
 * Categories go live only after admin approval (visibility: 'active').
 * Does NOT modify CategoryPage.js or any other existing files.
 */

import { KEY_CATEGORIES } from "../Core/Constants.js";

function getCategories() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_CATEGORIES));
    if (Array.isArray(parsed)) return parsed;
  } catch (_e) {}
  return [];
}

function saveCategories(cats) {
  localStorage.setItem(KEY_CATEGORIES, JSON.stringify(cats));
}

function formatDate(val = new Date()) {
  const d = val instanceof Date ? val : new Date();
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function renderPendingList() {
  const list = document.getElementById("pendingList");
  if (!list) return;

  const categories = getCategories();
  const pending = categories.filter((c) => c.visibility === "draft");

  if (pending.length === 0) {
    list.innerHTML = '<p class="empty-state">No pending suggestions. Use the form above to suggest a new category.</p>';
    return;
  }

  list.innerHTML = pending
    .map(
      (cat) => `
    <div class="pending-item">
      <div class="pending-info">
        <strong>${escapeHtml(cat.name)}</strong>
        ${cat.description ? `<span class="pending-desc">${escapeHtml(cat.description)}</span>` : ""}
        <span class="pending-date">${escapeHtml(cat.updated || "")}</span>
      </div>
      <span class="badge badge-pending">Pending</span>
    </div>
  `
    )
    .join("");
}

function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function init() {
  const form = document.getElementById("suggestForm");
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const nameEl = document.getElementById("suggestNameInput");
      const descEl = document.getElementById("suggestDescInput");
      const name = (nameEl?.value || "").trim();
      if (!name) {
        nameEl?.focus();
        return;
      }

      const categories = getCategories();
      const exists = categories.some((c) => (c.name || "").toLowerCase() === name.toLowerCase());
      if (exists) {
        alert("A category with this name already exists.");
        return;
      }

      categories.unshift({
        id: `cat-${Date.now()}`,
        name,
        visibility: "draft",
        description: (descEl?.value || "").trim(),
        products: 0,
        updated: formatDate()
      });
      saveCategories(categories);

      nameEl.value = "";
      if (descEl) descEl.value = "";
      renderPendingList();
      nameEl.focus();
    };
  }

  renderPendingList();
}

document.addEventListener("DOMContentLoaded", init);
