import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware.js';
import * as orderController from './order.controller.js';

const router = Router();

router.post('/pay', authenticate, orderController.payNow);
router.get('/reports/dashboard', authenticate, requireAdmin, orderController.getReports);

export default router;
