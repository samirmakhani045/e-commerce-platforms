import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware.js';
import { reserveCheckoutCoupon } from '../coupon/coupon.controller.js';
import * as orderController from './order.controller.js';

const router = Router();

router.get('/checkout-coupon', authenticate, reserveCheckoutCoupon);
router.post('/pay', authenticate, orderController.payNow);
router.get('/reports/dashboard', authenticate, requireAdmin, orderController.getReports);

export default router;
