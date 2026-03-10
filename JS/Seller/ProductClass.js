// Your add product script

import { saveProductToDisk } from '../Core/FileStorage.js';
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
        // ignore storage failures
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyStoredTheme();

    const form = document.getElementById('productForm');
    const fileInput = document.getElementById('imageUpload');
    const previewContainer = document.getElementById('previewContainer');
    const categorySelect = document.getElementById('categorySelect');

    const colorBoxes = document.querySelectorAll('.color');

    colorBoxes.forEach(box => {
        box.addEventListener('click', (e) => {
            e.preventDefault();

            const input = box.querySelector('input[type="checkbox"]');
            if (!input) return;

            box.classList.toggle('selected');
            input.checked = box.classList.contains('selected');
        });
    });

    const loadCategories = () => {
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
    };

    loadCategories();

    fileInput.addEventListener('change', () => {

        previewContainer.innerHTML = '';

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

    });

    form.addEventListener('submit', async (e) => {

        e.preventDefault();

        const formData = new FormData(form);

        // const selectedColors = formData.getAll('colors');


        const product = {
            name: formData.get('productName')?.trim() || '(no name)',
            description: formData.get('description')?.trim() || '',
            price: Number(formData.get('price')) || 0,
            discountPrice: Number(formData.get('discountPrice')) || null,
            taxIncluded: formData.get('taxIncluded') === 'yes',
            expirationStart: formData.get('expirationStart') || null,
            expirationEnd: formData.get('expirationEnd') || null,
            stockQuantity: Number(formData.get('stockQuantity')) || 0,
            stockStatus: formData.get('stockStatus'),
            // category: formData.get('category') || '',
            category: categorySelect?.value || "",
            // tag: formData.get('tag') || '',
            tag: document.getElementById("tagSelect").value || "",
            colors: colorBoxes,
            createdAt: new Date().toISOString(),
            images: []
        };

        const imageFiles = Array.from(fileInput.files || []);

        try {

            await saveProductToDisk(product, imageFiles);

            alert('Product saved successfully!');

            form.reset();
            previewContainer.innerHTML = '';
            fileInput.value = '';

        } catch (err) {

            console.error(err);
            alert('Save failed. Check console (F12).');

        }

    });

});
