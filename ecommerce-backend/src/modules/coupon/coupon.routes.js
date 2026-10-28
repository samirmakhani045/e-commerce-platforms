import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware.js';
import * as couponController from './coupon.controller.js';

const router = Router();

router.get('/settings', authenticate, requireAdmin, couponController.getSettings);
router.put('/settings', authenticate, requireAdmin, couponController.updateSettings);
router.get('/milestone-status', authenticate, requireAdmin, couponController.getMilestoneStatus);
router.post('/generate-milestone', authenticate, requireAdmin, couponController.generateMilestoneCoupon);
router.get('/', authenticate, requireAdmin, couponController.listCoupons);

export default router;
