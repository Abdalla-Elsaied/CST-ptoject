import { KEY_ORDERS, KEY_PRODUCTS } from '../Core/Constants.js';

const pageSize = 8;
let page = 1;
let filter = 'all';
let paymentFilter = 'all';
let recentDaysFilter = 0;
let search = '';
let editingOrderId = null;

const STATUS_ALLOWED = new Set(['Delivered', 'Pending', 'Shipped', 'Cancelled']);
const PRODUCT_STORAGE_KEYS = [KEY_PRODUCTS, 'products', 'sellerProducts'];

let productCatalog = [];
let productById = new Map();
let productByName = new Map();

function makeOrderId(){
  return `ORD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function toIsoDate(raw){
  const parsed = new Date(raw || Date.now());
  if(Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function defaultImage(name){
  const safeName = encodeURIComponent(name || 'Product');
  return `https://placehold.co/600x400/ecfdf5/166534?text=${safeName}`;
}

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseArrayFromStorage(key){
  try{
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : null;
  }catch(_err){
    return null;
  }
}

function loadRawProducts(){
  for(const key of PRODUCT_STORAGE_KEYS){
    const arr = parseArrayFromStorage(key);
    if(arr && arr.length) return arr;
  }
  return [];
}

function normalizeCatalogProduct(raw, idx){
  const name = String(raw?.productName ?? raw?.name ?? `Product ${idx + 1}`).trim();
  const id = String(raw?.id ?? idx + 1);
  const price = Number(raw?.price);

  let image = '';
  if(typeof raw?.image === 'string' && raw.image.trim()) image = raw.image.trim();
  else if(typeof raw?.imageUrl === 'string' && raw.imageUrl.trim()) image = raw.imageUrl.trim();
  else if(Array.isArray(raw?.images) && raw.images.length){
    const first = raw.images[0];
    if(typeof first === 'string' && first.trim()) image = first.trim();
    else if(first && typeof first?.url === 'string' && first.url.trim()) image = first.url.trim();
  }

  return {
    id,
    name,
    image: image || defaultImage(name),
    price: Number.isFinite(price) ? price : 0
  };
}

function refreshProductCatalog(){
  const rawProducts = loadRawProducts();
  productCatalog = rawProducts.map((item, idx) => normalizeCatalogProduct(item, idx));
  productById = new Map();
  productByName = new Map();

  productCatalog.forEach((p) => {
    productById.set(String(p.id), p);
    productByName.set(p.name.toLowerCase(), p);
  });
}

function resolveProduct(name, id){
  const byId = id ? productById.get(String(id)) : null;
  if(byId) return byId;
  const lowered = String(name || '').trim().toLowerCase();
  if(!lowered) return null;
  return productByName.get(lowered) ?? null;
}

function normalizeOrderItem(rawItem, idx){
  const isObject = rawItem && typeof rawItem === 'object';
  const id = isObject ? (rawItem.id ?? rawItem.productId ?? rawItem.product_id ?? '') : '';
  const name = isObject
    ? String(rawItem.name ?? rawItem.productName ?? rawItem.product ?? rawItem.title ?? '').trim()
    : String(rawItem ?? '').trim();
  const qtyRaw = isObject ? Number(rawItem.qty ?? rawItem.quantity ?? 1) : 1;
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
  const priceRaw = isObject ? Number(rawItem.unitPrice ?? rawItem.price) : Number.NaN;
  const imageRaw = isObject
    ? String(rawItem.image ?? rawItem.imageUrl ?? rawItem.thumbnail ?? '').trim()
    : '';

  const matched = resolveProduct(name, id);
  const resolvedName = (matched?.name ?? name) || `Product ${idx + 1}`;
  const unitPrice = Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : (matched?.price ?? 0);

  return {
    id: String(id || matched?.id || resolvedName),
    name: resolvedName,
    image: imageRaw || matched?.image || defaultImage(resolvedName),
    qty,
    unitPrice
  };
}

function normalizeOrderItems(raw){
  const source = Array.isArray(raw?.products) && raw.products.length
    ? raw.products
    : (Array.isArray(raw?.items) && raw.items.length
      ? raw.items
      : [raw?.product]);

  const items = source
    .map((item, idx) => normalizeOrderItem(item, idx))
    .filter((item) => item.name);

  return items;
}

function normalizeOrder(raw, idx){
  const status = STATUS_ALLOWED.has(raw?.status) ? raw.status : 'Pending';
  const items = normalizeOrderItems(raw);
  const parsedPrice = Number(raw?.price);
  const calculatedTotal = Number(items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0).toFixed(2));

  return {
    ...raw,
    id: String(raw?.id ?? raw?.orderId ?? `ORD${Date.now()}${idx}`),
    products: items,
    product: items[0]?.name ?? '',
    price: Number.isFinite(parsedPrice) ? parsedPrice : calculatedTotal,
    payment: raw?.payment === 'Paid' ? 'Paid' : 'Unpaid',
    status,
    createdAt: toIsoDate(raw?.createdAt ?? raw?.date)
  };
}

