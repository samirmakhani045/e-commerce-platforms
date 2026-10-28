import { Router } from 'express';
import * as userController from './user.controller.js';

const router = Router();

router.post('/login', userController.login);

export default router;
