export async function findActiveUserByEmail(connection, email) {
  const [rows] = await connection.query(
    `SELECT id, email, password_hash, role, first_name, last_name
     FROM users
     WHERE email = ? AND is_active = 1
     LIMIT 1`,
    [email],
  );

  return rows[0] ?? null;
}
