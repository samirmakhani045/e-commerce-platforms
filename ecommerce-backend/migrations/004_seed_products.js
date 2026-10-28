import { randomUUID } from 'crypto';

const seedProducts = [
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'Over-ear headphones with active noise cancellation and 30-hour battery life.',
    image_url: 'https://picsum.photos/seed/headphones/640/480',
    quantity: 5,
    purchase_price: 45.0,
    selling_price: 79.99,
  },
  {
    name: 'Smart Watch Series',
    description: 'Fitness tracking, heart rate monitor, and smartphone notifications on your wrist.',
    image_url: 'https://picsum.photos/seed/smartwatch/640/480',
    quantity: 4,
    purchase_price: 62.5,
    selling_price: 119.0,
  },
  {
    name: 'USB-C Laptop Charger 65W',
    description: 'Compact fast charger compatible with most USB-C laptops and tablets.',
    image_url: 'https://picsum.photos/seed/charger/640/480',
    quantity: 3,
    purchase_price: 18.0,
    selling_price: 34.99,
  },
  {
    name: 'Ergonomic Office Chair',
    description: 'Adjustable lumbar support, breathable mesh back, and smooth-rolling casters.',
    image_url: 'https://picsum.photos/seed/office-chair/640/480',
    quantity: 5,
    purchase_price: 95.0,
    selling_price: 189.0,
  },
  {
    name: 'Mechanical Gaming Keyboard',
    description: 'RGB backlit keyboard with tactile switches for responsive typing and gaming.',
    image_url: 'https://picsum.photos/seed/keyboard/640/480',
    quantity: 4,
    purchase_price: 38.0,
    selling_price: 69.99,
  },
  {
    name: '4K Webcam',
    description: 'Ultra HD video for streaming and video calls with built-in microphone.',
    image_url: 'https://picsum.photos/seed/webcam/640/480',
    quantity: 3,
    purchase_price: 52.0,
    selling_price: 99.0,
  },
  {
    name: 'Portable SSD 1TB',
    description: 'Pocket-sized external drive with fast USB 3.2 transfer speeds.',
    image_url: 'https://picsum.photos/seed/ssd/640/480',
    quantity: 5,
    purchase_price: 58.0,
    selling_price: 109.99,
  },
  {
    name: 'Ceramic Coffee Mug Set',
    description: 'Set of four 12oz mugs, dishwasher and microwave safe.',
    image_url: 'https://picsum.photos/seed/mugs/640/480',
    quantity: 4,
    purchase_price: 12.0,
    selling_price: 24.99,
  },
  {
    name: 'Non-Slip Yoga Mat',
    description: 'Extra-thick mat with carrying strap for home and studio workouts.',
    image_url: 'https://picsum.photos/seed/yoga-mat/640/480',
    quantity: 3,
    purchase_price: 15.5,
    selling_price: 29.99,
  },
  {
    name: 'Lightweight Running Shoes',
    description: 'Breathable mesh upper with cushioned sole for daily runs and walks.',
    image_url: 'https://picsum.photos/seed/running-shoes/640/480',
    quantity: 5,
    purchase_price: 42.0,
    selling_price: 84.99,
  },
];

export default async function seedProductsMigration(pool) {
  for (const product of seedProducts) {
    const [existing] = await pool.query(
      'SELECT id FROM products WHERE name = ? LIMIT 1',
      [product.name],
    );

    if (existing.length > 0) {
      continue;
    }

    await pool.query(
      `INSERT INTO products (
        id, name, description, image_url, quantity, purchase_price, selling_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        product.name,
        product.description,
        product.image_url,
        product.quantity,
        product.purchase_price,
        product.selling_price,
      ],
    );
  }
}
