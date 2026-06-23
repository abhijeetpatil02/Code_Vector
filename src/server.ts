import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { pool } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend accessibility
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Cache categories in memory after first load to avoid redundant SELECT DISTINCT scans
let cachedCategories: string[] | null = null;

// Get distinct categories
app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    if (cachedCategories) {
      return res.json(cachedCategories);
    }
    const result = await pool.query('SELECT DISTINCT category FROM products ORDER BY category;');
    cachedCategories = result.rows.map(row => row.category);
    res.json(cachedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cursor-Based Paginated Products API
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
    const category = req.query.category as string || null;
    const cursor = req.query.cursor as string || null;

    let cursorCreatedAt: string | null = null;
    let cursorId: number | null = null;

    // Decode base64 cursor if provided
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [timestamp, idStr] = decoded.split(',');
        if (timestamp && idStr) {
          cursorCreatedAt = timestamp;
          cursorId = parseInt(idStr, 10);
        }
      } catch (err) {
        return res.status(400).json({ error: 'Invalid cursor format' });
      }
    }

    const queryParams: any[] = [];
    let queryText = `SELECT id, name, category, price, created_at, updated_at FROM products WHERE 1=1`;

    // 1. Add Category Filter
    if (category) {
      queryParams.push(category);
      queryText += ` AND category = $${queryParams.length}`;
    }

    // 2. Add Keyset Cursor Pagination filter
    if (cursorCreatedAt !== null && cursorId !== null) {
      queryParams.push(cursorCreatedAt, cursorId);
      // PostgreSQL tuple comparison utilizing composite indexes: idx_products_category_created_at_id or idx_products_created_at_id
      queryText += ` AND (created_at, id) < ($${queryParams.length - 1}, $${queryParams.length})`;
    }

    // 3. Sorting & Limit
    queryParams.push(limit);
    queryText += ` ORDER BY created_at DESC, id DESC LIMIT $${queryParams.length}`;

    // Execute query
    const startTime = Date.now();
    const result = await pool.query(queryText, queryParams);
    const queryTime = Date.now() - startTime;

    // Generate next cursor if we retrieved the full limit of items
    let nextCursor: string | null = null;
    if (result.rows.length === limit) {
      const lastRow = result.rows[result.rows.length - 1];
      // Format: "2026-06-23T04:06:24.000Z,199950"
      const rawCursor = `${new Date(lastRow.created_at).toISOString()},${lastRow.id}`;
      nextCursor = Buffer.from(rawCursor).toString('base64');
    }

    // Return header with query time for diagnostics
    res.setHeader('X-Query-Time-Ms', queryTime.toString());

    res.json({
      products: result.rows,
      nextCursor,
      queryTimeMs: queryTime
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Fallback to index.html for single-page applications
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
