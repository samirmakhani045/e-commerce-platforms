export async function findProductsForOrder(connection, productIds) {
  if (productIds.length === 0) {
    return [];
  }

  const placeholders = productIds.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT id, name, quantity, selling_price, purchase_price
     FROM products
     WHERE id IN (${placeholders})
     FOR UPDATE`,
    productIds,
  );

  return rows;
}

export async function insertOrder(connection, order) {
  await connection.query(
    `INSERT INTO orders (
      id, user_id, status, subtotal, discount_amount, total,
      total_cost, gross_profit, coupon_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.id,
      order.userId,
      order.status,
      order.subtotal,
      order.discountAmount,
      order.total,
      order.totalCost,
      order.grossProfit,
      order.couponCode,
    ],
  );
}

export async function insertOrderItem(connection, item) {
  await connection.query(
    `INSERT INTO order_items (
      id, order_id, product_id, product_name, quantity,
      unit_selling_price, unit_purchase_price, line_total, line_cost, line_profit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.orderId,
      item.productId,
      item.productName,
      item.quantity,
      item.unitSellingPrice,
      item.unitPurchasePrice,
      item.lineTotal,
      item.lineCost,
      item.lineProfit,
    ],
  );
}

export async function decrementProductQuantity(connection, productId, quantity) {
  await connection.query(
    `UPDATE products
     SET quantity = quantity - ?
     WHERE id = ? AND quantity >= ?`,
    [quantity, productId, quantity],
  );
}

export async function fetchReportSummary(connection) {
  const [totals] = await connection.query(
    `SELECT
       COUNT(*) AS orderCount,
       COALESCE(SUM(total), 0) AS revenue,
       COALESCE(SUM(discount_amount), 0) AS totalDiscount,
       COALESCE(SUM(gross_profit), 0) AS totalProfit,
       COALESCE(SUM(total_cost), 0) AS totalCost
     FROM orders
     WHERE status = 'paid'`,
  );

  return totals[0];
}

export async function fetchReportChart(connection) {
  const [rows] = await connection.query(
    `SELECT
       DATE(created_at) AS reportDate,
       COUNT(*) AS orderCount,
       COALESCE(SUM(total), 0) AS revenue,
       COALESCE(SUM(discount_amount), 0) AS discount,
       COALESCE(SUM(gross_profit), 0) AS profit
     FROM orders
     WHERE status = 'paid'
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at)
     ORDER BY reportDate ASC`,
  );

  return rows;
}

export async function fetchRecentOrders(connection, limit = 10) {
  const [rows] = await connection.query(
    `SELECT
       id,
       total,
       discount_amount,
       gross_profit,
       coupon_code,
       created_at
     FROM orders
     WHERE status = 'paid'
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  );

  return rows;
}
