// Your add product script

import { saveProductToDisk } from '../Core/FileStorage.js';

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('productForm');
    const fileInput = document.getElementById('imageUpload');
    const previewContainer = document.getElementById('previewContainer');

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
            category: document.getElementById("categorySelect").value || "",
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