function seedOrders(){
  refreshProductCatalog();

  const fallbackProducts = [
    { id: 'p1', name: 'Wireless Headphones', image: defaultImage('Wireless Headphones'), price: 89.99 },
    { id: 'p2', name: 'Gaming Mouse', image: defaultImage('Gaming Mouse'), price: 39.99 },
    { id: 'p3', name: 'Coffee Maker', image: defaultImage('Coffee Maker'), price: 119.50 },
    { id: 'p4', name: 'Desk Lamp', image: defaultImage('Desk Lamp'), price: 27.99 },
    { id: 'p5', name: 'Mechanical Keyboard', image: defaultImage('Mechanical Keyboard'), price: 94.75 }
  ];

  const source = productCatalog.length ? productCatalog : fallbackProducts;
  const now = new Date();
  const pick = (index) => source[index % source.length];

  const at = (daysAgo, hour) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);
    return toIsoDate(d);
  };

  const buildItems = (lineDefs) => lineDefs.map(([productIndex, qty]) => {
    const p = pick(productIndex);
    return {
      id: p.id,
      name: p.name,
      image: p.image,
      qty,
      unitPrice: Number(p.price) || 0
    };
  });

  const buildOrder = (daysAgo, hour, lineDefs, payment, status) => {
    const items = buildItems(lineDefs);
    const total = Number(items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0).toFixed(2));
    return {
      id: makeOrderId(),
      products: items,
      product: items[0]?.name ?? '',
      price: total,
      payment,
      status,
      createdAt: at(daysAgo, hour)
    };
  };

  return [
    buildOrder(14, 10, [[0, 1], [1, 1]], 'Paid', 'Delivered'),
    buildOrder(13, 15, [[2, 1]], 'Paid', 'Delivered'),
    buildOrder(12, 11, [[3, 2]], 'Paid', 'Delivered'),
    buildOrder(11, 18, [[4, 1], [0, 1]], 'Unpaid', 'Cancelled'),
    buildOrder(10, 9, [[1, 1]], 'Paid', 'Delivered'),
    buildOrder(9, 13, [[2, 1], [3, 1]], 'Paid', 'Delivered'),
    buildOrder(8, 16, [[0, 1]], 'Paid', 'Shipped'),
    buildOrder(7, 20, [[4, 1]], 'Paid', 'Shipped'),
    buildOrder(6, 12, [[1, 2]], 'Unpaid', 'Pending'),
    buildOrder(5, 14, [[2, 1]], 'Unpaid', 'Pending'),
    buildOrder(4, 17, [[3, 1]], 'Paid', 'Shipped'),
    buildOrder(3, 19, [[0, 1], [4, 1]], 'Paid', 'Shipped'),
    buildOrder(2, 8, [[2, 1]], 'Paid', 'Delivered'),
    buildOrder(1, 21, [[1, 1], [3, 1]], 'Unpaid', 'Pending')
  ];
}

function loadOrders(){
  refreshProductCatalog();
  const parsed = parseArrayFromStorage(KEY_ORDERS);

  if(!Array.isArray(parsed) || parsed.length === 0){
    const seeded = seedOrders();
    localStorage.setItem(KEY_ORDERS, JSON.stringify(seeded));
    return seeded.map((order, idx) => normalizeOrder(order, idx));
  }

  const normalized = parsed.map((order, idx) => normalizeOrder(order, idx));
  localStorage.setItem(KEY_ORDERS, JSON.stringify(normalized));
  return normalized;
}

let orders = loadOrders();

function save(){
  localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));
}

function reseedOrders(){
  refreshProductCatalog();
  orders = seedOrders().map((o, idx) => normalizeOrder(o, idx));
  save();
  page = 1;
  filter = 'all';
  search = '';
  render();
}

function updateCards(){
  document.getElementById('totalOrders').innerText = orders.length;
  document.getElementById('completedOrders').innerText = orders.filter((o) => o.status === 'Delivered').length;
  document.getElementById('cancelOrders').innerText = orders.filter((o) => o.status === 'Cancelled').length;
  document.getElementById('newOrders').innerText = orders.filter((o) => o.status === 'Pending').length;
}

