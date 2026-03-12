/**
 * admin-data-orders.js
 * Service layer for orders. Handles fetching (local only for now, can be extended to Remote API),
 * caching, and filtering.
 */
import { getLS, setLS } from '../Core/Storage.js';
import { KEY_ORDERS } from '../Core/Constants.js';

// Memory cache
let _ordersCache = null;

/**
 * Loads orders from LocalStorage.
 */
export function fetchOrders() {
    if (!_ordersCache) {
        _ordersCache = getLS(KEY_ORDERS) || [];
    }
    return _ordersCache;
}

/**
 * Returns filtered and paginated orders.
 */
export function getFilteredOrders(filters) {
    const orders = fetchOrders();
    const { search, status, dateFrom, dateTo, page, limit } = filters;

    const filtered = orders.filter(o => {
        const orderId = String(o.id || '');
        const customerId = String(o.customerId || '');
        const matchSearch = !search || orderId.includes(search) || customerId.includes(search);
        const matchStatus = status === 'All' || o.status === status;

        let matchDate = true;
        const orderDateStr = o.createdAt || o.orderDate;
        if (orderDateStr) {
            const date = new Date(orderDateStr).getTime();
            if (dateFrom) matchDate = matchDate && date >= new Date(dateFrom).getTime();
            if (dateTo) matchDate = matchDate && date <= new Date(dateTo).getTime();
        }

        return matchSearch && matchStatus && matchDate;
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.min(Math.max(1, page), totalPages || 1);

    const start = (currentPage - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return {
        items: paginated,
        totalItems,
        totalPages,
        currentPage
    };
}

/**
 * Updates order status.
 */
export function updateOrderStatus(orderId, newStatus) {
    const orders = fetchOrders();
    const index = orders.findIndex(o => o.id == orderId);
    if (index === -1) return false;

    orders[index].status = newStatus;
    orders[index].updatedAt = new Date().toISOString();
    
    setLS(KEY_ORDERS, orders);
    _ordersCache = orders;
    return true;
}
