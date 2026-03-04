const fields = ['fullName', 'email', 'password', 'phone', 'storeName', 'city', 'description', 'paymentMethod'];

function getField(name) {
    return $(`[name="${name}"]`);
}

$(document).ready(function () {

    // Restore fields on reload
    fields.forEach(name => {
        const saved = sessionStorage.getItem(name);
        if (saved) getField(name).val(saved);
    });

    // Save fields on input
    fields.forEach(name => {
        getField(name).on('input', () => {
            sessionStorage.setItem(name, getField(name).val());
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
        AddSellerData();
    });

});

function AddSellerData() {
    const seller = {
        id:            Date.now(),
        fullName:      getField('fullName').val(),
        email:         getField('email').val(),
        password:      getField('password').val(),
        phone:         getField('phone').val(),
        storeName:     getField('storeName').val(),
        city:          getField('city').val(),
        description:   getField('description').val(),
        paymentMethod: getField('paymentMethod').val()
    };

    const sellers = JSON.parse(localStorage.getItem('sellers') || '[]');
    sellers.push(seller);
    localStorage.setItem('sellers', JSON.stringify(sellers));

    fields.forEach(name => sessionStorage.removeItem(name));

    location.href = '/Html/Admin/ShowSellers.html';
}