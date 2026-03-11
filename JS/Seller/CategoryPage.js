import { KEY_CATEGORIES, KEY_PRODUCTS } from "../Core/Constants.js";

const seedCategories = [
  { id: "cat-1", name: "Women Fashion", products: 214, visibility: "active", updated: "Mar 06, 2026", description: "" },
  { id: "cat-2", name: "Men Essentials", products: 162, visibility: "active", updated: "Mar 02, 2026", description: "" },
  { id: "cat-3", name: "Beauty & Care", products: 88, visibility: "hidden", updated: "Feb 28, 2026", description: "" },
  { id: "cat-4", name: "Electronics", products: 132, visibility: "active", updated: "Mar 08, 2026", description: "" },
  { id: "cat-5", name: "Home & Living", products: 104, visibility: "draft", updated: "Feb 22, 2026", description: "" },
  { id: "cat-6", name: "Shoes", products: 96, visibility: "active", updated: "Mar 01, 2026", description: "" }
];

const loadCategories = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_CATEGORIES));
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (_err) {
  }
  localStorage.setItem(KEY_CATEGORIES, JSON.stringify(seedCategories));
  return [...seedCategories];
};

let categories = loadCategories();

const tableBody = document.getElementById("categoryTable");
const searchInput = document.getElementById("searchInput");
const filterChips = document.querySelectorAll(".chip");
const stats = {
  total: document.getElementById("statTotal"),
  active: document.getElementById("statActive"),
  hidden: document.getElementById("statHidden"),
  products: document.getElementById("statProducts")
};

const modal = document.getElementById("categoryModal");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const exportBtn = document.getElementById("exportBtn");
const categoryNameInput = document.getElementById("categoryNameInput");
const categoryVisibilityInput = document.getElementById("categoryVisibilityInput");
const categoryDescInput = document.getElementById("categoryDescInput");
const themeToggleBtn = document.getElementById("themeToggle");
const sidebar = document.getElementById("sidebar");
const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");
const mobileSidebarBtn = document.getElementById("mobileSidebarBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");

let currentFilter = "all";
let currentQuery = "";
let editingId = null;
let viewOnly = false;
const THEME_STORAGE_KEY = "seller_theme";

const applyStoredTheme = () => {
  try {
    if (localStorage.getItem(THEME_STORAGE_KEY) === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  } catch (_err) {
  }
};

const persistTheme = () => {
  try {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      document.body.classList.contains("dark") ? "dark" : "light"
    );
  } catch (_err) {
  }
};

const renderStats = () => {
  const products = getStoredProducts();
  stats.total.textContent = categories.length;
  stats.active.textContent = categories.filter((cat) => cat.visibility === "active").length;
  stats.hidden.textContent = categories.filter((cat) => cat.visibility === "hidden").length;
  stats.products.textContent = products.length;
};

const getStoredProducts = () => {
  const keys = [KEY_PRODUCTS, "products", "sellerProducts"];
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(parsed)) return parsed;
    } catch (_err) {
    }
  }
  return [];
};

