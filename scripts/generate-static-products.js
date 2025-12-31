#!/usr/bin/env node
/**
 * Generate static prerendered HTML files for each product in RTDB.
 *
 * Usage:
 *   FIREBASE_DB_URL="https://<project>.firebaseio.com" SITE_BASE_URL="https://caylin.shop" DATABASE_PATH="products" node scripts/generate-static-products.js
 *
 * Output:
 *   ./static-pages/<slug-or-id>.html
 */

const fs = require('fs');
const path = require('path');

const fetchImpl = globalThis.fetch;
const dbUrl = (process.env.FIREBASE_DB_URL || '').replace(/\.json$/, '');
const siteBase = process.env.SITE_BASE_URL || 'https://caylin.shop';
const dataPath = process.env.DATABASE_PATH || 'products';
const outDir = path.join(__dirname, '..', 'static-pages');

if (!fetchImpl) {
  console.error('Fetch API not available in this Node version.');
  process.exit(1);
}

if (!dbUrl) {
  console.error('Set FIREBASE_DB_URL (e.g. https://your-project.firebaseio.com).');
  process.exit(1);
}

const slugify = (value, fallback) => {
  const base = value || fallback || '';
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120) || String(fallback || '').toLowerCase();
};

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value].filter(Boolean);
};

const normalizeProduct = (id, raw = {}) => {
  const productId =
    id ||
    raw.id ||
    raw.jobsProductId ||
    raw.productId ||
    raw.slug ||
    `product-${Math.random().toString(36).slice(2)}`;
  const slug = raw.slug || raw.handle || raw.urlKey || raw.title || raw.name || raw.productName || slugify('', productId);
  const images = ensureArray(
    raw.images ||
      raw.gallery ||
      raw.photos ||
      raw.image ||
      raw.thumbnail ||
      raw.mainPhotoUrl ||
      raw.mainImage ||
      raw.photoUrlList ||
      raw.photoUrls
  );
  const priceValue = raw.price ?? raw.salePrice ?? raw.amount ?? raw.originAmount ?? null;
  const parsedPrice = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
  const price = typeof parsedPrice === 'number' && parsedPrice > 50 ? parsedPrice / 100 : parsedPrice;
  return {
    id: productId,
    slug,
    title: raw.title || raw.name || raw.productName || 'Untitled product',
    description: raw.description || raw.shortDescription || raw.productDescription || raw.summary || raw.remark || '',
    image: images[0] || 'https://frontend.wed2c.com/jobs-buyer-h5/static/media/default-small.77979952.png',
    price,
    category: raw.category || raw.type || raw.categoryName || 'Product',
    sourceUrl:
      raw.sourceUrl ||
      raw.url ||
      `https://caylin.wed2c.com/goodsDetails?jobsProductId=${raw.jobsProductId || raw.id || productId}${
        raw.recommendProductId ? `&recommendProductId=${raw.recommendProductId}` : ''
      }&hyId=kibt-fe-cj`
  };
};

const normalizeList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item, index) => normalizeProduct(item?.id || index, item));
  return Object.entries(raw).map(([key, value]) => normalizeProduct(key, value));
};

const fetchProducts = async () => {
  const url = `${dbUrl.replace(/\/$/, '')}/${dataPath}.json`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return res.json();
};

const htmlForProduct = (product) => {
  const detailUrl = `${siteBase}/?product=${encodeURIComponent(product.id)}&postname=${encodeURIComponent(product.slug)}`;
  const desc = (product.description || '').replace(/\s+/g, ' ').trim().slice(0, 320);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: desc,
    image: product.image,
    category: product.category,
    url: detailUrl,
    offers: {
      '@type': 'Offer',
      price: product.price || 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: product.sourceUrl || detailUrl
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${product.title} | Caylin Shop</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${detailUrl}">
  <meta property="og:title" content="${product.title} | Caylin Shop">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${detailUrl}">
  <meta property="og:type" content="product">
  <meta property="og:image" content="${product.image}">
  <script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
  </script>
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <main class="page-shell">
    <article class="card">
      <div class="card__media">
        <img src="${product.image}" alt="${product.title}" />
      </div>
      <div class="card__body">
        <div class="card__meta">
          <span class="badge">${product.category}</span>
        </div>
        <h1>${product.title}</h1>
        <p class="price">${product.price ? `$${Number(product.price).toFixed(2)}` : ''}</p>
        <p class="description">${product.description || ''}</p>
        <div class="card__actions">
          <a class="btn" href="${product.sourceUrl || '#'}">Buy now</a>
          <a class="ghost" href="${detailUrl}">View on caylin.shop</a>
        </div>
      </div>
    </article>
  </main>
</body>
</html>`;
};

const run = async () => {
  const raw = await fetchProducts();
  const products = normalizeList(raw);
  if (!products.length) {
    console.warn('No products found; nothing to render.');
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  products.forEach((product) => {
    const filename = `${product.slug || product.id}.html`;
    const html = htmlForProduct(product);
    fs.writeFileSync(path.join(outDir, filename), html);
  });

  console.log(`Generated ${products.length} static product page(s) in ${outDir}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
