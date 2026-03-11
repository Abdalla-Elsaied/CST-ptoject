import { loadProductsFromFolder, saveProductToDisk } from '../Core/FileStorage.js';
import { KEY_CATEGORIES } from '../Core/Constants.js';

const THEME_STORAGE_KEY = 'seller_theme';

function applyStoredTheme() {
    try {
        if (localStorage.getItem(THEME_STORAGE_KEY) === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    } catch (_err) {
    }
}

const fileInput = document.getElementById('imageUpload');

const searchInput = document.getElementById('searchProductId');
const searchButton = document.getElementById('searchButton');
const form = document.getElementById('productForm');
const previewContainer = document.getElementById('previewContainer');
const categorySelect = document.getElementById('categorySelect');
const tagSelect = document.getElementById('tagSelect');
const expirationStartInput = form?.querySelector('input[name="expirationStart"]');
const messageEl = document.getElementById('pageMessage');
const loadingEl = document.getElementById('pageLoading');
const loadingTextEl = document.getElementById('pageLoadingText');
let messageTimer = null;

const showLoading = (isLoading, text) => {
    if (!loadingEl) return;
    if (text && loadingTextEl) loadingTextEl.textContent = text;
    loadingEl.classList.toggle('show', isLoading);
    loadingEl.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
};

const showMessage = (message, type = 'success', timeout = 2500) => {
    if (!messageEl) return;
    if (messageTimer) clearTimeout(messageTimer);
    messageEl.textContent = message;
    messageEl.classList.remove('success', 'error');
    messageEl.classList.add(type);
    messageEl.classList.add('show');
    messageTimer = setTimeout(() => {
        messageEl.classList.remove('show');
    }, timeout);
};

document.addEventListener('DOMContentLoaded', () => {
    applyStoredTheme();
    loadCategories();
    if (expirationStartInput) {
        const today = new Date().toISOString().split('T')[0];
        expirationStartInput.value = today;
    }
    const queryId = new URLSearchParams(window.location.search).get('id');
    if (!queryId) return;
    searchInput.value = queryId;
    loadProductById(queryId);
});

let currentProduct = null; 
let existingImages = [];    

function setSelectValue(selectElement, value) {
    if (!selectElement) return;
    const normalized = String(value || '').toLowerCase();
    const option = Array.from(selectElement.options).find(
        opt => String(opt.value).toLowerCase() === normalized
    );
    selectElement.value = option ? option.value : '';
}

function loadCategories() {
    if (!categorySelect) return;

    let categories = [];
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY_CATEGORIES));
        if (Array.isArray(parsed)) categories = parsed;
    } catch (_err) {
        categories = [];
    }

    const activeCategories = categories.filter(cat => cat.visibility === 'active');
    const source = activeCategories.length ? activeCategories : categories;

    categorySelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select category';
    categorySelect.appendChild(placeholder);

    source.forEach((cat) => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
}

async function loadProductById(id) {
    try {
        showLoading(true, 'Loading product...');
        const products = await loadProductsFromFolder(); 
        const product = products.find(p => String(p.id) === String(id));

        if (!product) {
            showLoading(false);
            showMessage('Product not found.', 'error');
            return;
        }

        currentProduct = product;

        form.dataset.productId = product.id;
        form.productName.value = product.name;
        form.description.value = product.description;
        form.price.value = product.price;
        form.discountPrice.value = product.discountPrice || '';
        form.taxIncluded.value = product.taxIncluded ? 'yes' : 'no';
        form.expirationStart.value = product.expirationStart || new Date().toISOString().split('T')[0];
        form.expirationEnd.value = product.expirationEnd || '';
        form.stockQuantity.value = product.stockQuantity || 0;
        form.stockStatus.value = product.stockStatus || '';

        setSelectValue(categorySelect, product.category);
        setSelectValue(tagSelect, product.tag);

        const checkboxes = form.querySelectorAll('input[name="colors"]');
        const selectedColors = Array.isArray(product.colors) ? product.colors : [];
        checkboxes.forEach(cb => cb.checked = selectedColors.includes(cb.value));

        existingImages = product.images || [];
        refreshPreview();

        showLoading(false);

    } catch (err) {
        console.error(err);
        showLoading(false);
        showMessage('Failed to load product.', 'error');
    }
}

searchButton.addEventListener('click', () => {
    const id = searchInput.value.trim();
    loadProductById(id);
});

function refreshPreview() {
    previewContainer.innerHTML = '';

    existingImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.style.margin = '8px';

        const image = document.createElement('img');
        image.src = img.url; 
        image.style.maxWidth = '140px';
        image.style.borderRadius = '6px';
        div.appendChild(image);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'X';
        delBtn.onclick = () => {
            existingImages.splice(index, 1);
            refreshPreview();
        };
        div.appendChild(delBtn);

        previewContainer.appendChild(div);
    });

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
        showMessage('No product selected for update.', 'error');
        return;
    }

    const productData = {
        ...currentProduct, 
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
        showLoading(true, 'Updating product...');
        await saveProductToDisk(productData, imageFiles); 
        showLoading(false);
        showMessage('Product updated successfully!', 'success');
        setTimeout(() => {
            window.location.href = 'ProductList.html';
        }, 900);
    } catch (err) {
        console.error(err);
        showLoading(false);
        showMessage('Failed to update product.', 'error');
    }
});
