import { sendError, sendSuccess } from '../../utils/apiResponse.js';
import * as userService from './user.service.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    const result = await userService.loginUser(email, password);

    return sendSuccess(res, result, 'Login successful');
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Login failed' : error.message;

    if (statusCode === 500) {
      console.error('Login error:', error.message);
    }

    return sendError(res, message, statusCode);
  }
}
