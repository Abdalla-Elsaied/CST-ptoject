import { KEY_ORDERS } from '../Core/Constants.js';
const pageSize = 8
let page = 1
let filter="all"
let search=""

const STATUS_ALLOWED = new Set(["Delivered", "Pending", "Shipped", "Cancelled"]);

function makeOrderId(){
  return `ORD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

function toIsoDate(raw){
  const parsed = new Date(raw || Date.now());
  if(Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function normalizeOrder(raw, idx){
  const parsedPrice = Number(raw?.price);
  const status = STATUS_ALLOWED.has(raw?.status) ? raw.status : "Pending";
  const normalizedProducts = Array.isArray(raw?.products)
    ? raw.products.map((p) => String(p || "").trim()).filter(Boolean)
    : [];
  if(normalizedProducts.length === 0){
    if(Array.isArray(raw?.items)){
      raw.items.forEach((item) => {
        const itemName = String(item?.name ?? item?.productName ?? item?.title ?? "").trim();
        if(itemName) normalizedProducts.push(itemName);
      });
    } else {
      const singleProduct = String(raw?.product ?? "").trim();
      if(singleProduct) normalizedProducts.push(singleProduct);
    }
  }
  return {
    ...raw,
    id: String(raw?.id ?? raw?.orderId ?? `ORD${Date.now()}${idx}`),
    products: normalizedProducts,
    product: normalizedProducts[0] ?? "",
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    payment: raw?.payment === "Paid" ? "Paid" : "Unpaid",
    status,
    createdAt: toIsoDate(raw?.createdAt ?? raw?.date)
  };
}

function seedOrders(){
  const now = new Date();
  const at = (daysAgo, hour) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);
    return toIsoDate(d);
  };
  const order = (daysAgo, hour, products, price, payment, status) => ({
    id: makeOrderId(),
    products,
    price,
    payment,
    status,
    createdAt: at(daysAgo, hour)
  });

  return [
    order(21, 10, ["Wireless Noise-Canceling Headphones", "USB-C Cable 2m"], 134.98, "Paid", "Delivered"),
    order(20, 13, ["Gaming Mouse Pro"], 39.99, "Paid", "Delivered"),
    order(19, 17, ["Espresso Machine", "Coffee Beans 1kg"], 249.50, "Paid", "Delivered"),
    order(18, 9, ["Men's Leather Wallet"], 42.00, "Paid", "Delivered"),
    order(17, 15, ["Smart LED Bulb Pack (4)"], 29.99, "Paid", "Delivered"),
    order(16, 19, ["Memory Foam Pillow", "Pillowcase Set"], 58.40, "Paid", "Delivered"),
    order(15, 12, ["Adjustable Dumbbells 20kg"], 169.99, "Unpaid", "Cancelled"),
    order(14, 11, ["USB-C Fast Charger 65W", "Braided Cable"], 44.90, "Paid", "Delivered"),
    order(13, 16, ["Casual Baseball Cap"], 18.99, "Paid", "Delivered"),
    order(12, 20, ["Full HD Webcam", "Ring Light 10in"], 88.75, "Paid", "Delivered"),
    order(11, 8, ["Men's Cotton T-Shirt", "Crew Socks"], 31.50, "Paid", "Delivered"),
    order(10, 14, ["Bluetooth Speaker Mini"], 36.00, "Paid", "Delivered"),
    order(9, 18, ["Desk Lamp", "LED Bulb Warm White"], 39.25, "Paid", "Delivered"),
    order(8, 10, ["Phone Stand Aluminum"], 12.49, "Paid", "Shipped"),
    order(7, 13, ["Mechanical Keyboard", "Wrist Rest"], 104.90, "Paid", "Shipped"),
    order(6, 17, ["Portable SSD 1TB"], 119.00, "Paid", "Shipped"),
    order(5, 11, ["Wireless Earbuds", "Charging Case Cover"], 79.99, "Unpaid", "Pending"),
    order(4, 15, ["Office Chair Ergonomic"], 189.00, "Unpaid", "Pending"),
    order(3, 9, ["Air Fryer 5L", "Silicone Mat"], 126.30, "Paid", "Shipped"),
    order(2, 12, ["Monitor Arm", "HDMI Cable"], 67.80, "Paid", "Shipped"),
    order(1, 18, ["Tablet Stand", "Screen Cleaner Kit"], 26.50, "Unpaid", "Pending"),
    order(0, 21, ["Smart Watch Series S", "Extra Strap"], 215.00, "Unpaid", "Pending")
  ];
}

function loadOrders(){
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(KEY_ORDERS));
  } catch (_err) {
    parsed = null;
  }

  if(!Array.isArray(parsed) || parsed.length === 0){
    const seeded = seedOrders();
    localStorage.setItem(KEY_ORDERS, JSON.stringify(seeded));
    return seeded;
  }

  const normalized = parsed.map((order, idx) => normalizeOrder(order, idx));
  localStorage.setItem(KEY_ORDERS, JSON.stringify(normalized));
  return normalized;
}

let orders = loadOrders();

function save(){
localStorage.setItem(KEY_ORDERS,JSON.stringify(orders))
}

function reseedOrders(){
orders = seedOrders().map((o, idx) => normalizeOrder(o, idx))
save()
page = 1
filter = "all"
search = ""
render()
}

function updateCards(){

document.getElementById("totalOrders").innerText=orders.length

document.getElementById("completedOrders").innerText=
orders.filter(o=>o.status=="Delivered").length

document.getElementById("cancelOrders").innerText=
orders.filter(o=>o.status=="Cancelled").length

document.getElementById("newOrders").innerText=
orders.filter(o=>o.status=="Pending").length

}

function render(){

let data=orders

if(filter!="all")
data=data.filter(o=>o.status==filter)

if(search)
data=data.filter((o)=>{
  const products = Array.isArray(o.products) ? o.products : [];
  return products.join(" ").toLowerCase().includes(search);
})

let start=(page-1)*pageSize
let paginated=data.slice(start,start+pageSize)

let html=""

paginated.forEach((o,i)=>{
const products = Array.isArray(o.products) ? o.products : [];
const firstProduct = products[0] ?? "No products";
const summary = products.length > 1 ? `${firstProduct} +${products.length - 1} more` : firstProduct;

html+=`
<tr>
<td>${start+i+1}</td>
<td><button class="order-link" onclick="openOrderProducts('${o.id}')">#${o.id}</button></td>
<td>${summary}</td>
<td>${new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
<td>$${o.price.toFixed(2)}</td>
<td class="${o.payment=='Paid'?'paid':'unpaid'}">${o.payment}</td>
<td class="status ${o.status.toLowerCase()}">${o.status}</td>
</tr>
`

})

document.getElementById("tableBody").innerHTML=html

renderPagination(data.length)

updateCards()

}

function renderPagination(total){

let pages=Math.ceil(total/pageSize)

let html=""

for(let i=1;i<=pages;i++){

html+=`<div class="page ${i==page?'active':''}" onclick="goto(${i})">${i}</div>`

}

document.getElementById("pagination").innerHTML=html

}

function goto(p){
page=p
render()
}

function filterStatus(s, tabEl){

filter=s
page=1

document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"))
if(tabEl) tabEl.classList.add("active")

render()

}

function searchOrder(v){
search=v.toLowerCase()
page=1
render()
}

function openModal(){
document.getElementById("modal").style.display="flex"
}

function closeModal(){
document.getElementById("modal").style.display="none"
clearOrderForm()
}

function clearOrderForm(){
document.getElementById("product").value=""
document.getElementById("price").value=""
document.getElementById("payment").value="Paid"
document.getElementById("status").value="Delivered"
}

function openOrderProducts(orderId){
const order = orders.find((o) => String(o.id) === String(orderId))
if(!order) return

const products = Array.isArray(order.products) && order.products.length > 0
  ? order.products
  : [order.product].filter(Boolean)

document.getElementById("productsModalTitle").innerText = `Order #${order.id} Products`
document.getElementById("productsList").innerHTML = products
  .map((name) => `<li>${name}</li>`)
  .join("")
document.getElementById("productsModal").style.display = "flex"
}

function closeProductsModal(){
document.getElementById("productsModal").style.display = "none"
document.getElementById("productsList").innerHTML = ""
}

function addOrder(){

let product=document.getElementById("product").value
let price=Number(document.getElementById("price").value)
let payment=document.getElementById("payment").value
let status=document.getElementById("status").value

if(!product.trim() || !Number.isFinite(price)) return
const products = product
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean)

orders.unshift({
id: makeOrderId(),
products,
product: products[0] ?? "",
price,
payment,
status,
createdAt: new Date().toISOString()
})

save()

closeModal()

render()

}

render()

window.goto = goto
window.filterStatus = filterStatus
window.searchOrder = searchOrder
window.openModal = openModal
window.closeModal = closeModal
window.addOrder = addOrder
window.openOrderProducts = openOrderProducts
window.closeProductsModal = closeProductsModal
window.reseedOrders = reseedOrders

