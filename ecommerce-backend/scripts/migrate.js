import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_schema_migrations_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedMigrationNames() {
  const [rows] = await pool.query(
    'SELECT name FROM schema_migrations ORDER BY name ASC',
  );
  return new Set(rows.map((row) => row.name));
}

async function runSqlMigration(filePath, name) {
  const sql = await fs.readFile(filePath, 'utf8');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(sql);
    await connection.query(
      'INSERT INTO schema_migrations (name) VALUES (?)',
      [name],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function runJsMigration(filePath, name) {
  const module = await import(`file://${filePath}`);
  const runMigration = module.default;

  if (typeof runMigration !== 'function') {
    throw new Error(`Migration ${name} must export a default async function`);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await runMigration(connection);
    await connection.query(
      'INSERT INTO schema_migrations (name) VALUES (?)',
      [name],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function runMigrations() {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrationNames();
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql') || file.endsWith('.js'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipped (already applied): ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    console.log(`Applying: ${file}`);

    if (file.endsWith('.sql')) {
      await runSqlMigration(filePath, file);
    } else {
      await runJsMigration(filePath, file);
    }

    console.log(`Applied: ${file}`);
  }

  console.log('Migrations complete.');
}

runMigrations()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
