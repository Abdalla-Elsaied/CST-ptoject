/**
 * admin-data-products.js
 * Service layer for products. Handles fetching, caching, and filtering.
 */
import { loadProductsForAdmin, saveProductToDisk, deleteProductFromDisk } from '../Core/FileStorage.js';
import { getLS, setLS } from '../Core/Storage.js';
import { KEY_PRODUCTS } from '../Core/Constants.js';

// Memory cache to avoid repeated LS parsing
let _productsCache = null;

/**
 * Loads products from LocalStorage or Remote API.
 * @param {boolean} forceSync - If true, fetches from MockAPI even if cache exists.
 */
export async function fetchProducts(forceSync = false) {
    // If not forcing sync and we have a cache, return it
    if (!forceSync && _productsCache) {
        return _productsCache;
    }

    // Try to load from Remote API if forced or if LocalStorage is empty
    const stored = getLS(KEY_PRODUCTS);
    if (forceSync || !stored || stored.length === 0) {
        try {
            const remoteProducts = await loadProductsForAdmin();
            if (remoteProducts && remoteProducts.length > 0) {
                setLS(KEY_PRODUCTS, remoteProducts);
                _productsCache = remoteProducts;
                return _productsCache;
            }
        } catch (err) {
            console.error("Remote fetch failed, falling back to local storage", err);
        }
    }

    _productsCache = stored || [];
    return _productsCache;
}

/**
 * Returns products from memory cache if available, otherwise from LS.
 */
export function getCachedProducts() {
    if (!_productsCache) {
        _productsCache = getLS(KEY_PRODUCTS) || [];
    }
    return _productsCache;
}

/**
 * Returns filtered and paginated products.
 */
export function getFilteredProducts(filters) {
    const products = getCachedProducts();
    const { search, category, status, page, limit } = filters;

    // 1. Filtering (Compute once)
    const filtered = products.filter(p => {
        const pName = (p.name || p.productName || '').toLowerCase();
        const pCategory = p.category || p.productCategory || '';
        
        const matchSearch = !search || pName.includes(search.toLowerCase());
        const matchCategory = category === 'All' || pCategory === category;
        const matchStatus = status === 'All' ||
            (status === 'Active' && p.isActive) ||
            (status === 'Inactive' && !p.isActive);
            
        return matchSearch && matchCategory && matchStatus;
    });

    // 2. Pagination
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
 * Updates product status and syncs with Remote API.
 */
export async function updateProductStatus(id, isActive) {
    const products = getCachedProducts();
    const index = products.findIndex(p => p.id == id);
    if (index === -1) return false;

    const product = { ...products[index], isActive };
    
    try {
        await saveProductToDisk(product); // Sync with MockAPI
        products[index] = product;
        setLS(KEY_PRODUCTS, products);
        _productsCache = products;
        return true;
    } catch (err) {
        console.error("Failed to sync product status", err);
        throw err;
    }
}

/**
 * Deletes product and syncs with Remote API.
 */
export async function deleteProduct(id) {
    try {
        await deleteProductFromDisk(id); // Sync with MockAPI
        const products = getCachedProducts().filter(p => p.id != id);
        setLS(KEY_PRODUCTS, products);
        _productsCache = products;
        return true;
    } catch (err) {
        console.error('[PRODUCTS] Failed to delete remotely:', err);
        throw new Error('Could not delete product. Please check your connection and try again.');
    }
}
