import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Determine SSL options based on the connection string
const isLocalhost = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');
const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  // Optimal pool limits for Render and serverless Postgres
  max: 10, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});
