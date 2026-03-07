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
  return {
    ...raw,
    id: String(raw?.id ?? raw?.orderId ?? `ORD${Date.now()}${idx}`),
    product: String(raw?.product ?? "").trim(),
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    payment: raw?.payment === "Paid" ? "Paid" : "Unpaid",
    status,
    createdAt: toIsoDate(raw?.createdAt ?? raw?.date)
  };
}

function seedOrders(){
  return [
    {id: makeOrderId(), product:"Wireless Bluetooth Headphones", price:49.99, payment:"Paid", status:"Delivered", createdAt:toIsoDate("2025-01-01")},
    {id: makeOrderId(), product:"Men's T-Shirt", price:14.99, payment:"Unpaid", status:"Pending", createdAt:toIsoDate("2025-01-02")},
    {id: makeOrderId(), product:"Men's Leather Wallet", price:49.99, payment:"Paid", status:"Delivered", createdAt:toIsoDate("2025-01-03")},
    {id: makeOrderId(), product:"Memory Foam Pillow", price:39.99, payment:"Paid", status:"Shipped", createdAt:toIsoDate("2025-01-04")},
    {id: makeOrderId(), product:"Adjustable Dumbbells", price:14.99, payment:"Unpaid", status:"Pending", createdAt:toIsoDate("2025-01-05")},
    {id: makeOrderId(), product:"Coffee Maker", price:79.99, payment:"Unpaid", status:"Cancelled", createdAt:toIsoDate("2025-01-06")},
    {id: makeOrderId(), product:"Casual Baseball Cap", price:49.99, payment:"Paid", status:"Delivered", createdAt:toIsoDate("2025-01-07")},
    {id: makeOrderId(), product:"Full HD Webcam", price:39.99, payment:"Paid", status:"Delivered", createdAt:toIsoDate("2025-01-08")},
    {id: makeOrderId(), product:"Smart LED Bulb", price:79.99, payment:"Unpaid", status:"Delivered", createdAt:toIsoDate("2025-01-09")},
    {id: makeOrderId(), product:"Men's T-Shirt", price:14.99, payment:"Unpaid", status:"Delivered", createdAt:toIsoDate("2025-01-10")}
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
data=data.filter(o=>o.product.toLowerCase().includes(search))

let start=(page-1)*pageSize
let paginated=data.slice(start,start+pageSize)

let html=""

paginated.forEach((o,i)=>{

html+=`
<tr>
<td>${start+i+1}</td>
<td>#${o.id}</td>
<td>${o.product}</td>
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

function addOrder(){

let product=document.getElementById("product").value
let price=Number(document.getElementById("price").value)
let payment=document.getElementById("payment").value
let status=document.getElementById("status").value

if(!product.trim() || !Number.isFinite(price)) return

orders.unshift({
id: makeOrderId(),
product: product.trim(),
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

