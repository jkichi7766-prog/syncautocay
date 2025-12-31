# Caylin Shop clone

Static, SEO-friendly clone of **caylin.wed2c.com** that pulls live products from Firebase Realtime Database and links shoppers back to the original product pages.

## Quick start
1) Copy `firebase-config.example.js` to `firebase-config.js` and fill in your Firebase project credentials plus the RTDB path (defaults to `products`).
2) Serve the folder locally (any static server works), e.g. `npx serve .` or `python -m http.server 8000`.
3) Open `http://localhost:8000` to verify live data loads. With no config, sample products are shown so the layout stays previewable.

## Firebase expectations
- RTDB path: defaults to `/products`. Each child can be an object (keyed by product id) or an array. Detected fields: `title/name/productName`, `price/salePrice`, `description/shortDescription`, `images/gallery/image/thumbnail`, `category/collection/type`, `tags/categories/collections`, `url/link/productUrl/jobsProductId`.
- Product cards link to `sourceUrl` if present, otherwise a `jobsProductId`-based link to `https://caylin.wed2c.com/goodsDetails?...`.
- Realtime listener keeps the grid fresh and updates deep-links `?product=<id>` so items are directly indexable.

## SEO helpers
- Canonical, Open Graph, and description tags update when a product drawer is opened.
- `robots.txt` and `sitemap.xml` live at the project root. Regenerate sitemap with live data:
  ```sh
  FIREBASE_DB_URL="https://<project>.firebaseio.com" SITE_BASE_URL="https://caylin.shop" DATABASE_PATH="products" node scripts/generate-sitemap.js
  ```
- Default sitemap ships with sample URLs; overwrite it after wiring Firebase.

## Files
- `index.html` – layout, meta tags, structured data.
- `styles.css` – modern gradient theme with responsive grid.
- `app.js` – Firebase RTDB fetch + rendering, filters, deep-linkable product drawer.
- `firebase-config.js` – your Firebase credentials (placeholder by default).
- `scripts/generate-sitemap.js` – pulls RTDB and writes `sitemap.xml`.
- `robots.txt` / `sitemap.xml` – crawlers + index hints.
