import { randomUUID } from 'crypto';
import pool from '../../config/db.js';
import {
  decrementProductQuantity,
  fetchRecentOrders,
  fetchReportChart,
  fetchReportSummary,
  findProductsForOrder,
  insertOrder,
  insertOrderItem,
} from './order.model.js';
import { broadcastProductStockUpdates } from '../../socket/index.js';

const COUPONS = {
  SAVE10: { type: 'percent', value: 10 },
  WELCOME5: { type: 'flat', value: 5, minSubtotal: 20 },
};

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function calculateDiscount(subtotal, couponCode) {
  if (!couponCode) {
    return { discountAmount: 0, appliedCoupon: null };
  }

  const normalizedCode = couponCode.trim().toUpperCase();
  const coupon = COUPONS[normalizedCode];

  if (!coupon) {
    const error = new Error('Invalid coupon code');
    error.statusCode = 400;
    throw error;
  }

  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    const error = new Error(
      `Coupon requires a minimum subtotal of $${coupon.minSubtotal.toFixed(2)}`,
    );
    error.statusCode = 400;
    throw error;
  }

  let discountAmount = 0;

  if (coupon.type === 'percent') {
    discountAmount = roundMoney(subtotal * (coupon.value / 100));
  } else {
    discountAmount = roundMoney(Math.min(coupon.value, subtotal));
  }

  return { discountAmount, appliedCoupon: normalizedCode };
}

export async function placeOrder(userId, items, couponCode) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Cart is empty');
    error.statusCode = 400;
    throw error;
  }

  const normalizedItems = items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
  }));

  for (const item of normalizedItems) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      const error = new Error('Invalid cart item');
      error.statusCode = 400;
      throw error;
    }
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const productIds = normalizedItems.map((item) => item.productId);
    const products = await findProductsForOrder(connection, productIds);
    const productMap = new Map(products.map((product) => [product.id, product]));

    const invalidItems = [];

    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);

      if (!product) {
        invalidItems.push({
          productId: item.productId,
          name: 'Unknown product',
          requested: item.quantity,
          available: 0,
        });
        continue;
      }

      if (item.quantity > product.quantity) {
        invalidItems.push({
          productId: product.id,
          name: product.name,
          requested: item.quantity,
          available: product.quantity,
        });
      }
    }

    if (invalidItems.length > 0) {
      const error = new Error('Some items are no longer available in the requested quantity');
      error.statusCode = 409;
      error.invalidItems = invalidItems;
      throw error;
    }

    let subtotal = 0;
    let totalCost = 0;
    const orderItems = [];

    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);
      const unitSellingPrice = Number(product.selling_price);
      const unitPurchasePrice = Number(product.purchase_price);
      const lineTotal = roundMoney(unitSellingPrice * item.quantity);
      const lineCost = roundMoney(unitPurchasePrice * item.quantity);
      const lineProfit = roundMoney(lineTotal - lineCost);

      subtotal = roundMoney(subtotal + lineTotal);
      totalCost = roundMoney(totalCost + lineCost);

      orderItems.push({
        product,
        quantity: item.quantity,
        unitSellingPrice,
        unitPurchasePrice,
        lineTotal,
        lineCost,
        lineProfit,
      });
    }

    const { discountAmount, appliedCoupon } = calculateDiscount(subtotal, couponCode);
    const total = roundMoney(Math.max(subtotal - discountAmount, 0));
    const grossProfit = roundMoney(total - totalCost);

    const orderId = randomUUID();

    await insertOrder(connection, {
      id: orderId,
      userId,
      status: 'paid',
      subtotal,
      discountAmount,
      total,
      totalCost,
      grossProfit,
      couponCode: appliedCoupon,
    });

    const stockUpdates = [];

    for (const line of orderItems) {
      await insertOrderItem(connection, {
        id: randomUUID(),
        orderId,
        productId: line.product.id,
        productName: line.product.name,
        quantity: line.quantity,
        unitSellingPrice: line.unitSellingPrice,
        unitPurchasePrice: line.unitPurchasePrice,
        lineTotal: line.lineTotal,
        lineCost: line.lineCost,
        lineProfit: line.lineProfit,
      });

      await decrementProductQuantity(connection, line.product.id, line.quantity);

      stockUpdates.push({
        productId: line.product.id,
        name: line.product.name,
        quantity: Number(line.product.quantity) - line.quantity,
      });
    }

    await connection.commit();
    broadcastProductStockUpdates(stockUpdates);

    return {
      orderId,
      subtotal,
      discountAmount,
      total,
      totalCost,
      grossProfit,
      couponCode: appliedCoupon,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getReportsDashboard() {
  const connection = await pool.getConnection();

  try {
    const summary = await fetchReportSummary(connection);
    const chart = await fetchReportChart(connection);
    const recentOrders = await fetchRecentOrders(connection);

    return {
      summary: {
        orderCount: Number(summary.orderCount),
        revenue: Number(summary.revenue),
        totalDiscount: Number(summary.totalDiscount),
        totalProfit: Number(summary.totalProfit),
        totalCost: Number(summary.totalCost),
      },
      chart: chart.map((row) => ({
        date: row.reportDate,
        orderCount: Number(row.orderCount),
        revenue: Number(row.revenue),
        discount: Number(row.discount),
        profit: Number(row.profit),
      })),
      recentOrders: recentOrders.map((row) => ({
        id: row.id,
        total: Number(row.total),
        discountAmount: Number(row.discount_amount),
        grossProfit: Number(row.gross_profit),
        couponCode: row.coupon_code,
        createdAt: row.created_at,
      })),
    };
  } finally {
    connection.release();
  }
}
