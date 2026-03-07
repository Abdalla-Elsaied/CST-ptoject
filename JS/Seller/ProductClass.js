
// ==== Product Class ====
class Product {
    constructor(formData) {
        this.id = Date.now(); // unique product ID
        this.productName = formData.get("productName");
        this.description = formData.get("description");

        // Pricing
        this.price = Number(formData.get("price"));
        this.discountPrice = Number(formData.get("discountPrice")) || 0;
        this.taxIncluded = formData.get("taxIncluded");

        this.expirationStart = formData.get("expirationStart");
        this.expirationEnd = formData.get("expirationEnd");

        // Inventory
        this.stockQuantity = Number(formData.get("stockQuantity")) || 0;
        this.stockStatus = formData.get("stockStatus");

        // Extra data
        this.images = [];
        this.colors = [];

        // Read category and tag
        this.category = document.getElementById("categorySelect").value || "";
        this.tag = document.getElementById("tagSelect").value || "";


        this.createdAt = new Date();
    }

    addImage(image) {
        this.images.push(image);
    }

    addColor(color) {
        this.colors.push(color);
    }
}




// select all color boxes  
const colorBoxes = document.querySelectorAll('.color');

colorBoxes.forEach(box => {
    box.addEventListener('click', (e) => {
        e.preventDefault(); // prevent default just in case

        const input = box.querySelector('input[type="checkbox"]');
        if (!input) return;

        // toggle the selected class
        box.classList.toggle('selected');

        // toggle checkbox checked status to match selected class
        input.checked = box.classList.contains('selected');
    });
});



/// what to do when submit  click ?? ==> all tha addProuct functionality 

// ==== DOM Elements ====
const productForm = document.getElementById("productForm");
const imageInput = document.getElementById("imageUpload");
const previewBox = document.getElementById("previewContainer");
const colorDivs = document.querySelectorAll(".colors .color");

// === Variables ===
let uploadedImages = [];
let selectedColors = [];

// ==== Image Upload & Preview ====
imageInput.addEventListener("change", function () {
    previewBox.innerHTML = "";
    uploadedImages = [];

    Array.from(this.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.createElement("img");
            img.src = e.target.result;
            img.style.width = "80px";
            img.style.marginRight = "5px";
            previewBox.appendChild(img);
            uploadedImages.push(e.target.result);
        };
        reader.readAsDataURL(file);
    });
});

// ==== Color Selection ====
colorDivs.forEach(div => {
    div.addEventListener("click", function () {
        const colorClass = this.classList[1]; // c1, c2, etc.
        if (selectedColors.includes(colorClass)) {
            selectedColors = selectedColors.filter(c => c !== colorClass);
            this.classList.remove("selected");
        } else {
            selectedColors.push(colorClass);
            this.classList.add("selected");
        }
    });
});

// ==== Save Products as JSON File ====
function saveProductsAsJSON() {
    const products = JSON.parse(localStorage.getItem("products")) || [];
    const jsonStr = JSON.stringify(products, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "products.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ==== Form Submission ====
productForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(productForm);
    const product = new Product(formData);

    uploadedImages.forEach(img => product.addImage(img));
    selectedColors.forEach(color => product.addColor(color));

    // Save to localStorage
    const storedProducts = JSON.parse(localStorage.getItem("products")) || [];
    storedProducts.push(product);
    localStorage.setItem("products", JSON.stringify(storedProducts));

    // ✅ Print product to console
    console.log(product);

    // ✅ Download JSON file automatically
    saveProductsAsJSON();

    // Reset form and previews
    productForm.reset();
    previewBox.innerHTML = "";
    uploadedImages = [];
    selectedColors = [];
    colorDivs.forEach(div => div.classList.remove("selected"));
});



