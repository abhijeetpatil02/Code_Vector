# High-Performance Paginated Products App

A backend project implementing high-performance keyset (cursor-based) pagination and category filtering over a dataset of 200,000 products, connected to a PostgreSQL database (Neon or Supabase).

---

## Features
- **Keyset (Cursor-Based) Pagination**: Ensures consistent responses with $O(\log N)$ query times even deep in the pages, with zero duplication or missed items when concurrent writes/deletes happen.
- **Fast Seeding**: Seeds 200,000 rows in under 2 seconds by generating rows directly in the database engine using `generate_series`.
- **Database Index Optimization**: Compound indexes optimized for sorting, pagination, and category filtering.
- **Dashboard Interface**: Modern dark-themed dashboard displaying performance metrics (loaded items, query times, pagination mode) with infinite scrolling.

---

## Setup Instructions

### 1. Install Dependencies
Run:
```bash
npm install
```

### 2. Configure Environment Variables
Create or edit the `.env` file in the root directory:
```env
PORT=3000
DATABASE_URL=your_postgresql_connection_string
```
*(You can get a free PostgreSQL instance from [Neon.tech](https://neon.tech/) or [Supabase](https://supabase.com/)).*

### 3. Initialize & Seed Database (200,000 Products)
To run the seeding script which sets up the tables, generates 200,000 rows, and creates the optimization indexes:
```bash
npm run seed
```

### 4. Start Development Server
To launch the development server with hot-reloading:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production
To build and run the production compiled bundle:
```bash
npm run build
npm start
```

---

## Technical Details

### API Endpoints

#### 1. Fetch Categories
- **Path**: `/api/categories`
- **Method**: `GET`
- **Response**: Array of category names (e.g., `["Beauty", "Books", ...]`).

#### 2. Paginated Products
- **Path**: `/api/products`
- **Method**: `GET`
- **Query Params**:
  - `limit`: Number of items (default `20`, max `100`).
  - `category`: Filter by category (optional).
  - `cursor`: Base64 encoded keyset cursor `(created_at, id)` of the last item in the previous page (optional).
- **Response**:
  ```json
  {
    "products": [
      {
        "id": 199950,
        "name": "Product #199950",
        "category": "Beauty",
        "price": "432.50",
        "created_at": "2026-06-23T04:06:24.000Z",
        "updated_at": "2026-06-23T04:06:24.000Z"
      },
      ...
    ],
    "nextCursor": "MjAyNi0wNi0yM1QwMzo1ODoyOFosMTk5OTUw"
  }
  ```
  If there is no more data, `nextCursor` will be `null`.