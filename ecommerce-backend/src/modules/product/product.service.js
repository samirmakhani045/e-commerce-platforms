import pool from '../../config/db.js';
import { findAllProducts } from './product.model.js';

function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.image_url,
    quantity: product.quantity,
    sellingPrice: Number(product.selling_price),
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

export async function getProductList() {
  const products = await findAllProducts(pool);
  return products.map(formatProduct);
}
