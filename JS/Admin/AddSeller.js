import { KEY_USERS } from '../Core/Constants.js';
import { pushItem } from '../Core/Storage.js';
import { ROLES } from '../Core/Auth.js';

const fields = [
    'fullName', 'email', 'password', 'phone',
    'storeName', 'city', 'description', 'paymentMethod'
];

function getField(name) {
    return $(`[name="${name}"]`);
}

$(document).ready(function () {

    fields.forEach(name => {
        const saved = sessionStorage.getItem(name);
        if (saved) getField(name).val(saved);
    });

    fields.forEach(name => {
        getField(name).on('input', function () {
            sessionStorage.setItem(name, $(this).val());
        });
    });

    $('#sellerForm').on('submit', function (e) {
        e.preventDefault();

        if (!this.checkValidity()) {
            e.stopPropagation();
            $(this).addClass('was-validated');
            return;
        }

        $(this).addClass('was-validated');
        addSeller();
    });
});

function addSeller() {
    const sellerId = 'seller_' + Date.now().toString(36).slice(-8);

    const sellerUser = {
        id: sellerId,
        name: getField('fullName').val().trim(),
        email: getField('email').val().trim().toLowerCase(),
        password: getField('password').val(),           // WARNING: plain text – only for learning!
        phone: getField('phone').val().trim(),
        role: ROLES.SELLER,
        storeName: getField('storeName').val().trim(),
        storeDescription: getField('description').val().trim(),
        city: getField('city').val().trim(),
        paymentMethod: getField('paymentMethod').val(),
        createdAt: new Date().toISOString()
    };

    // 1. Add to main users collection
    pushItem(KEY_USERS, sellerUser);

    // Clear temporary session storage
    fields.forEach(name => sessionStorage.removeItem(name));

    // Optional: show success message
    alert('Seller account created successfully');

    // Redirect to sellers list
    location.href = '/Html/Admin/ShowSellers.html';
}