#!/usr/bin/env node
/**
 * Remove low-quality products from RTDB (missing title or description, or "Untitled" title)
 * and rebuild categories.
 *
 * Usage:
 *   node scripts/clean-products.js
 *
 * Requires: scripts/serviceac.json (Firebase service account)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceac.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Missing serviceac.json in scripts/. Download a Firebase service account key and save it there.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://caylin-aad1b-default-rtdb.firebaseio.com'
});

const ensureArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return [v].filter(Boolean);
};

const shouldRemove = (product) => {
  const title = (product.title || '').trim().toLowerCase();
  const desc = (product.description || '').trim();
  if (!title || title === 'untitled product' || title.startsWith('untitled')) return true;
  if (!desc || desc.length < 10) return true;
  return false;
};

(async () => {
  const db = admin.database();
  const productsSnap = await db.ref('products').once('value');
  const products = productsSnap.val() || {};

  const keep = {};
  let removed = 0;
  Object.entries(products).forEach(([id, product]) => {
    if (shouldRemove(product)) {
      removed += 1;
      return;
    }
    keep[id] = product;
  });

  // Rebuild categories from kept products
  const categoryMap = {};
  Object.entries(keep).forEach(([id, product]) => {
    const categories = [
      product.category || 'Uncategorized',
      ...ensureArray(product.tags || []).map((t) => `tag:${t}`)
    ].filter(Boolean);
    categories.forEach((cat) => {
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, products: {} };
      categoryMap[cat].products[id] = true;
    });
  });

  await db.ref('products').set(keep);
  await db.ref('categories').set(categoryMap);

  console.log(`Removed ${removed} product(s); kept ${Object.keys(keep).length}. Categories: ${Object.keys(categoryMap).length}`);
  await admin.app().delete();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
