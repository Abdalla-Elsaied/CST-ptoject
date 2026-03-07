
const STORAGE_KEY = 'products';
const LEGACY_STORAGE_KEY = 'sellerProducts';
const pageSize = 8;
let page = 1;
let filter = 'all';
let search = '';

function normalizeProduct(raw, idx){
  return {
    id: raw.id ?? idx,
    name: raw.productName ?? raw.name ?? '',
    category: raw.category ?? '',
    price: Number(raw.price) || 0,
    stock: Number(raw.stockQuantity ?? raw.stock) || 0
  };
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function loadProducts(){
  const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if(Array.isArray(current) && current.length){
    return current;
  }

  const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
  if(Array.isArray(legacy) && legacy.length){
    const migrated = legacy.map((item, idx) => ({
      ...item,
      id: item.id ?? Date.now() + idx,
      productName: item.productName ?? item.name ?? '',
      stockQuantity: Number(item.stockQuantity ?? item.stock) || 0
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  const seed = [
    {productName:'Apple iPhone 13', category:'Electronic', price:999, stockQuantity:104},
    {productName:'Nike Air Jordan', category:'Fashion', price:72.4, stockQuantity:12},
    {productName:'Wireless Headphones', category:'Electronic', price:49.99, stockQuantity:0},
    {productName:'Smart Fitness Tracker', category:'Electronic', price:39.99, stockQuantity:66},
    {productName:'Leather Wallet', category:'Fashion', price:19.99, stockQuantity:7},
    {productName:'Coffee Maker', category:'Home', price:79.99, stockQuantity:25},
    {productName:'Memory Foam Pillow', category:'Home', price:39.99, stockQuantity:3},
    {productName:'Full HD Webcam', category:'Electronic', price:39.99, stockQuantity:31},
    {productName:'Casual Baseball Cap', category:'Fashion', price:14.99, stockQuantity:54},
    {productName:'Electric Hair Trimmer', category:'Beauty', price:34.99, stockQuantity:0}
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

let products = loadProducts();

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
  if(filter !== 'all') data = data.filter(p => getStatus(p.stock) === filter);
  if(search) data = data.filter(p => p.name.toLowerCase().includes(search));

  const start = (page - 1) * pageSize;
  const paginated = data.slice(start, start + pageSize);

  let html = '';
  paginated.forEach((p, i) => {
    const status = getStatus(p.stock);
    html += `
      <tr>
        <td>${start + i + 1}</td>
        <td>#PRD${1000 + start + i + 1}</td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td class="price">$${p.price.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td><span class="stock ${statusClass(status)}"><span class="dot"></span>${status}</span></td>
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

function filterBy(s){
  filter = s;
  page = 1;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
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

render();
