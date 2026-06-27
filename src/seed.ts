import { pool } from './db';

async function seedDatabase() {
  console.log('Connecting to the database...');
  const client = await pool.connect();
  try {
    console.log('Starting database initialization and seeding...');
    const startTime = Date.now();

    // 1. Create table if not exists
    console.log('Creating table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Clear old data 

    console.log('Wiping old data...');
    await client.query('TRUNCATE TABLE products RESTART IDENTITY CASCADE;');

    // 3. High-performance generate & insert 200,000 rows
    console.log('Inserting 200,000 products using PostgreSQL generate_series (this takes ~1-3 seconds)...');
    await client.query(`
      INSERT INTO products (name, category, price, created_at, updated_at)
      SELECT 
          'Product #' || i,
          (ARRAY['Electronics', 'Books', 'Clothing', 'Home', 'Beauty', 'Sports', 'Toys', 'Automotive', 'Health', 'Garden'])[width_bucket(random(), 0, 1.0001, 10)],
          ROUND((random() * 999 + 1)::numeric, 2), -- Prices between 1.00 and 1000.00
          NOW() - (i * INTERVAL '1 minute'), -- staggers timestamps: 1 min increments back in time (newest is #1)
          NOW() - (i * INTERVAL '1 minute')
      FROM generate_series(1, 200000) AS i;
    `);

    // 4. Create indexes to optimize cursor-based pagination query performance
    console.log('Creating optimization indexes (this might take a few seconds)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category_created_at_id 
      ON products (category, created_at DESC, id DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_at_id 
      ON products (created_at DESC, id DESC);
    `);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Get row count verification
    const countRes = await client.query('SELECT COUNT(*) FROM products;');
    console.log(`\nSuccess! Seeded ${countRes.rows[0].count} products in ${duration} seconds.`);

  } catch (error) {
    console.error('Error during database seeding:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
