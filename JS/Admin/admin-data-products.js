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
    const stored = getLS(KEY_PRODUCTS) || [];

    // If not forcing sync, use localStorage as-is (fast path for filter changes etc.)
    if (!forceSync) {
        _productsCache = stored;
        return _productsCache;
    }

    // forceSync = true (called on section entry) — always re-fetch from MockAPI
    // so new products added by sellers appear without reload/re-login
    try {
        const remoteProducts = await loadProductsForAdmin();
        if (remoteProducts && remoteProducts.length > 0) {
            // Merge: preserve local isActive overrides — admin toggles write
            // to localStorage immediately and should not be overwritten by MockAPI.
            // Normalize undefined → false so products default to inactive until admin approves.
            const localMap = new Map(stored.map(p => [String(p.id), p]));
            const merged = remoteProducts.map(remote => {
                const local = localMap.get(String(remote.id));
                if (local && local.isActive !== undefined) {
                    return { ...remote, isActive: local.isActive };
                }
                // No local record or no local isActive — normalize: treat undefined as false
                return { ...remote, isActive: remote.isActive === true ? true : false };
            });
            setLS(KEY_PRODUCTS, merged);
            _productsCache = merged;
            return _productsCache;
        }
    } catch (err) {
        console.error("Remote fetch failed, using localStorage", err);
    }

    // Normalize isActive for products already in localStorage (undefined → false)
    const normalized = stored.map(p => ({
        ...p,
        isActive: p.isActive === true ? true : false
    }));
    if (JSON.stringify(normalized) !== JSON.stringify(stored)) {
        setLS(KEY_PRODUCTS, normalized);
    }
    _productsCache = normalized;
    return _productsCache;
}

/**
 * Returns products from memory cache if available, otherwise from LS.
 */
export function getCachedProducts() {
    // Always read from localStorage to pick up changes from any tab/module
    _productsCache = getLS(KEY_PRODUCTS) || [];
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
        // isActive defaults to true when undefined/null (products from sellers may not set it)
        // Only treat a product as Inactive when isActive is explicitly === false
        const activeFlag = p.isActive !== false;
        const matchStatus = status === 'All' ||
            (status === 'Active'   &&  activeFlag) ||
            (status === 'Inactive' && !activeFlag);
            
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
    // Always read fresh from localStorage to avoid stale cache
    const products = getLS(KEY_PRODUCTS) || [];
    const index = products.findIndex(p => p.id == id);
    if (index === -1) return false;

    // Update locally first so UI reflects change immediately
    const product = { ...products[index], isActive };
    products[index] = product;
    setLS(KEY_PRODUCTS, products);
    _productsCache = products;

    try {
        await saveProductToDisk(product); // Sync with MockAPI in background
        return true;
    } catch (err) {
        console.error("Failed to sync product status with MockAPI", err);
        // Status already saved locally — don't throw, just warn
        return true;
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