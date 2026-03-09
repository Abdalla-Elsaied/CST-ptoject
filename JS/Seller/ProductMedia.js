let products = [];
let filter = "all";
let search = "";

function readProductsFromStorage() {
  const keys = ["ls_products", "products", "sellerProducts"];
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch (_err) {
      // ignore bad data and continue
    }
  }
  return [];
}

function defaultImage(name) {
  const safe = encodeURIComponent(name || "Product");
  return `https://placehold.co/800x600/ecfdf5/166534?text=${safe}`;
}

function normalizeMedia(rawProduct, idx) {
  const name = String(rawProduct?.productName ?? rawProduct?.name ?? `Product ${idx + 1}`).trim();
  const id = String(rawProduct?.id ?? idx + 1);
  const images = [];
  const videos = [];

  if (Array.isArray(rawProduct?.images)) {
    rawProduct.images.forEach((item) => {
      if (typeof item === "string" && item.trim()) images.push(item.trim());
      if (item && typeof item === "object" && typeof item.url === "string" && item.url.trim()) {
        const type = String(item.type ?? "").toLowerCase();
        if (type.includes("video")) videos.push(item.url.trim());
        else images.push(item.url.trim());
      }
    });
  }

  if (typeof rawProduct?.image === "string" && rawProduct.image.trim()) images.push(rawProduct.image.trim());
  if (typeof rawProduct?.imageUrl === "string" && rawProduct.imageUrl.trim()) images.push(rawProduct.imageUrl.trim());

  if (Array.isArray(rawProduct?.videos)) {
    rawProduct.videos.forEach((v) => {
      if (typeof v === "string" && v.trim()) videos.push(v.trim());
      if (v && typeof v === "object" && typeof v.url === "string" && v.url.trim()) videos.push(v.url.trim());
    });
  }

  if (typeof rawProduct?.video === "string" && rawProduct.video.trim()) videos.push(rawProduct.video.trim());
  if (typeof rawProduct?.videoUrl === "string" && rawProduct.videoUrl.trim()) videos.push(rawProduct.videoUrl.trim());

  const uniqueImages = [...new Set(images)];
  const uniqueVideos = [...new Set(videos)];
  const totalMedia = uniqueImages.length + uniqueVideos.length;

  return {
    id,
    name,
    images: uniqueImages,
    videos: uniqueVideos,
    totalMedia,
    cover: uniqueImages[0] || defaultImage(name)
  };
}

function loadProducts() {
  const raw = readProductsFromStorage();
  products = raw.map((p, i) => normalizeMedia(p, i));
}

function updateStats(currentList) {
  const imageCount = currentList.reduce((sum, p) => sum + p.images.length, 0);
  const videoCount = currentList.reduce((sum, p) => sum + p.videos.length, 0);
  const noMediaCount = currentList.filter((p) => p.totalMedia === 0).length;
  document.getElementById("totalAssets").innerText = imageCount + videoCount;
  document.getElementById("totalImages").innerText = imageCount;
  document.getElementById("totalVideos").innerText = videoCount;
  document.getElementById("emptyMedia").innerText = noMediaCount;
}

function getFilteredData() {
  let data = [...products];

  if (filter === "with-media") data = data.filter((p) => p.totalMedia > 0);
  if (filter === "no-media") data = data.filter((p) => p.totalMedia === 0);
  if (search) data = data.filter((p) => p.name.toLowerCase().includes(search));

  return data;
}

function renderTable() {
  const data = getFilteredData();
  const tbody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");

  if (data.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
    updateStats([]);
    return;
  }

  emptyState.style.display = "none";

  tbody.innerHTML = data
    .map((p, i) => {
      const hasMedia = p.totalMedia > 0;
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${p.name}</td>
          <td>${p.images.length}</td>
          <td>${p.videos.length}</td>
          <td><span class="badge ${hasMedia ? "ok" : "missing"}">${hasMedia ? "Ready" : "Missing"}</span></td>
          <td><button class="link-btn" onclick="openMedia('${p.id}')">View Media</button></td>
        </tr>
      `;
    })
    .join("");

  updateStats(data);
}

function openMedia(productId) {
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) return;

  const gallery = document.getElementById("modalGallery");
  document.getElementById("modalTitle").innerText = `${product.name} - Media`;

  const imageCards = product.images.map(
    (url) => `
      <div class="media-card">
        <img src="${url}" alt="${product.name}">
        <div class="media-meta">Image</div>
      </div>
    `
  );

  const videoCards = product.videos.map(
    (url) => `
      <div class="media-card">
        <video controls preload="metadata" src="${url}"></video>
        <div class="media-meta">Video</div>
      </div>
    `
  );

  const cards = [...imageCards, ...videoCards];
  gallery.innerHTML =
    cards.length > 0
      ? cards.join("")
      : `<div class="empty">No media found for this product.</div>`;

  document.getElementById("mediaModal").style.display = "flex";
}

function closeMediaModal(event) {
  if (event && event.target && event.target.id !== "mediaModal") return;
  document.getElementById("mediaModal").style.display = "none";
}

function setFilter(nextFilter, tabEl) {
  filter = nextFilter;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  if (tabEl) tabEl.classList.add("active");
  renderTable();
}

function searchProducts(value) {
  search = String(value || "").toLowerCase().trim();
  renderTable();
}

function seedMediaForDemo() {
  const raw = readProductsFromStorage();
  if (!Array.isArray(raw) || raw.length === 0) return;

  const demoVideo = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  const updated = raw.map((item, idx) => {
    const name = item?.productName ?? item?.name ?? `Product ${idx + 1}`;
    const images = Array.isArray(item?.images) ? [...item.images] : [];
    if (!images.length) images.push(defaultImage(name));
    if (idx % 4 === 0) images.push(`https://placehold.co/900x700/dcfce7/14532d?text=${encodeURIComponent(name + " Alt")}`);
    const next = { ...item, images };
    if (idx % 5 === 0) next.videos = [demoVideo];
    return next;
  });

  if (localStorage.getItem("ls_products")) localStorage.setItem("ls_products", JSON.stringify(updated));
  else if (localStorage.getItem("products")) localStorage.setItem("products", JSON.stringify(updated));
  else localStorage.setItem("ls_products", JSON.stringify(updated));

  loadProducts();
  renderTable();
}

loadProducts();
renderTable();

window.openMedia = openMedia;
window.closeMediaModal = closeMediaModal;
window.setFilter = setFilter;
window.searchProducts = searchProducts;
window.seedMediaForDemo = seedMediaForDemo;
