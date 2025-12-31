const { chromium } = require('playwright');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const EXTRA_JOB_IDS = (process.env.EXTRA_JOB_IDS || '').split(',').map((v) => v.trim()).filter(Boolean);

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

const HY_ID = 'kibt-fe-cj';

const normalizePrice = (raw) => {
  const val = raw.price ?? raw.salePrice ?? raw.amount ?? raw.originAmount ?? null;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    if (Number.isFinite(num)) return num > 50 ? num / 100 : num;
    return null;
  }
  if (typeof val === 'number') {
    return val > 50 ? val / 100 : val; // cents → dollars
  }
  return null;
};

const ensureArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return [v].filter(Boolean);
};

const slugify = (value, fallback) => {
  const base = value || fallback || '';
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120) || String(fallback || '').toLowerCase();
};

const normalize = (raw, idx) => {
  const price = normalizePrice(raw);
  const images = ensureArray(
    raw.image ||
      raw.thumbnail ||
      raw.mainPhotoUrl ||
      raw.mainImage ||
      raw.mainImageUrl ||
      raw.images ||
      raw.gallery ||
      raw.photos ||
      raw.photoUrlList ||
      raw.photoUrls
  );
  return {
    id: raw.jobsProductId || raw.productId || raw.id || `product-${idx}`,
    slug: raw.slug || slugify(raw.title || raw.productName || raw.name, raw.jobsProductId || raw.productId || raw.id || `product-${idx}`),
    title: raw.title || raw.productName || raw.name || 'Untitled product',
    description: raw.description || raw.shortDescription || raw.productDescription || raw.summary || raw.remark || '',
    price,
    category:
      raw.category ||
      raw.categoryName ||
      raw.thirdCategoryName ||
      raw.secondCategoryName ||
      raw.firstCategoryName ||
      raw.categoryPath ||
      raw.productTypeName ||
      (raw.productType ? `Type-${raw.productType}` : null) ||
      raw.type ||
      'Featured',
    tags: raw.tags || raw.labels || raw.categories || [],
    image: images[0] || 'https://frontend.wed2c.com/jobs-buyer-h5/static/media/default-small.77979952.png',
    images,
    sourceUrl:
      raw.sourceUrl ||
      raw.url ||
      `https://caylin.wed2c.com/goodsDetails?jobsProductId=${raw.jobsProductId || raw.id}${
        raw.recommendProductId ? `&recommendProductId=${raw.recommendProductId}` : ''
      }&hyId=${HY_ID}`,
    recommendProductId: raw.recommendProductId,
    updatedAt: Date.now()
  };
};

