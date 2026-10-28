import jwt from 'jsonwebtoken';
import { sendError } from '../utils/apiResponse.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', 401);
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return sendError(res, 'Server authentication is not configured', 500);
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  return next();
}
