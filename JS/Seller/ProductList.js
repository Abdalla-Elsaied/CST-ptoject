
const STORAGE_KEY = 'products';
const LEGACY_STORAGE_KEY = 'sellerProducts';
const pageSize = 8;
let page = 1;
let filter = 'all';
let search = '';
let categoryFilter = '';
let products = [];
let loadedFromApi = false;

function defaultImage(name){
  const safeName = encodeURIComponent(name || 'Product');
  return `https://placehold.co/600x400/ecfdf5/166534?text=${safeName}`;
}

function toDateValue(raw){
  const parsed = new Date(raw || Date.now());
  if(Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function firstImage(raw){
  if(Array.isArray(raw.images) && raw.images.length){
    const first = raw.images[0];
    if(typeof first === 'string') return first;
    if(first && typeof first.url === 'string') return first.url;
  }
  return raw.image ?? raw.imageUrl ?? raw.productImage ?? defaultImage(raw.productName ?? raw.name ?? '');
}

function formatCategory(value){
  const text = String(value ?? '').trim();
  if(!text) return '-';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getCategoryValue(raw){
  const direct =
    raw.category ??
    raw.productCategory ??
    raw.product_category ??
    raw.categoryName ??
    raw.productCategoryName ??
    raw.type ??
    raw.tag;

  if(Array.isArray(direct)){
    const first = direct[0];
    if(typeof first === 'string') return first;
    if(first && typeof first === 'object'){
      return first.name ?? first.title ?? first.label ?? first.value ?? '';
    }
    return '';
  }

  if(direct && typeof direct === 'object'){
    return direct.name ?? direct.title ?? direct.label ?? direct.value ?? '';
  }

  return direct;
}

function normalizeProduct(raw, idx){
  const categoryValue = getCategoryValue(raw);
  return {
    id: raw.id ?? String(idx + 1),
    name: raw.productName ?? raw.name ?? '',
    category: formatCategory(categoryValue),
    price: Number(raw.price) || 0,
    stock: Number(raw.stockQuantity ?? raw.stock) || 0,
    createdAt: toDateValue(raw.createdAt ?? raw.date),
    views: Number(raw.views) || 0,
    image: firstImage(raw)
  };
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function loadLocalProducts(){
  const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if(Array.isArray(current) && current.length){
    return current.map((item, idx) => {
      const p = normalizeProduct(item, idx);
      return {
        ...item,
        id: p.id,
        productName: p.name,
        stockQuantity: p.stock,
        createdAt: p.createdAt,
        views: p.views,
        image: p.image,
        category: p.category
      };
    });
  }

  const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
  if(Array.isArray(legacy) && legacy.length){
    const migrated = legacy.map((item, idx) => ({
      ...item,
      id: item.id ?? Date.now() + idx,
      productName: item.productName ?? item.name ?? '',
      stockQuantity: Number(item.stockQuantity ?? item.stock) || 0,
      createdAt: toDateValue(item.createdAt ?? item.date),
      views: Number(item.views) || 0,
      image: firstImage(item),
      category: formatCategory(item.category)
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  const seed = [
    {id:Date.now()+1, productName:'Apple iPhone 13', category:'Electronic', price:999, stockQuantity:104, createdAt:toDateValue('2025-09-05'), views:0, image:defaultImage('Apple iPhone 13')},
    {id:Date.now()+2, productName:'Nike Air Jordan', category:'Fashion', price:72.4, stockQuantity:12, createdAt:toDateValue('2025-09-08'), views:0, image:defaultImage('Nike Air Jordan')},
    {id:Date.now()+3, productName:'Wireless Headphones', category:'Electronic', price:49.99, stockQuantity:0, createdAt:toDateValue('2025-09-10'), views:0, image:defaultImage('Wireless Headphones')},
    {id:Date.now()+4, productName:'Smart Fitness Tracker', category:'Electronic', price:39.99, stockQuantity:66, createdAt:toDateValue('2025-09-12'), views:0, image:defaultImage('Smart Fitness Tracker')},
    {id:Date.now()+5, productName:'Leather Wallet', category:'Fashion', price:19.99, stockQuantity:7, createdAt:toDateValue('2025-09-14'), views:0, image:defaultImage('Leather Wallet')},
    {id:Date.now()+6, productName:'Coffee Maker', category:'Home', price:79.99, stockQuantity:25, createdAt:toDateValue('2025-09-17'), views:0, image:defaultImage('Coffee Maker')},
    {id:Date.now()+7, productName:'Memory Foam Pillow', category:'Home', price:39.99, stockQuantity:3, createdAt:toDateValue('2025-09-20'), views:0, image:defaultImage('Memory Foam Pillow')},
    {id:Date.now()+8, productName:'Full HD Webcam', category:'Electronic', price:39.99, stockQuantity:31, createdAt:toDateValue('2025-09-22'), views:0, image:defaultImage('Full HD Webcam')},
    {id:Date.now()+9, productName:'Casual Baseball Cap', category:'Fashion', price:14.99, stockQuantity:54, createdAt:toDateValue('2025-09-25'), views:0, image:defaultImage('Casual Baseball Cap')},
    {id:Date.now()+10, productName:'Electric Hair Trimmer', category:'Beauty', price:34.99, stockQuantity:0, createdAt:toDateValue('2025-09-27'), views:0, image:defaultImage('Electric Hair Trimmer')}
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

async function loadProducts(){
  try{
    const storage = await import('../Core/FileStorage.js');
    const remote = await storage.loadProductsFromFolder();
    if(Array.isArray(remote) && remote.length){
      products = remote.map((item, idx) => {
        const p = normalizeProduct(item, idx);
        return {
          ...item,
          id: p.id,
          productName: p.name,
          stockQuantity: p.stock,
          createdAt: p.createdAt,
          views: p.views,
          image: p.image,
          category: p.category
        };
      });
      loadedFromApi = true;
      save();
      return;
    }
  }catch(_err){
    // keep local fallback when API/network is unavailable
  }

  loadedFromApi = false;
  products = loadLocalProducts();
}

function getStatus(stock){
  if(stock <= 0) return 'Out of Stock';
  if(stock <= 10) return 'Low Stock';
  return 'In Stock';
}

function statusClass(status){
  if(status === 'In Stock') return 'in-stock';
  if(status === 'Low Stock') return 'low-stock';
  return 'out-stock';
}

function updateCards(){
  const normalized = products.map((p, idx) => normalizeProduct(p, idx));
  document.getElementById('totalProducts').innerText = normalized.length;
  document.getElementById('inStock').innerText = normalized.filter(p => getStatus(p.stock) === 'In Stock').length;
  document.getElementById('lowStock').innerText = normalized.filter(p => getStatus(p.stock) === 'Low Stock').length;
  document.getElementById('outStock').innerText = normalized.filter(p => getStatus(p.stock) === 'Out of Stock').length;
}

function render(){
  let data = products.map((p, idx) => normalizeProduct(p, idx));
  if(categoryFilter){
    const wantedCategory = categoryFilter.toLowerCase();
    data = data.filter((p) => {
      const productCategory = String(p.category || '').trim().toLowerCase();
      if(wantedCategory === 'other'){
        return !productCategory || productCategory === '-' || productCategory === 'n/a' || productCategory === 'none';
      }
      return productCategory === wantedCategory;
    });
  }
  if(filter !== 'all') data = data.filter(p => getStatus(p.stock) === filter);
  if(search) data = data.filter(p => p.name.toLowerCase().includes(search));

  const start = (page - 1) * pageSize;
  const paginated = data.slice(start, start + pageSize);

  let html = '';
  paginated.forEach((p, i) => {
    const status = getStatus(p.stock);
    const numericId = String(p.id).replace(/\D/g, '').slice(-6).padStart(4, '0');
    const safeId = String(p.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    html += `
      <tr class="clickable-row" onclick="openProductDetails('${safeId}')">
        <td>${start + i + 1}</td>
        <td>#PRD${numericId}</td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td class="price">$${p.price.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td><span class="stock ${statusClass(status)}"><span class="dot"></span>${status}</span></td>
        <td>
          <button class="btn btn-update" onclick="goToUpdateProductPage(event, '${safeId}')">Update</button>
          <button class="btn btn-delete" onclick="deleteProduct(event, '${safeId}')">Delete</button>
        </td>
      </tr>
    `;
  });

  document.getElementById('tableBody').innerHTML = html;
  renderPagination(data.length);
  updateCards();
}

function renderPagination(total){
  const pages = Math.ceil(total / pageSize);
  let html = '';
  for(let i = 1; i <= pages; i++){
    html += `<div class="page ${i === page ? 'active' : ''}" onclick="goto(${i})">${i}</div>`;
  }
  document.getElementById('pagination').innerHTML = html;
}

function goto(p){
  page = p;
  render();
}

function filterBy(s, tabEl){
  filter = s;
  page = 1;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if(tabEl) tabEl.classList.add('active');
  render();
}

function searchProduct(v){
  search = v.toLowerCase();
  page = 1;
  render();
}

function goToAddProductPage(){
  window.location.href = './addProductPage.html';
}

function goToUpdateProductPage(event, productId){
  if(event) event.stopPropagation();
  window.location.href = `./updateProductPage.html?id=${encodeURIComponent(productId)}`;
}

async function deleteProduct(event, productId){
  if(event) event.stopPropagation();
  const idx = products.findIndex((item, i) => String(normalizeProduct(item, i).id) === String(productId));
  if(idx === -1) return;

  const name = normalizeProduct(products[idx], idx).name || 'this product';
  if(!window.confirm(`Delete "${name}"?`)) return;

  if(loadedFromApi){
    try{
      const storage = await import('../Core/FileStorage.js');
      await storage.deleteProductFromDisk(productId);
    }catch(err){
      const message = err?.message ? String(err.message) : 'Failed to delete product from server.';
      alert(`Could not delete product from server.\n\n${message}`);
      return;
    }
  }

  products.splice(idx, 1);
  save();
  render();
}

function openProductDetails(productId){
  const idx = products.findIndex((item, i) => String(normalizeProduct(item, i).id) === String(productId));
  if(idx === -1) return;

  const original = products[idx];
  original.views = Number(original.views) || 0;
  original.views += 1;
  original.createdAt = toDateValue(original.createdAt ?? original.date);
  original.image = firstImage(original);

  save();

  const product = normalizeProduct(original, idx);
  document.getElementById('detailName').innerText = product.name || 'Product Details';
  document.getElementById('detailDate').innerText = new Date(product.createdAt).toLocaleDateString();
  document.getElementById('detailViews').innerText = product.views;
  document.getElementById('detailImage').src = product.image;
  document.getElementById('detailImage').alt = product.name || 'Product image';
  document.getElementById('productDetailsModal').style.display = 'flex';
}

function closeProductDetails(event){
  if(event && event.target && event.target.id !== 'productDetailsModal') return;
  document.getElementById('productDetailsModal').style.display = 'none';
  render();
}

function readCategoryFilterFromUrl(){
  try{
    const params = new URLSearchParams(window.location.search || '');
    categoryFilter = String(params.get('category') || '').trim().toLowerCase();
  }catch(_err){
    categoryFilter = '';
  }
}

function readSearchFromUrl(){
  try{
    const params = new URLSearchParams(window.location.search || '');
    search = String(params.get('search') || '').trim().toLowerCase();
    const input = document.querySelector('.search');
    if(input) input.value = search ? params.get('search') : '';
  }catch(_err){
    // ignore malformed URLs
  }
}

readCategoryFilterFromUrl();
readSearchFromUrl();
loadProducts().then(render);
