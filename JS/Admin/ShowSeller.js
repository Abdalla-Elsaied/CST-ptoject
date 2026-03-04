
function getSellers() {
    return JSON.parse(localStorage.getItem('sellers') || '[]');
}

function saveSellers(sellers) {
    localStorage.setItem('sellers', JSON.stringify(sellers));
}

function renderTable() {
    const sellers = getSellers();
    const tbody = document.getElementById('sellersBody');
    tbody.innerHTML = '';

    if (sellers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted py-4">No sellers registered yet.</td>
            </tr>`;
        return;
    }

    sellers.forEach((seller, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${seller.fullName}</td>
            <td>${seller.email}</td>
            <td>${seller.phone}</td>
            <td>${seller.storeName}</td>
            <td>${seller.description}</td>
            <td>${seller.city}</td>
            <td>${seller.paymentMethod}</td>
            <td class="text-center">
                <button class="btn btn-success btn-sm me-1" onclick="openUpdate(${seller.id})">Update</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSeller(${seller.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteSeller(id) {
    if (!confirm('Are you sure you want to delete this seller?')) return;
    const updated = getSellers().filter(s => s.id !== id);
    saveSellers(updated);
    renderTable();
}

function openUpdate(id) {
    const seller = getSellers().find(s => s.id === id);
    if (!seller) return;

    document.getElementById('editId').value            = seller.id;
    document.getElementById('editFullName').value      = seller.fullName;
    document.getElementById('editEmail').value         = seller.email;
    document.getElementById('editPhone').value         = seller.phone;
    document.getElementById('editStoreName').value     = seller.storeName;
    document.getElementById('editCity').value          = seller.city;
    document.getElementById('editDescription').value   = seller.description;
    document.getElementById('editPaymentMethod').value = seller.paymentMethod;

    new bootstrap.Modal(document.getElementById('updateModal')).show();
}

function saveUpdate() {
    const id      = Number(document.getElementById('editId').value);
    const sellers = getSellers();
    const index   = sellers.findIndex(s => s.id === id);
    if (index === -1) return;

    sellers[index] = {
        ...sellers[index],
        fullName:      document.getElementById('editFullName').value,
        email:         document.getElementById('editEmail').value,
        phone:         document.getElementById('editPhone').value,
        storeName:     document.getElementById('editStoreName').value,
        city:          document.getElementById('editCity').value,
        description:   document.getElementById('editDescription').value,
        paymentMethod: document.getElementById('editPaymentMethod').value
    };

    saveSellers(sellers);
    bootstrap.Modal.getInstance(document.getElementById('updateModal')).hide();
    renderTable();
}

renderTable();