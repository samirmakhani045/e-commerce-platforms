export async function findAllProducts(connection) {
  const [rows] = await connection.query(
    `SELECT
       id,
       name,
       description,
       image_url,
       quantity,
       selling_price,
       created_at,
       updated_at
     FROM products
     ORDER BY name ASC`,
  );

  return rows;
}

export async function findAllProductsAdmin(connection) {
  const [rows] = await connection.query(
    `SELECT
       id,
       name,
       description,
       image_url,
       quantity,
       purchase_price,
       selling_price,
       created_at,
       updated_at
     FROM products
     ORDER BY name ASC`,
  );

  return rows;
}

export async function findProductById(connection, id) {
  const [rows] = await connection.query(
    `SELECT
       id,
       name,
       description,
       image_url,
       quantity,
       purchase_price,
       selling_price,
       created_at,
       updated_at
     FROM products
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
}

export async function insertProduct(connection, product) {
  await connection.query(
    `INSERT INTO products (
       id,
       name,
       description,
       image_url,
       quantity,
       purchase_price,
       selling_price
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.name,
      product.description,
      product.image_url,
      product.quantity,
      product.purchase_price,
      product.selling_price,
    ],
  );
}

export async function updateProductById(connection, id, product) {
  const [result] = await connection.query(
    `UPDATE products
     SET
       name = ?,
       description = ?,
       image_url = ?,
       quantity = ?,
       purchase_price = ?,
       selling_price = ?
     WHERE id = ?`,
    [
      product.name,
      product.description,
      product.image_url,
      product.quantity,
      product.purchase_price,
      product.selling_price,
      id,
    ],
  );

  return result.affectedRows > 0;
}

export async function deleteProductById(connection, id) {
  const [result] = await connection.query('DELETE FROM products WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function countOrderItemsForProduct(connection, productId) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) AS itemCount FROM order_items WHERE product_id = ?',
    [productId],
  );

  return Number(rows[0]?.itemCount ?? 0);
}
