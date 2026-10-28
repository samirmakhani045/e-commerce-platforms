import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware.js';
import * as productController from './product.controller.js';

const router = Router();

router.get('/', productController.listProducts);

router.get('/manage', authenticate, requireAdmin, productController.listProductsAdmin);
router.post('/', authenticate, requireAdmin, productController.createProduct);
router.put('/:id', authenticate, requireAdmin, productController.updateProduct);
router.delete('/:id', authenticate, requireAdmin, productController.deleteProduct);

export default router;
