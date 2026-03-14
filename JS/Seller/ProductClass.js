
import { saveProductToDisk } from '../Core/FileStorage.js';
import { KEY_CATEGORIES } from '../Core/Constants.js';
import { getCurrentUser, ROLES } from '../Core/Auth.js';

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

document.addEventListener('DOMContentLoaded', () => {
    applyStoredTheme();

    const form = document.getElementById('productForm');
    const fileInput = document.getElementById('imageUpload');
    const previewContainer = document.getElementById('previewContainer');
    const categorySelect = document.getElementById('categorySelect');
    const expirationStartInput = form?.querySelector('input[name="expirationStart"]');
    const messageEl = document.getElementById('pageMessage');
    const loadingEl = document.getElementById('pageLoading');
    const loadingTextEl = document.getElementById('pageLoadingText');

    const colorInputs = document.querySelectorAll('input[name="colors"]');
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

    if (expirationStartInput) {
        const today = new Date().toISOString().split('T')[0];
        expirationStartInput.value = today;
    }

    const syncColorSelection = () => {
        colorInputs.forEach(input => {
            const label = input.closest('.color');
            if (label) label.classList.toggle('selected', input.checked);
        });
    };

    if (colorInputs.length > 0 && !Array.from(colorInputs).some(input => input.checked)) {
        colorInputs[0].checked = true;
    }
    syncColorSelection();

    colorInputs.forEach(input => {
        input.addEventListener('change', syncColorSelection);
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



        const currentUser = getCurrentUser();
        const sellerId = currentUser?.id ?? null;

        if (currentUser.role != ROLES.SELLER){
            console.error("only seller can add products")
            return;
        }
            

        const selectedColors = Array.from(colorInputs)
            .filter(input => input.checked)
            .map(input => input.value);

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
            category: categorySelect?.value || "",
            tag: document.getElementById("tagSelect").value || "",
            colors: selectedColors,
            createdAt: new Date().toISOString(),
            sellerId,
            images: []
        };

        const imageFiles = Array.from(fileInput.files || []);

        try {
            showLoading(true, 'Saving product...');

            await saveProductToDisk(product, imageFiles);

            showLoading(false);
            showMessage('Product saved successfully! Please wait for admin approval.', 'success');

            form.reset();
            previewContainer.innerHTML = '';
            fileInput.value = '';
            if (colorInputs.length > 0) {
                colorInputs[0].checked = true;
            }
            syncColorSelection();

        } catch (err) {

            console.error(err);
            showLoading(false);
            showMessage('Save failed. Check console (F12).', 'error');

        }

    });

});
