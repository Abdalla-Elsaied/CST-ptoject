import { KEY_CATEGORIES } from "../Core/Constants.js";
import { getLS, setLS } from "../Core/Storage.js";
import { getCurrentUser } from "../Core/Auth.js";

function formatDate(val = new Date()) {
  const d = val instanceof Date ? val : new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function renderPendingList() {
  const list = document.getElementById("pendingList");
  if (!list) return;

  const categories = getLS(KEY_CATEGORIES) || [];
  const currentUser = getCurrentUser();
  const sellerId = currentUser?.id;

  // Only show drafts suggested by THIS seller
  const pending = categories.filter((c) => 
    c.visibility === "draft" && 
    c.source === "seller" && 
    String(c.suggestedBy) === String(sellerId)
  );

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
        <span class="pending-date">Suggested: ${escapeHtml(cat.updated || "")}</span>
      </div>
      <span class="badge badge-pending">Pending Approval</span>
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
  const currentUser = getCurrentUser();
  if (!currentUser) return;

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

      const categories = getLS(KEY_CATEGORIES) || [];
      
      // Block duplicate name (case-insensitive)
      const exists = categories.some((c) => (c.name || "").toLowerCase() === name.toLowerCase());
      if (exists) {
        alert("A category with this name already exists or is pending review.");
        return;
      }

      const newSuggestion = {
        id:          `cat-${Date.now()}`,
        name:        name,
        description: (descEl?.value || "").trim(),
        visibility:  "draft",
        source:      "seller",
        suggestedBy: currentUser.id,
        products:    0,
        updated:     formatDate(),
        createdAt:   new Date().toISOString()
      };

      categories.unshift(newSuggestion);
      setLS(KEY_CATEGORIES, categories);

      if (window.showToast) {
        window.showToast("Category suggestion submitted!", "success");
      } else {
        alert("Category suggestion submitted! Admin will review it soon.");
      }

      nameEl.value = "";
      if (descEl) descEl.value = "";
      renderPendingList();
      nameEl.focus();
    };
  }

  renderPendingList();
}

document.addEventListener("DOMContentLoaded", init);
