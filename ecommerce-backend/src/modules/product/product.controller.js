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