function render(){
  let data = orders;

  if(filter !== 'all') data = data.filter((o) => o.status === filter);
  if(paymentFilter !== 'all') data = data.filter((o) => String(o.payment || '').toLowerCase() === paymentFilter);
  if(recentDaysFilter > 0){
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (recentDaysFilter - 1));

    data = data.filter((o) => {
      const orderDate = new Date(o?.createdAt ?? o?.date ?? 0);
      if(Number.isNaN(orderDate.getTime())) return false;
      return orderDate >= start && orderDate <= now;
    });
  }

  if(search){
    data = data.filter((o) => {
      const names = Array.isArray(o.products) ? o.products.map((p) => p.name).join(' ') : '';
      return names.toLowerCase().includes(search);
    });
  }

  const start = (page - 1) * pageSize;
  const paginated = data.slice(start, start + pageSize);
  let html = '';

  paginated.forEach((o, i) => {
    const products = Array.isArray(o.products) ? o.products : [];
    const firstProduct = products[0]?.name ?? 'No products';
    const summary = products.length > 1 ? `${firstProduct} +${products.length - 1} more` : firstProduct;

    html += `
<tr>
<td>${start + i + 1}</td>
<td><button class="order-link" onclick="openOrderProducts('${escapeHtml(o.id)}')">#${escapeHtml(o.id)}</button></td>
<td>${escapeHtml(summary)}</td>
<td>${new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
<td>$${Number(o.price || 0).toFixed(2)}</td>
<td class="${o.payment === 'Paid' ? 'paid' : 'unpaid'}">${o.payment}</td>
<td class="status ${o.status.toLowerCase()}">${o.status}</td>
<td><button class="btn-inline" onclick="openEditModal('${String(o.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">Update</button></td>
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

function filterStatus(s, tabEl){
  filter = s;
  page = 1;

  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  if(tabEl) tabEl.classList.add('active');

  render();
}

function applyFiltersFromUrl(){
  try{
    const params = new URLSearchParams(window.location.search || '');
    const statusParam = String(params.get('status') || '').trim();
    const paymentParam = String(params.get('payment') || '').trim().toLowerCase();
    const recentDaysParam = Number(params.get('recentDays'));
    const searchParam = String(params.get('search') || '').trim();

    if(statusParam && (statusParam === 'Delivered' || statusParam === 'Pending' || statusParam === 'Cancelled' || statusParam === 'Shipped')){
      filter = statusParam;
    }

    if(paymentParam === 'paid' || paymentParam === 'unpaid'){
      paymentFilter = paymentParam;
    }

    if(Number.isFinite(recentDaysParam) && recentDaysParam > 0){
      recentDaysFilter = Math.floor(recentDaysParam);
    }

    if(searchParam){
      search = searchParam.toLowerCase();
      const searchInput = document.querySelector('.search');
      if(searchInput) searchInput.value = searchParam;
      page = 1;
    }

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab) => tab.classList.remove('active'));

    if(filter === 'Delivered' && tabs[1]) tabs[1].classList.add('active');
    else if(filter === 'Pending' && tabs[2]) tabs[2].classList.add('active');
    else if(filter === 'Cancelled' && tabs[3]) tabs[3].classList.add('active');
    else if(tabs[0]) tabs[0].classList.add('active');
  }catch(_err){
    // keep defaults on malformed URL
  }
}

function searchOrder(v){
  search = String(v || '').toLowerCase();
  page = 1;
  render();
}

function openModal(){
  editingOrderId = null;
  setModalMode('add');
  renderProductPicker();
  document.getElementById('modal').style.display = 'flex';
}

function closeModal(){
  document.getElementById('modal').style.display = 'none';
  clearOrderForm();
}

function setModalMode(mode){
  const titleEl = document.getElementById('orderModalTitle');
  const saveBtnEl = document.getElementById('orderModalSaveBtn');
  if(!titleEl || !saveBtnEl) return;

  if(mode === 'edit'){
    titleEl.innerText = 'Update Order';
    saveBtnEl.innerText = 'Update';
    return;
  }

  titleEl.innerText = 'Add Order';
  saveBtnEl.innerText = 'Save';
}

function clearOrderForm(){
  editingOrderId = null;
  setModalMode('add');
  document.getElementById('price').value = '';
  document.getElementById('payment').value = 'Paid';
  document.getElementById('status').value = 'Delivered';
  renderProductPicker();
}

function renderProductPicker(){
  refreshProductCatalog();
  const picker = document.getElementById('productPicker');
  if(!picker) return;

  if(productCatalog.length === 0){
    picker.innerHTML = '<div class="picker-empty">No products found. Add products first.</div>';
    return;
  }

  picker.innerHTML = productCatalog.map((product, idx) => `
<label class="picker-item">
  <div class="picker-main">
    <input type="checkbox" class="picker-check" data-id="${escapeHtml(product.id)}" data-index="${idx}" onchange="togglePickerQty(${idx}, this.checked)">
    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
    <span class="picker-name">${escapeHtml(product.name)}</span>
  </div>
  <input id="pickerQty${idx}" class="picker-qty" type="number" min="1" step="1" value="1" disabled oninput="updateSelectedTotal()">
</label>
`).join('');

  updateSelectedTotal();
}

function togglePickerQty(index, checked){
  const qtyInput = document.getElementById(`pickerQty${index}`);
  if(!qtyInput) return;
  qtyInput.disabled = !checked;
  if(!checked) qtyInput.value = '1';
  updateSelectedTotal();
}

function collectSelectedProducts(){
  const checks = Array.from(document.querySelectorAll('.picker-check:checked'));
  return checks.map((check) => {
    const id = String(check.dataset.id);
    const idx = Number(check.dataset.index);
    const qtyInput = document.getElementById(`pickerQty${idx}`);
    const qty = Number(qtyInput?.value);
    const matched = productById.get(id);
    return normalizeOrderItem({
      id,
      name: matched?.name ?? '',
      image: matched?.image ?? '',
      unitPrice: matched?.price ?? 0,
      qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
    }, idx);
  }).filter((item) => item.name);
}

function updateSelectedTotal(){
  const selected = collectSelectedProducts();
  const total = Number(selected.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0).toFixed(2));
  const priceInput = document.getElementById('price');
  if(priceInput) priceInput.value = total ? total.toFixed(2) : '';
}

function openOrderProducts(orderId){
  const order = orders.find((o) => String(o.id) === String(orderId));
  if(!order) return;

  const products = Array.isArray(order.products) ? order.products : [];
  document.getElementById('productsModalTitle').innerText = `Order #${order.id} Products`;

  document.getElementById('productsList').innerHTML = products.length
    ? products.map((item) => `
<li class="product-media-item">
  <img class="product-media-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
  <div class="product-media-info">
    <strong>${escapeHtml(item.name)}</strong>
    <span>Qty: ${item.qty}</span>
  </div>
</li>
`).join('')
    : '<li>No products found.</li>';

  document.getElementById('productsModal').style.display = 'flex';
}

function openEditModal(orderId){
  const order = orders.find((o) => String(o.id) === String(orderId));
  if(!order) return;

  editingOrderId = String(order.id);
  setModalMode('edit');
  renderProductPicker();

  const items = Array.isArray(order.products) ? order.products : [];
  const checksById = new Map(
    Array.from(document.querySelectorAll('.picker-check')).map((el) => [String(el.dataset.id), el])
  );
  const checksByName = new Map(
    Array.from(document.querySelectorAll('.picker-check')).map((el) => {
      const idx = Number(el.dataset.index);
      const name = String(productCatalog[idx]?.name || '').trim().toLowerCase();
      return [name, el];
    })
  );

  items.forEach((item) => {
    const matchedCheck = checksById.get(String(item.id))
      || checksByName.get(String(item.name || '').trim().toLowerCase());
    if(!matchedCheck) return;

    matchedCheck.checked = true;
    const idx = Number(matchedCheck.dataset.index);
    const qtyInput = document.getElementById(`pickerQty${idx}`);
    if(qtyInput){
      qtyInput.disabled = false;
      qtyInput.value = String(Number(item.qty) > 0 ? Math.floor(Number(item.qty)) : 1);
    }
  });

  document.getElementById('payment').value = order.payment === 'Paid' ? 'Paid' : 'Unpaid';
  document.getElementById('status').value = order.status;
  updateSelectedTotal();
  document.getElementById('modal').style.display = 'flex';
}

function closeProductsModal(){
  document.getElementById('productsModal').style.display = 'none';
  document.getElementById('productsList').innerHTML = '';
}

function saveOrder(){
  refreshProductCatalog();

  const payment = document.getElementById('payment').value;
  const status = document.getElementById('status').value;

  const products = collectSelectedProducts();

  if(products.length === 0) return;

  const finalPrice = Number(products.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0).toFixed(2));

  if(editingOrderId){
    const idx = orders.findIndex((o) => String(o.id) === String(editingOrderId));
    if(idx !== -1){
      orders[idx] = {
        ...orders[idx],
        products,
        product: products[0]?.name ?? '',
        price: finalPrice,
        payment,
        status,
        createdAt: toIsoDate(orders[idx].createdAt ?? orders[idx].date)
      };
    }
  }else{
    orders.unshift({
      id: makeOrderId(),
      products,
      product: products[0]?.name ?? '',
      price: finalPrice,
      payment,
      status,
      createdAt: new Date().toISOString()
    });
  }

  save();
  closeModal();
  render();
}

applyFiltersFromUrl();
render();

window.goto = goto;
window.filterStatus = filterStatus;
window.searchOrder = searchOrder;
window.openModal = openModal;
window.openEditModal = openEditModal;
window.closeModal = closeModal;
window.saveOrder = saveOrder;
window.openOrderProducts = openOrderProducts;
window.closeProductsModal = closeProductsModal;
window.reseedOrders = reseedOrders;
window.togglePickerQty = togglePickerQty;
window.updateSelectedTotal = updateSelectedTotal;
