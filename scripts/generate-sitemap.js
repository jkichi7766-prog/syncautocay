#!/usr/bin/env node
/**
 * Generate sitemap.xml from Firebase RTDB.
 * Usage:
 *   FIREBASE_DB_URL="https://<project>.firebaseio.com" SITE_BASE_URL="https://caylin.shop" DATABASE_PATH="products" node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const fetchImpl = globalThis.fetch;

const dbUrl = (process.env.FIREBASE_DB_URL || '').replace(/\.json$/, '');
const siteBase = process.env.SITE_BASE_URL || 'https://caylin.shop';
const dataPath = process.env.DATABASE_PATH || 'products';
const targetPath = path.join(__dirname, '..', 'sitemap.xml');

if (!fetchImpl) {
  console.error('Fetch API not available in this Node version.');
  process.exit(1);
}

if (!dbUrl) {
  console.error('Set FIREBASE_DB_URL (e.g. https://your-project.firebaseio.com).');
  process.exit(1);
}

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const normalizeProduct = (id, raw = {}) => {
  const productId =
    id ||
    raw.id ||
    raw.jobsProductId ||
    raw.productId ||
    raw.slug ||
    `product-${Math.random().toString(36).slice(2)}`;
  const slug = raw.slug || raw.handle || raw.urlKey || raw.title || raw.name || raw.productName || productId;
  return {
    id: productId,
    slug,
    updatedAt: raw.updatedAt || raw.timestamp || raw.createdAt || Date.now(),
    tags: ensureArray(raw.tags || raw.categories || raw.collections),
    category: raw.category || raw.collection || 'product'
  };
};

const normalizeList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item, index) => normalizeProduct(item?.id || index, item));
  }
  return Object.entries(raw).map(([key, value]) => normalizeProduct(key, value));
};

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildProductUrl = (product) => {
  const slug = product.slug || product.title || product.id;
  const url = `${siteBase}/?product=${encodeURIComponent(product.id)}&postname=${encodeURIComponent(slug)}`;
  return xmlEscape(url);
};

const buildXml = (urls) => {
  const now = new Date().toISOString();
  const uniqueUrls = Array.from(new Set(urls));

  const body = uniqueUrls
    .map(
      (loc) => `
  <url>
    <loc>${loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteBase}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>${body}
</urlset>
`;
};

const fetchProducts = async () => {
  const url = `${dbUrl.replace(/\/$/, '')}/${dataPath}.json`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  return res.json();
};

const run = async () => {
  const raw = await fetchProducts();
  const products = normalizeList(raw);
  const urls = products.map((product) => buildProductUrl(product));
  const xml = buildXml(urls);
  fs.writeFileSync(targetPath, xml.trim() + '\n');
  console.log(`Sitemap written to ${targetPath} with ${urls.length} product URL(s).`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
