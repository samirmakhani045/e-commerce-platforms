import { sendError, sendSuccess } from '../../utils/apiResponse.js';
import * as orderService from './order.service.js';

export async function payNow(req, res) {
  try {
    const { items, couponCode } = req.body;
    const result = await orderService.placeOrder(req.user.id, items, couponCode);

    return sendSuccess(res, result, 'Order placed successfully', 201);
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
        data: {
          invalidItems: error.invalidItems ?? [],
        },
      });
    }

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Unable to place order' : error.message;

    if (statusCode === 500) {
      console.error('Pay now error:', error.message);
    }

    return sendError(res, message, statusCode);
  }
}

export async function getReports(req, res) {
  try {
    const dashboard = await orderService.getReportsDashboard();
    return sendSuccess(res, dashboard, 'Reports fetched successfully');
  } catch (error) {
    console.error('Reports error:', error.message);
    return sendError(res, 'Failed to fetch reports', 500);
  }
}
