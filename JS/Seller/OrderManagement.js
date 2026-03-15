import { KEY_ORDERS, KEY_PRODUCTS } from '../Core/Constants.js';
import { getCurrentUser, requireRole, ROLES } from '../Core/Auth.js';

const pageSize = 8;
let page = 1;
let filter = 'all';
let paymentFilter = 'all';
let recentDaysFilter = 0;
let search = '';
let editingOrderId = null;

const STATUS_ALLOWED = new Set(['Delivered', 'Pending', 'Shipped', 'Cancelled']);
const PRODUCT_STORAGE_KEYS = [KEY_PRODUCTS, 'products', 'sellerProducts'];

const hasAccess = requireRole([ROLES.SELLER]);
const currentUser = getCurrentUser();
const sellerId = currentUser?.id ? String(currentUser.id) : '';

let productCatalog = [];
let productById = new Map();
let productByName = new Map();

if (!hasAccess || !sellerId) {
  throw new Error('Seller access required.');
}

function showMessage(message, type = 'error', timeout = 2600){
  const safeMessage = String(message || '').trim();
  if(!safeMessage) return;

  let container = document.getElementById('toastContainer');
  if(!container){
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = safeMessage;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 250);
  }, timeout);
}

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
  const productSellerId = String(raw?.sellerId ?? raw?.seller_id ?? raw?.seller?.id ?? '').trim();

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
    price: Number.isFinite(price) ? price : 0,
    sellerId: productSellerId
  };
}

