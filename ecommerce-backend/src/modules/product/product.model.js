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
