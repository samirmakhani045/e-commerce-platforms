import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const DEFAULT_PASSWORD = 'root';
const SALT_ROUNDS = 10;

const seedUsers = [
  {
    email: 'samirmakhani045+1@gmail.com',
    role: 'customer',
    first_name: 'Customer',
    last_name: 'One',
  },
  {
    email: 'samirmakhani045+2@gmail.com',
    role: 'customer',
    first_name: 'Customer',
    last_name: 'Two',
  },
  {
    email: 'samirmakhani045+3@gmail.com',
    role: 'customer',
    first_name: 'Customer',
    last_name: 'Three',
  },
  {
    email: 'samirmakhani045+4@gmail.com',
    role: 'customer',
    first_name: 'Customer',
    last_name: 'Four',
  },
  {
    email: 'samirmakhani045+5@gmail.com',
    role: 'customer',
    first_name: 'Customer',
    last_name: 'Five',
  },
  {
    email: 'admin@example.com',
    role: 'admin',
    first_name: 'Admin',
    last_name: 'User',
  },
];

export default async function seedUsersMigration(pool) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  for (const user of seedUsers) {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [user.email],
    );

    if (existing.length > 0) {
      continue;
    }

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        user.email,
        passwordHash,
        user.role,
        user.first_name,
        user.last_name,
      ],
    );
  }
}
