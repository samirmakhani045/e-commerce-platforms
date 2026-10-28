CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  status ENUM('paid', 'cancelled') NOT NULL DEFAULT 'paid',
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  gross_profit DECIMAL(10, 2) NOT NULL,
  coupon_code VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_created_at (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
