import { Router } from 'express';
import userRoutes from '../modules/user/user.routes.js';
import productRoutes from '../modules/product/product.routes.js';
import orderRoutes from '../modules/order/order.routes.js';
import couponRoutes from '../modules/coupon/coupon.routes.js';

const router = Router();

router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/coupons', couponRoutes);

export default router;
