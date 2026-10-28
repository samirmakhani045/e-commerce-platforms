import { Router } from 'express';
import userRoutes from '../modules/user/user.routes.js';
import productRoutes from '../modules/product/product.routes.js';

const router = Router();

router.use('/users', userRoutes);
router.use('/products', productRoutes);

export default router;
