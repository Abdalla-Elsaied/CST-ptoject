const API_BASE = "https://69abf0bc9ca639a5217dcac2.mockapi.io/api";
const PRODUCTS_ENDPOINT = `${API_BASE}/Products`;

/*
https://69abf0bc9ca639a5217dcac2.mockapi.io/api/Products ;


*/
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dfrz2rmsd/upload";
const UPLOAD_PRESET = "Product_images";
const CLOUD_FOLDER = "Product_Images";

// ────────────────────────────────────────────────
// Remote storage capability
// ────────────────────────────────────────────────

/**
 * Upload image to Cloudinary
 */
async function uploadImageToCloudinary(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", CLOUD_FOLDER);

  const response = await fetch(CLOUDINARY_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }

  const data = await response.json();

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    url: data.secure_url,
  };
}

/**
 * Save product to MockAPI (POST or PUT)
 */
export async function saveProductToDisk(product, imageFiles = []) {
  try {
    const imagesData = [];

    for (const file of imageFiles) {
      if (file.type.startsWith("image/")) {
        const uploadedImage = await uploadImageToCloudinary(file);

        imagesData.push(uploadedImage);
      }
    }

    const baseImages = Array.isArray(product.images) ? product.images : [];
    product.images = imagesData.length ? [...baseImages, ...imagesData] : baseImages;
    product.updatedAt = new Date().toISOString();

    let response;

    if (product.id) {
      response = await fetch(`${PRODUCTS_ENDPOINT}/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    } else {
      response = await fetch(PRODUCTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const savedProduct = await response.json();

    product.id = savedProduct.id;

    console.log("Product saved to MockAPI:", savedProduct);

    return true;
  } catch (err) {
    console.error("Failed to save product to API:", err);
    throw err;
  }
}

/**
 * Load all products from MockAPI
 */
export async function loadProductsFromFolder() {
  try {
    const response = await fetch(PRODUCTS_ENDPOINT);

    if (!response.ok) {
      throw new Error(`Failed to load products: ${response.status}`);
    }

    const products = await response.json();

    console.log(`Loaded ${products.length} products from MockAPI`);

    return products;
  } catch (err) {
    console.error("Load from API failed:", err);

    alert("Could not load products from server.\n\n" + err.message);

    return [];
  }
}

/**
 * Delete product from MockAPI
 */
export async function deleteProductFromDisk(productId) {
  if (!productId) {
    throw new Error("Missing product id.");
  }

  const response = await fetch(`${PRODUCTS_ENDPOINT}/${productId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API delete error ${response.status}: ${errText}`);
  }

  return true;
}

export function getLS(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export function setLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function removeLS(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