const renderTable = () => {
  const filtered = categories.filter((cat) => {
    const matchesFilter = currentFilter === "all" || cat.visibility === currentFilter;
    const matchesSearch = cat.name.toLowerCase().includes(currentQuery);
    return matchesFilter && matchesSearch;
  });

  tableBody.innerHTML = filtered
    .map((cat) => {
      return `
        <tr>
          <td>
            <div class="cat-name">
              <span class="cat-dot"></span>
              ${cat.name}
            </div>
          </td>
          <td>${cat.products}</td>
          <td><span class="badge ${cat.visibility}">${cat.visibility}</span></td>
          <td>${cat.updated}</td>
          <td class="text-end">
            <div class="actions actions-end">
              <button class="action-btn" data-action="products" data-id="${cat.id}">Products</button>
              <button class="action-btn" data-action="edit" data-id="${cat.id}">Edit</button>
              <button class="action-btn" data-action="view" data-id="${cat.id}">View</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
};

const persistCategories = () => {
  localStorage.setItem(KEY_CATEGORIES, JSON.stringify(categories));
};

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date();
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const openModal = (options = {}) => {
  const { mode = "add", category = null } = options;
  editingId = category?.id ?? null;
  viewOnly = mode === "view";

  document.getElementById("modalTitle").textContent =
    mode === "edit" ? "Edit Category" : mode === "view" ? "View Category" : "Add Category";

  categoryNameInput.value = category?.name ?? "";
  categoryVisibilityInput.value = category?.visibility ?? "active";
  categoryDescInput.value = category?.description ?? "";

  categoryNameInput.disabled = viewOnly;
  categoryVisibilityInput.disabled = viewOnly;
  categoryDescInput.disabled = viewOnly;
  saveCategoryBtn.textContent = viewOnly ? "Close" : "Save";

  modal.classList.add("show");
};

const closeModal = () => {
  modal.classList.remove("show");
  editingId = null;
  viewOnly = false;
};

const handleSave = () => {
  if (viewOnly) {
    closeModal();
    return;
  }

  const name = categoryNameInput.value.trim();
  if (!name) {
    categoryNameInput.focus();
    return;
  }

  const visibility = categoryVisibilityInput.value;
  const description = categoryDescInput.value.trim();

  if (editingId) {
    categories = categories.map((cat) =>
      cat.id === editingId
        ? { ...cat, name, visibility, description, updated: formatDate(new Date()) }
        : cat
    );
  } else {
    categories.unshift({
      id: `cat-${Date.now()}`,
      name,
      visibility,
      description,
      products: 0,
      updated: formatDate(new Date())
    });
  }

  persistCategories();
  renderStats();
  renderTable();
  closeModal();
};

const handleExport = () => {
  const blob = new Blob([JSON.stringify(categories, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "categories.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const syncThemeIcon = () => {
  const icon = themeToggleBtn?.querySelector("i");
  if (!icon) return;
  const isDark = document.body.classList.contains("dark");
  icon.classList.toggle("bi-sun", !isDark);
  icon.classList.toggle("bi-moon", isDark);
};

const toggleTheme = () => {
  document.body.classList.toggle("dark");
  syncThemeIcon();
  persistTheme();
};

if (themeToggleBtn) {
  applyStoredTheme();
  themeToggleBtn.addEventListener("click", toggleTheme);
  syncThemeIcon();
}

window.addEventListener("storage", (event) => {
  if (event.key === THEME_STORAGE_KEY) {
    applyStoredTheme();
    syncThemeIcon();
  }
});

if (sidebarCollapseBtn && sidebar) {
  sidebarCollapseBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
}

if (mobileSidebarBtn && sidebarOverlay && sidebar) {
  mobileSidebarBtn.addEventListener("click", () => {
    sidebar.classList.add("mobile-open");
    sidebarOverlay.classList.add("active");
  });

  sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.remove("mobile-open");
    sidebarOverlay.classList.remove("active");
  });
}

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((btn) => btn.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderTable();
  });
});

searchInput.addEventListener("input", (event) => {
  currentQuery = event.target.value.trim().toLowerCase();
  renderTable();
});

const applySearchFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const searchParam = String(params.get("search") || "").trim();
    if (!searchParam) return;
    currentQuery = searchParam.toLowerCase();
    if (searchInput) searchInput.value = searchParam;
  } catch (_err) {
  }
};

addCategoryBtn.addEventListener("click", () => openModal({ mode: "add" }));
cancelModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

saveCategoryBtn.addEventListener("click", handleSave);

tableBody.addEventListener("click", (event) => {
  const btn = event.target.closest(".action-btn");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const category = categories.find((cat) => cat.id === id);
  if (!category) return;

  if (action === "edit") {
    openModal({ mode: "edit", category });
  }

  if (action === "view") {
    openModal({ mode: "view", category });
  }

  if (action === "products") {
    const categoryName = category?.name?.trim();
    if (!categoryName) return;
    const encoded = encodeURIComponent(categoryName);
    window.location.href = `./ProductList.html?category=${encoded}`;
  }
});

if (exportBtn) {
  exportBtn.addEventListener("click", handleExport);
}

renderStats();
applySearchFromUrl();
renderTable();