const collectProductsFromObject = (value, bucket = []) => {
  if (!value) return bucket;
  if (Array.isArray(value)) {
    value.forEach((item) => collectProductsFromObject(item, bucket));
    return bucket;
  }
  if (typeof value === 'object') {
    const looksLikeProduct = value.jobsProductId || value.productName || value.mainPhotoUrl || value.productId;
    if (looksLikeProduct) bucket.push(value);
    Object.values(value).forEach((v) => collectProductsFromObject(v, bucket));
    return bucket;
  }
  return bucket;
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const products = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('goods') || url.includes('product')) {
      try {
        const data = await res.json();
        const list = data?.data?.list || data?.list || data?.records || [];
        list.forEach((item, i) => products.push(normalize(item, i)));
      } catch (err) {
        // Ignore non-JSON responses.
      }
    }
  });

  await page.goto('https://caylin.wed2c.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    const initialData = await page.evaluate(() => window.__INITIAL_DATA__ || null);
    if (initialData) {
      const gathered = collectProductsFromObject(initialData);
      gathered.forEach((item, i) => products.push(normalize(item, i)));
      console.log(`Captured ${gathered.length} item(s) from __INITIAL_DATA__`);
    }
  } catch (err) {
    console.warn('Could not read __INITIAL_DATA__', err);
  }
  await page.waitForTimeout(5000);
  // Scroll and click to load more product calls
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1500);
  }
  try {
    const viewAllLinks = await page.$$('text=View all');
    for (const link of viewAllLinks.slice(0, 3)) {
      await link.click({ force: true });
      await page.waitForTimeout(1500);
    }
  } catch {}

  const unique = new Map();
  products.forEach((p, idx) => {
    const item = normalize(p, idx);
    if (item.id) unique.set(item.id, item);
  });

  // Include explicitly provided IDs
  EXTRA_JOB_IDS.forEach((id) => {
    if (!unique.has(id)) unique.set(id, { id });
  });

  // Enrich with product detail pages to grab descriptions, better images, and accurate price.
  const detailPage = await browser.newPage();
  let count = 0;
  for (const [id, item] of unique.entries()) {
    if (count >= 40) break; // cap to avoid long runs
     try {
      const detailUrl = `https://caylin.wed2c.com/goodsDetails?jobsProductId=${id}${
        item.recommendProductId ? `&recommendProductId=${item.recommendProductId}` : ''
      }&hyId=${HY_ID}`;
      await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const detail = await detailPage.evaluate(() => window.__INITIAL_DATA__ || {});
      const productDetail =
        detail.productInfo ||
        detail.productDetail ||
        detail.product ||
        detail.detail ||
        detail.data ||
        detail.goodsDetail ||
        {};

      const detailImages =
        productDetail.imageList ||
        productDetail.images ||
        productDetail.gallery ||
        productDetail.mainImageUrlList ||
        productDetail.mainImages ||
        [];
      const desc =
        productDetail.productDescription ||
        productDetail.description ||
        productDetail.desc ||
        productDetail.detail ||
        productDetail.goodsDesc ||
        item.description;
      // If SSR data is missing, try scraping rendered HTML for a description.
      const scrapedDesc = await detailPage.evaluate(() => {
        const candidate = document.querySelector('.commodity-desc, .goods-detail-text, .goods-detail-desc, .web-goods-card-content');
        if (candidate) {
          const text = candidate.innerText || candidate.textContent || '';
          return text.trim().slice(0, 1200);
        }
        return '';
      });

      // Grab visible images if available.
      const scrapedImages = await detailPage.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'))
          .map((img) => img.getAttribute('src') || '')
          .filter((src) => src && src.startsWith('http') && !src.includes('default-small'));
        return imgs.slice(0, 8);
      });

      const enriched = normalize(
        {
          ...item,
          ...productDetail,
          description: scrapedDesc || desc,
          images: scrapedImages.length ? scrapedImages : detailImages
        },
        count
      );
      unique.set(id, { ...item, ...enriched });
    } catch (err) {
      // keep existing item if detail fetch fails
    }
    count += 1;
  }
  await detailPage.close();
  await browser.close();

  if (!unique.size) throw new Error('No products captured; adjust the response filter.');

  // Merge with existing to avoid dropping products and only add new.
  const db = admin.database();
  const existingSnap = await db.ref('products').once('value');
  const existing = existingSnap.val() || {};
  const merged = { ...existing };
  unique.forEach((p, id) => {
    merged[id] = { ...(existing[id] || {}), ...p, updatedAt: Date.now() };
  });

  // Build category map
  const categoryMap = {};
  Object.entries(merged).forEach(([id, product]) => {
    const categories = [
      product.category || 'Uncategorized',
      ...ensureArray(product.tags || []).map((t) => `tag:${t}`)
    ].filter(Boolean);
    categories.forEach((cat) => {
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, products: {} };
      categoryMap[cat].products[id] = true;
    });
  });

  await db.ref('products').set(merged);
  await db.ref('categories').set(categoryMap);
  console.log(
    `Merged ${unique.size} fetched items; total ${Object.keys(merged).length} in /products, ${Object.keys(categoryMap).length} categories`
  );
  await admin.app().delete();
  process.exit(0);
})();
