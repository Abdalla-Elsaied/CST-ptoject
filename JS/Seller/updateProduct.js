import { loadProductsFromFolder, saveProductToDisk } from '../Core/FileStorage.js';

const fileInput = document.getElementById('imageUpload');

const searchInput = document.getElementById('searchProductId');
const searchButton = document.getElementById('searchButton');
const form = document.getElementById('productForm');
const previewContainer = document.getElementById('previewContainer');
const categorySelect = document.getElementById('categorySelect');
const tagSelect = document.getElementById('tagSelect');

document.addEventListener('DOMContentLoaded', () => {
    const queryId = new URLSearchParams(window.location.search).get('id');
    if (!queryId) return;
    searchInput.value = queryId;
    loadProductById(queryId);
});

let currentProduct = null; // stores product fetched from API
let existingImages = [];    // store images already uploaded

function setSelectValue(selectElement, value) {
    if (!selectElement) return;
    const normalized = String(value || '').toLowerCase();
    const option = Array.from(selectElement.options).find(
        opt => String(opt.value).toLowerCase() === normalized
    );
    selectElement.value = option ? option.value : '';
}

async function loadProductById(id) {
    if (!id) return alert('Please enter a product ID');
    try {
        const products = await loadProductsFromFolder(); // fetch all products
        const product = products.find(p => String(p.id) === String(id));

        if (!product) return alert('Product not found');

        currentProduct = product;

        // Fill form fields
        form.dataset.productId = product.id;
        form.productName.value = product.name;
        form.description.value = product.description;
        form.price.value = product.price;
        form.discountPrice.value = product.discountPrice || '';
        form.taxIncluded.value = product.taxIncluded ? 'yes' : 'no';
        form.expirationStart.value = product.expirationStart || '';
        form.expirationEnd.value = product.expirationEnd || '';
        form.stockQuantity.value = product.stockQuantity || 0;
        form.stockStatus.value = product.stockStatus || '';

        setSelectValue(categorySelect, product.category);
        setSelectValue(tagSelect, product.tag);

        // Colors
        const checkboxes = form.querySelectorAll('input[name="colors"]');
        const selectedColors = Array.isArray(product.colors) ? product.colors : [];
        checkboxes.forEach(cb => cb.checked = selectedColors.includes(cb.value));

        // Images
        existingImages = product.images || [];
        refreshPreview();

        alert('Product loaded. You can now edit it.');

    } catch (err) {
        console.error(err);
        alert('Failed to load products from API');
    }
}

searchButton.addEventListener('click', () => {
    const id = searchInput.value.trim();
    loadProductById(id);
});

function refreshPreview() {
    previewContainer.innerHTML = '';

    // Existing images
    existingImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.style.margin = '8px';

        const image = document.createElement('img');
        image.src = img.url; // Cloudinary URL from API
        image.style.maxWidth = '140px';
        image.style.borderRadius = '6px';
        div.appendChild(image);

        // Optional remove button
        const delBtn = document.createElement('button');
        delBtn.textContent = 'X';
        delBtn.onclick = () => {
            existingImages.splice(index, 1);
            refreshPreview();
        };
        div.appendChild(delBtn);

        previewContainer.appendChild(div);
    });

    // Newly selected files
    Array.from(fileInput.files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const div = document.createElement('div');
        div.style.margin = '8px';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = '140px';
        img.style.borderRadius = '6px';
        div.appendChild(img);
        previewContainer.appendChild(div);
    });
}

fileInput.addEventListener('change', refreshPreview);

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const imageFiles = Array.from(fileInput.files || []);

    if (!currentProduct) {
        alert('No product selected for update');
        return;
    }

    // Merge existing images with newly uploaded ones
    const productData = {
        ...currentProduct, // keep id and createdAt
        name: formData.get('productName').trim(),
        description: formData.get('description').trim(),
        price: Number(formData.get('price')) || 0,
        discountPrice: Number(formData.get('discountPrice')) || null,
        taxIncluded: formData.get('taxIncluded') === 'yes',
        expirationStart: formData.get('expirationStart') || null,
        expirationEnd: formData.get('expirationEnd') || null,
        stockQuantity: Number(formData.get('stockQuantity')) || 0,
        stockStatus: formData.get('stockStatus'),
        category: categorySelect ? categorySelect.value : null,
        tag: tagSelect ? tagSelect.value : null,
        colors: formData.getAll('colors'),
        images: existingImages
    };

    try {
        await saveProductToDisk(productData, imageFiles); // automatically does PUT if id exists
        alert('Product updated successfully!');
        form.reset();
        previewContainer.innerHTML = '';
        fileInput.value = '';
        currentProduct = null;
        existingImages = [];
    } catch (err) {
        console.error(err);
        alert('Failed to update product');
    }
});
