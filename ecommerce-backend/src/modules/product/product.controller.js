import { sendError, sendSuccess } from '../../utils/apiResponse.js';
import * as productService from './product.service.js';

export async function listProducts(req, res) {
  try {
    const products = await productService.getProductList();
    return sendSuccess(res, products, 'Products fetched successfully');
  } catch (error) {
    console.error('List products error:', error.message);
    return sendError(res, 'Failed to fetch products', 500);
  }
}

export async function listProductsAdmin(req, res) {
  try {
    const products = await productService.getAdminProductList();
    return sendSuccess(res, products, 'Products fetched successfully');
  } catch (error) {
    console.error('Admin list products error:', error.message);
    return sendError(res, 'Failed to fetch products', 500);
  }
}

export async function createProduct(req, res) {
  try {
    const product = await productService.createProduct(req.body);
    return sendSuccess(res, product, 'Product created successfully', 201);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 500) {
      console.error('Create product error:', error.message);
    }

    return sendError(res, error.message || 'Failed to create product', statusCode);
  }
}

export async function updateProduct(req, res) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    return sendSuccess(res, product, 'Product updated successfully');
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 500) {
      console.error('Update product error:', error.message);
    }

    return sendError(res, error.message || 'Failed to update product', statusCode);
  }
}

export async function deleteProduct(req, res) {
  try {
    const result = await productService.removeProduct(req.params.id);
    return sendSuccess(res, result, 'Product deleted successfully');
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 500) {
      console.error('Delete product error:', error.message);
    }

    return sendError(res, error.message || 'Failed to delete product', statusCode);
  }
}
