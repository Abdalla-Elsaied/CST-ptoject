/**
 * FileStorage.js
 * Loads products from MockAPI.
 */
export async function loadProductsFromFolder() {
  try {
    const API_BASE = 'https://69abf0bc9ca639a5217dcac2.mockapi.io/api';
    const PRODUCTS_ENDPOINT = `${API_BASE}/Products`;

    const response = await fetch(PRODUCTS_ENDPOINT);

    if (!response.ok) {
      throw new Error(`Failed to load products: ${response.status}`);
    }

    const products = await response.json();
    console.log(`Loaded ${products.length} products from MockAPI`);
    return products;

  } catch (err) {
    console.error('Load from API failed:', err);
    return [];
  }
}
