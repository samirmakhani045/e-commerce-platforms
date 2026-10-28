import { sendError, sendSuccess } from '../../utils/apiResponse.js';
import * as couponService from './coupon.service.js';

export async function getSettings(req, res) {
  try {
    const settings = await couponService.getSettings();
    return sendSuccess(res, settings, 'Coupon settings fetched');
  } catch (error) {
    console.error('Get coupon settings error:', error.message);
    return sendError(res, 'Failed to fetch coupon settings', 500);
  }
}

export async function updateSettings(req, res) {
  try {
    const settings = await couponService.saveSettings(req.body);
    return sendSuccess(res, settings, 'Coupon settings updated');
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 500) {
      console.error('Update coupon settings error:', error.message);
    }

    return sendError(res, error.message || 'Failed to update coupon settings', statusCode);
  }
}

export async function listCoupons(req, res) {
  try {
    const coupons = await couponService.getAdminCoupons();
    return sendSuccess(res, coupons, 'Coupons fetched');
  } catch (error) {
    console.error('List coupons error:', error.message);
    return sendError(res, 'Failed to fetch coupons', 500);
  }
}

export async function getMilestoneStatus(req, res) {
  try {
    const status = await couponService.getMilestoneGenerationStatus();
    return sendSuccess(res, status, 'Milestone coupon status fetched');
  } catch (error) {
    console.error('Milestone status error:', error.message);
    return sendError(res, 'Failed to fetch milestone coupon status', 500);
  }
}

export async function generateMilestoneCoupon(req, res) {
  try {
    const coupon = await couponService.generateMilestoneCouponAdmin(req.body);
    return sendSuccess(res, coupon, 'Milestone coupon generated', 201);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 500) {
      console.error('Generate milestone coupon error:', error.message);
    }

    return sendError(res, error.message || 'Failed to generate milestone coupon', statusCode);
  }
}

export async function reserveCheckoutCoupon(req, res) {
  try {
    const result = await couponService.reserveCheckoutCoupon(req.user.id);
    return sendSuccess(res, result, 'Checkout coupon status fetched');
  } catch (error) {
    console.error('Checkout coupon error:', error.message);
    return sendError(res, 'Failed to fetch checkout coupon', 500);
  }
}
