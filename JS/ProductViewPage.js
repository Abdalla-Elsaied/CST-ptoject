const mainImage = document.getElementById("mainImage");
const thumbnails = document.querySelectorAll(".thumbs img");

thumbnails.forEach(img=>{
    img.addEventListener("click",function(){
        mainImage.src = this.src;
        thumbnails.forEach(i=>i.classList.remove("active-thumb"));
        this.classList.add("active-thumb");
    });
});


const sizeButtons = document.querySelectorAll(".sizes button");

sizeButtons.forEach(btn=>{
    btn.addEventListener("click",function(){
        sizeButtons.forEach(b=>b.classList.remove("active"));
        this.classList.add("active");
    });
});

const plus = document.getElementById("plus");
const minus = document.getElementById("minus");
const qty = document.getElementById("qty");

plus.addEventListener("click",()=> qty.value = parseInt(qty.value)+1);
minus.addEventListener("click",()=>{
    if(parseInt(qty.value)>1)
        qty.value = parseInt(qty.value)-1;
});

