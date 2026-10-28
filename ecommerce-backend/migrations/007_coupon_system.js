export default async function runMigration(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS coupon_settings (
      id TINYINT UNSIGNED NOT NULL,
      order_interval_n INT UNSIGNED NOT NULL DEFAULT 5,
      discount_percent_x DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
      reservation_seconds INT UNSIGNED NOT NULL DEFAULT 60,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    INSERT INTO coupon_settings (id, order_interval_n, discount_percent_x, reservation_seconds)
    VALUES (1, 5, 10.00, 60)
    ON DUPLICATE KEY UPDATE id = id
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id CHAR(36) NOT NULL,
      code VARCHAR(64) NOT NULL,
      discount_type ENUM('percent', 'flat') NOT NULL DEFAULT 'percent',
      discount_value DECIMAL(10, 2) NOT NULL,
      source ENUM('milestone', 'admin') NOT NULL,
      milestone_seq INT UNSIGNED NULL,
      status ENUM('available', 'reserved', 'redeemed') NOT NULL DEFAULT 'available',
      reserved_by_user_id CHAR(36) NULL,
      reserved_until TIMESTAMP NULL,
      redeemed_order_id CHAR(36) NULL,
      redeemed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_coupons_code (code),
      UNIQUE KEY uk_coupons_milestone_seq (milestone_seq),
      KEY idx_coupons_status (status),
      KEY idx_coupons_reserved_until (reserved_until),
      CONSTRAINT fk_coupons_reserved_by FOREIGN KEY (reserved_by_user_id) REFERENCES users (id),
      CONSTRAINT fk_coupons_redeemed_order FOREIGN KEY (redeemed_order_id) REFERENCES orders (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
