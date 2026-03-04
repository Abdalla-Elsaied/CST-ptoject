document.addEventListener("DOMContentLoaded", function(){

  const mainImage = document.getElementById("mainImage");
  const thumbs = document.querySelectorAll(".thumbs img");
  const sizes = document.querySelectorAll(".sizes button");


  thumbs[0].classList.add("active");

  thumbs.forEach(img=>{
    img.addEventListener("click", function(){
      mainImage.src = this.src;
      thumbs.forEach(i=>i.classList.remove("active"));
      this.classList.add("active");
    });
  });

  sizes.forEach(btn=>{
    btn.addEventListener("click", function(){
      sizes.forEach(b=>b.classList.remove("active"));
      this.classList.add("active");
    });
  });

  const plus = document.getElementById("plus");
  const minus = document.getElementById("minus");
  const qty = document.getElementById("qty");

  plus.onclick = ()=> qty.value = parseInt(qty.value)+1;

  minus.onclick = ()=>{
    if(parseInt(qty.value) > 1)
      qty.value = parseInt(qty.value)-1;
  };

});