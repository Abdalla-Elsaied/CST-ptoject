

const pageSize = 8
let page = 1
let filter="all"
let search=""

let orders = JSON.parse(localStorage.getItem("orders"))

if(!orders){

orders=[
{product:"Wireless Bluetooth Headphones",price:49.99,payment:"Paid",status:"Delivered"},
{product:"Men's T-Shirt",price:14.99,payment:"Unpaid",status:"Pending"},
{product:"Men's Leather Wallet",price:49.99,payment:"Paid",status:"Delivered"},
{product:"Memory Foam Pillow",price:39.99,payment:"Paid",status:"Shipped"},
{product:"Adjustable Dumbbells",price:14.99,payment:"Unpaid",status:"Pending"},
{product:"Coffee Maker",price:79.99,payment:"Unpaid",status:"Cancelled"},
{product:"Casual Baseball Cap",price:49.99,payment:"Paid",status:"Delivered"},
{product:"Full HD Webcam",price:39.99,payment:"Paid",status:"Delivered"},
{product:"Smart LED Bulb",price:79.99,payment:"Unpaid",status:"Delivered"},
{product:"Men's T-Shirt",price:14.99,payment:"Unpaid",status:"Delivered"}
]

localStorage.setItem("orders",JSON.stringify(orders))

}

function save(){
localStorage.setItem("orders",JSON.stringify(orders))
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
<td>#ORD${1000+i}</td>
<td>${o.product}</td>
<td>01-01-2025</td>
<td>${o.price}</td>
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

function filterStatus(s){

filter=s
page=1

document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"))
event.target.classList.add("active")

render()

}

function searchOrder(v){
search=v.toLowerCase()
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
let price=document.getElementById("price").value
let payment=document.getElementById("payment").value
let status=document.getElementById("status").value

if(!product.trim() || price==="") return

orders.unshift({product,price,payment,status})

save()

closeModal()

render()

}

render()

