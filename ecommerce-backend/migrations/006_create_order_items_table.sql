CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_selling_price DECIMAL(10, 2) NOT NULL,
  unit_purchase_price DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,
  line_cost DECIMAL(10, 2) NOT NULL,
  line_profit DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_product_id (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