function refreshProductCatalog(){
  const rawProducts = loadRawProducts();
  productCatalog = rawProducts
    .map((item, idx) => normalizeCatalogProduct(item, idx))
    .filter((product) => String(product.sellerId || '') === sellerId);
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
  const itemSellerId = String(rawItem?.sellerId ?? matched?.sellerId ?? '').trim();

  return {
    id: String(id || matched?.id || resolvedName),
    name: resolvedName,
    image: imageRaw || matched?.image || defaultImage(resolvedName),
    qty,
    unitPrice,
    sellerId: itemSellerId
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
  const rawStatus = String(raw?.status ?? '').trim();
  const statusLower = rawStatus.toLowerCase();
  let status = 'Pending';
  if (STATUS_ALLOWED.has(rawStatus)) {
    status = rawStatus;
  } else if (statusLower === 'delivered') {
    status = 'Delivered';
  } else if (statusLower === 'pending') {
    status = 'Pending';
  } else if (statusLower === 'shipped') {
    status = 'Shipped';
  } else if (statusLower === 'cancelled' || statusLower === 'canceled') {
    status = 'Cancelled';
  }
  const items = normalizeOrderItems(raw);
  const parsedPrice = Number(raw?.price);
  const calculatedTotal = Number(items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0).toFixed(2));
  const rawPayment = String(raw?.payment ?? '').trim();
  const paymentMethod = String(raw?.paymentMethod ?? '').trim().toLowerCase();
  const payment = rawPayment === 'Paid'
    ? 'Paid'
    : rawPayment === 'Unpaid'
      ? 'Unpaid'
      : paymentMethod
        ? (paymentMethod === 'cash' ? 'Unpaid' : 'Paid')
        : 'Unpaid';

  return {
    ...raw,
    id: String(raw?.id ?? raw?.orderId ?? `ORD${Date.now()}${idx}`),
    products: items,
    product: items[0]?.name ?? '',
    price: Number.isFinite(parsedPrice) ? parsedPrice : calculatedTotal,
    payment,
    status,
    createdAt: toIsoDate(raw?.createdAt ?? raw?.date),
    sellerId: raw?.sellerId ?? null
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
      unitPrice: Number(p.price) || 0,
      sellerId: p.sellerId || sellerId
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
      createdAt: at(daysAgo, hour),
      sellerId
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

function orderBelongsToSeller(order, sellerProductIds){
  if(!order || !sellerId) return false;
  if(String(order?.sellerId ?? '') === sellerId) return true;
  const items = Array.isArray(order?.products) ? order.products : (Array.isArray(order?.items) ? order.items : []);
  if(items.some((item) => String(item?.sellerId ?? '') === sellerId)) return true;
  if(sellerProductIds && sellerProductIds.size){
    return items.some((item) => {
      const pid = item?.id ?? item?.productId ?? item?.product_id ?? '';
      return sellerProductIds.has(String(pid));
    });
  }
  return false;
}

function filterOrdersForSeller(list){
  const sellerProductIds = new Set(productCatalog.map((p) => String(p.id)));
  return list.filter((order) => orderBelongsToSeller(order, sellerProductIds));
}

function getOrderItems(order){
  if (!order) return [];
  if (Array.isArray(order.products)) return order.products;
  if (Array.isArray(order.items)) return order.items;
  return [];
}

function isSellerItem(item, sellerProductIds){
  if (!item) return false;
  if (String(item?.sellerId ?? '') === sellerId) return true;
  const pid = item?.id ?? item?.productId ?? item?.product_id ?? '';
  return sellerProductIds.has(String(pid));
}

function getSellerItems(order){
  const items = getOrderItems(order);
  if (!items.length) return [];
  const sellerProductIds = new Set(productCatalog.map((p) => String(p.id)));
  const bySeller = items.filter((item) => isSellerItem(item, sellerProductIds));
  if (bySeller.length) return bySeller;
  return [];
}

function isMixedOrder(order){
  const items = getOrderItems(order);
  if (!items.length) return false;
  const sellerItems = getSellerItems(order);
  return sellerItems.length > 0 && sellerItems.length !== items.length;
}

function calcTotal(items){
  return Number(items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0).toFixed(2));
}

function getSellerStatus(order){
  if (isMixedOrder(order)) {
    const value = order?.sellerStatus?.[sellerId];
    if (STATUS_ALLOWED.has(value)) return value;
  }
  return order.status;
}

function getSellerPayment(order){
  if (isMixedOrder(order)) {
    const value = order?.sellerPayment?.[sellerId];
    if (value === 'Paid' || value === 'Unpaid') return value;
  }
  return order.payment;
}

let allOrders = loadOrders();
let orders = filterOrdersForSeller(allOrders);

function saveAllOrders(){
  localStorage.setItem(KEY_ORDERS, JSON.stringify(allOrders));
  orders = filterOrdersForSeller(allOrders);
}

function reseedOrders(){
  refreshProductCatalog();
  allOrders = seedOrders().map((o, idx) => normalizeOrder(o, idx));
  saveAllOrders();
  page = 1;
  filter = 'all';
  search = '';
  render();
}

function updateCards(){
  document.getElementById('totalOrders').innerText = orders.length;
  document.getElementById('completedOrders').innerText = orders.filter((o) => getSellerStatus(o) === 'Delivered').length;
  document.getElementById('cancelOrders').innerText = orders.filter((o) => getSellerStatus(o) === 'Cancelled').length;
  document.getElementById('newOrders').innerText = orders.filter((o) => getSellerStatus(o) === 'Pending').length;
}

function render(){
  let data = orders;

  if(filter !== 'all') data = data.filter((o) => getSellerStatus(o) === filter);
  if(paymentFilter !== 'all') data = data.filter((o) => String(getSellerPayment(o) || '').toLowerCase() === paymentFilter);
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
      const names = getSellerItems(o).map((p) => p.name).join(' ');
      return names.toLowerCase().includes(search);
    });
  }

  const start = (page - 1) * pageSize;
  const paginated = data.slice(start, start + pageSize);
  let html = '';

  paginated.forEach((o, i) => {
    const products = getSellerItems(o);
    const firstProduct = products[0]?.name ?? 'No products';
    const summary = products.length > 1 ? `${firstProduct} +${products.length - 1} more` : firstProduct;
    const sellerTotal = calcTotal(products);
    const sellerPayment = getSellerPayment(o);
    const sellerStatus = getSellerStatus(o);

    html += `
<tr>
<td>${start + i + 1}</td>
<td><button class="order-link" onclick="openOrderProducts('${escapeHtml(o.id)}')">#${escapeHtml(o.id)}</button></td>
<td>${escapeHtml(summary)}</td>
<td>${new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
<td>$${Number(sellerTotal || 0).toFixed(2)}</td>
<td class="${sellerPayment === 'Paid' ? 'paid' : 'unpaid'}">${sellerPayment}</td>
<td class="status ${sellerStatus.toLowerCase()}">${sellerStatus}</td>
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
  }
}

function searchOrder(v){
  search = String(v || '').toLowerCase();
  page = 1;
  render();
}

function openModal(){
  clearOrderForm();
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
      qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
      sellerId
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

  const products = getSellerItems(order);
  const mixed = isMixedOrder(order);
  document.getElementById('productsModalTitle').innerText = `Order #${order.id} Products`;

  const note = mixed
    ? '<li class="product-media-note">Only items from your store are shown.</li>'
    : '';

  document.getElementById('productsList').innerHTML = products.length
    ? `${note}${products.map((item) => `
<li class="product-media-item">
  <img class="product-media-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
  <div class="product-media-info">
    <strong>${escapeHtml(item.name)}</strong>
    <span>Qty: ${item.qty}</span>
  </div>
</li>
`).join('')}`
    : (note || '<li>No products found.</li>');

  document.getElementById('productsModal').style.display = 'flex';
}

function openEditModal(orderId){
  const order = orders.find((o) => String(o.id) === String(orderId));
  if(!order) return;

  editingOrderId = String(order.id);
  setModalMode('edit');
  renderProductPicker();

  const items = getSellerItems(order);
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

  const sellerPayment = getSellerPayment(order);
  const sellerStatus = getSellerStatus(order);
  document.getElementById('payment').value = sellerPayment === 'Paid' ? 'Paid' : 'Unpaid';
  document.getElementById('status').value = sellerStatus;
  updateSelectedTotal();
  document.getElementById('modal').style.display = 'flex';
}

function closeProductsModal(){
  document.getElementById('productsModal').style.display = 'none';
  document.getElementById('productsList').innerHTML = '';
}

function saveOrder(){
  refreshProductCatalog();

  if(editingOrderId){
    const original = allOrders.find((o) => String(o.id) === String(editingOrderId));
    const originalItems = getSellerItems(original);
    const missing = originalItems.filter((item) => !resolveProduct(item?.name, item?.id));

    if(missing.length > 0){
      showMessage("You can't update this order because it contains deleted products.", 'error');
      return;
    }
  }

  const paymentRaw = document.getElementById('payment')?.value;
  const payment = paymentRaw === 'Paid' ? 'Paid' : (paymentRaw === 'Unpaid' ? 'Unpaid' : 'Paid');
  const status = document.getElementById('status').value;

  const products = collectSelectedProducts();

  if(products.length === 0) return;

  const finalPrice = Number(products.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0).toFixed(2));

  if(editingOrderId){
    const idx = allOrders.findIndex((o) => String(o.id) === String(editingOrderId));
    if(idx !== -1){
      const original = allOrders[idx];
      const originalItems = Array.isArray(original?.products) ? original.products : (Array.isArray(original?.items) ? original.items : []);
      const sellerProductIds = new Set(productCatalog.map((p) => String(p.id)));
      const mixed = isMixedOrder(original);

      let mergedItems = products;
      if (mixed) {
        const otherItems = originalItems.filter((item) => !isSellerItem(item, sellerProductIds));
        mergedItems = [...otherItems, ...products];
      }

      const next = {
        ...original,
        products: mergedItems,
        createdAt: toIsoDate(original.createdAt ?? original.date),
        sellerId: original.sellerId ?? null
      };

      if (mixed) {
        const nextSellerStatus = { ...(original.sellerStatus || {}), [sellerId]: status };
        next.sellerStatus = nextSellerStatus;
        next.sellerPayment = { ...(original.sellerPayment || {}), [sellerId]: payment };
        next.sellerSubtotal = { ...(original.sellerSubtotal || {}), [sellerId]: finalPrice };

        const itemsWithSellerId = mergedItems.filter((item) => String(item?.sellerId ?? '').trim());
        const canCheckAllSellers = mergedItems.length > 0 && itemsWithSellerId.length === mergedItems.length;
        if (canCheckAllSellers) {
          const sellerIds = new Set(itemsWithSellerId.map((item) => String(item.sellerId).trim()));
          const allDelivered = Array.from(sellerIds).every((id) => {
            const value = nextSellerStatus[id];
            return String(value || '').toLowerCase() === 'delivered';
          });
          if (allDelivered) {
            next.status = 'Delivered';
          }
        }
      } else {
        next.product = products[0]?.name ?? '';
        next.price = finalPrice;
        next.payment = payment;
        next.status = status;
        next.sellerId = sellerId;
      }

      allOrders[idx] = next;
    }
  }else{
    allOrders.unshift({
      id: makeOrderId(),
      products,
      product: products[0]?.name ?? '',
      price: finalPrice,
      payment,
      status,
      createdAt: new Date().toISOString(),
      sellerId
    });
  }

  saveAllOrders();
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
