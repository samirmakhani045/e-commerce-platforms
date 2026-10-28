import { randomUUID } from 'crypto';
import pool from '../../config/db.js';
import { broadcastProductStockUpdates } from '../../socket/index.js';
import {
  countOrderItemsForProduct,
  deleteProductById,
  findAllProducts,
  findAllProductsAdmin,
  findProductById,
  insertProduct,
  updateProductById,
} from './product.model.js';

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

function formatAdminProduct(product) {
  return {
    ...formatProduct(product),
    purchasePrice: Number(product.purchase_price),
  };
}

function parseMoney(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`${fieldName} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }

  return Math.round(parsed * 100) / 100;
}

function parseQuantity(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    const error = new Error('Quantity must be a non-negative whole number');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function validateProductPayload(payload, { partial = false } = {}) {
  const fields = {};

  if (!partial || payload.name !== undefined) {
    const name = String(payload.name ?? '').trim();

    if (!name) {
      const error = new Error('Product name is required');
      error.statusCode = 400;
      throw error;
    }

    fields.name = name;
  }

  if (!partial || payload.description !== undefined) {
    const description = String(payload.description ?? '').trim();

    if (!description) {
      const error = new Error('Product description is required');
      error.statusCode = 400;
      throw error;
    }

    fields.description = description;
  }

  if (!partial || payload.imageUrl !== undefined) {
    const imageUrl = String(payload.imageUrl ?? '').trim();

    if (!imageUrl) {
      const error = new Error('Image URL is required');
      error.statusCode = 400;
      throw error;
    }

    fields.image_url = imageUrl;
  }

  if (!partial || payload.quantity !== undefined) {
    fields.quantity = parseQuantity(payload.quantity);
  }

  if (!partial || payload.purchasePrice !== undefined) {
    fields.purchase_price = parseMoney(payload.purchasePrice, 'Purchase price');
  }

  if (!partial || payload.sellingPrice !== undefined) {
    fields.selling_price = parseMoney(payload.sellingPrice, 'Selling price');
  }

  return fields;
}

export async function getProductList() {
  const products = await findAllProducts(pool);
  return products.map(formatProduct);
}

export async function getAdminProductList() {
  const products = await findAllProductsAdmin(pool);
  return products.map(formatAdminProduct);
}

export async function createProduct(payload) {
  const fields = validateProductPayload(payload);
  const id = randomUUID();

  try {
    await insertProduct(pool, { id, ...fields });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('A product with this name already exists');
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }

  const created = await findProductById(pool, id);
  broadcastProductStockUpdates([
    {
      productId: id,
      name: created.name,
      quantity: created.quantity,
    },
  ]);

  return formatAdminProduct(created);
}

export async function updateProduct(id, payload) {
  const existing = await findProductById(pool, id);

  if (!existing) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  const fields = validateProductPayload(payload, { partial: true });
  const merged = {
    name: fields.name ?? existing.name,
    description: fields.description ?? existing.description,
    image_url: fields.image_url ?? existing.image_url,
    quantity: fields.quantity ?? existing.quantity,
    purchase_price: fields.purchase_price ?? existing.purchase_price,
    selling_price: fields.selling_price ?? existing.selling_price,
  };

  try {
    await updateProductById(pool, id, merged);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('A product with this name already exists');
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }

  const updated = await findProductById(pool, id);

  if (fields.quantity !== undefined && fields.quantity !== existing.quantity) {
    broadcastProductStockUpdates([
      {
        productId: id,
        name: updated.name,
        quantity: updated.quantity,
      },
    ]);
  }

  return formatAdminProduct(updated);
}

export async function removeProduct(id) {
  const existing = await findProductById(pool, id);

  if (!existing) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  const orderItemCount = await countOrderItemsForProduct(pool, id);

  if (orderItemCount > 0) {
    const error = new Error('Cannot delete a product that appears in past orders');
    error.statusCode = 409;
    throw error;
  }

  await deleteProductById(pool, id);

  broadcastProductStockUpdates([
    {
      productId: id,
      name: existing.name,
      quantity: 0,
    },
  ]);

  return { id };
}
