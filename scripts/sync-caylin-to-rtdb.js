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

const isEmptyProduct = (p = {}) => {
  const noTitle = !p.title || String(p.title).toLowerCase().includes('untitled product');
  const noDesc = !p.description;
  const defaultImage = !p.image || String(p.image).includes('default-small');
  return noTitle && noDesc && defaultImage;
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

  const seenListUrls = new Set();
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('goods') || url.includes('product') || url.includes('list')) {
      try {
        const data = await res.json();
        const list = data?.data?.list || data?.list || data?.records || [];
        if (Array.isArray(list) && list.length) {
          list.forEach((item, i) => products.push(normalize(item, i)));
          if (!seenListUrls.has(url)) {
            seenListUrls.add(url);
            console.log(`LIST ${list.length} -> ${url}`);
          }
        }
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
  for (let i = 0; i < 10; i++) {
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

  // Scrape any goodsDetails links present in the DOM for extra IDs.
  try {
    const linkIds = await page.evaluate(() => {
      const ids = new Set();
      Array.from(document.querySelectorAll('a[href]')).forEach((a) => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/jobsProductId=([0-9]+)/);
        if (match && match[1]) ids.add(match[1]);
      });
      return Array.from(ids);
    });
    linkIds.forEach((id) => products.push({ id }));
    console.log(`Found ${linkIds.length} product ids from links on page.`);
  } catch {}

  const unique = new Map();
  products.forEach((p, idx) => {
    const item = normalize(p, idx);
    if (item.id) unique.set(item.id, item);
  });
  console.log(`Collected ${products.length} raw items, ${unique.size} unique ids before detail enrichment.`);

  // Include explicitly provided IDs
  EXTRA_JOB_IDS.forEach((id) => {
    if (!unique.has(id)) unique.set(id, { id });
  });

  // Enrich with product detail pages to grab descriptions, better images, and accurate price.
  const detailPage = await browser.newPage();
  const idQueue = Array.from(unique.keys());
  let count = 0;
  let cursor = 0;
  while (cursor < idQueue.length && count < 120) {
    const id = idQueue[cursor];
    const item = unique.get(id) || { id };
    cursor += 1;

    const fetchDetail = async () => {
      const detailUrl = `https://caylin.wed2c.com/goodsDetails?jobsProductId=${id}${
        item.recommendProductId ? `&recommendProductId=${item.recommendProductId}` : ''
      }&hyId=${HY_ID}`;
      await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
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

      // Grab visible images and any linked product ids for further crawling.
      const { images: scrapedImages, linkedIds } = await detailPage.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'))
          .map((img) => img.getAttribute('src') || '')
          .filter((src) => src && src.startsWith('http') && !src.includes('default-small'))
          .slice(0, 8);
        const ids = Array.from(document.querySelectorAll('a[href]')).map((a) => {
          const href = a.getAttribute('href') || '';
          const m = href.match(/jobsProductId=([0-9]+)/);
          return m && m[1] ? m[1] : null;
        }).filter(Boolean);
        return { images: imgs, linkedIds: ids };
      });

      linkedIds.forEach((linkedId) => {
        if (!unique.has(linkedId)) {
          unique.set(linkedId, { id: linkedId });
          idQueue.push(linkedId);
        }
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
      return enriched;
    };

    try {
      let enriched = await fetchDetail();
      // Retry once if still empty.
      if (isEmptyProduct(enriched)) {
        await detailPage.waitForTimeout(800);
        enriched = await fetchDetail();
      }
      if (!isEmptyProduct(enriched)) {
        unique.set(id, { ...item, ...enriched });
      }
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
  const addedIds = [];
  unique.forEach((p, id) => {
    // Skip if payload is essentially empty.
    if (isEmptyProduct(p)) return;

    // If existing has data, keep it unless existing is empty.
    const existingItem = existing[id];
    const existingIsEmpty = isEmptyProduct(existingItem);
    if (existingItem && !existingIsEmpty) return;

    merged[id] = { ...(existingItem || {}), ...p, updatedAt: Date.now(), createdAt: (existingItem && existingItem.createdAt) || Date.now() };
    if (!existingItem || existingIsEmpty) addedIds.push(id);
  });
  // Drop undefined values and prune empty records.
  const mergedClean = JSON.parse(JSON.stringify(merged)); // drop undefined values
  let pruned = 0;
  Object.keys(mergedClean).forEach((id) => {
    if (isEmptyProduct(mergedClean[id])) {
      delete mergedClean[id];
      pruned += 1;
    }
  });

  // Build category map
  const categoryMap = {};
  Object.entries(mergedClean).forEach(([id, product]) => {
    const categories = [
      product.category || 'Uncategorized',
      ...ensureArray(product.tags || []).map((t) => `tag:${t}`)
    ].filter(Boolean);
    categories.forEach((cat) => {
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, products: {} };
      categoryMap[cat].products[id] = true;
    });
  });

  await db.ref('products').set(mergedClean);
  await db.ref('categories').set(categoryMap);
  console.log(
    `Merged ${unique.size} fetched items; added ${addedIds.length} new; pruned ${pruned} empty; total ${Object.keys(mergedClean).length} in /products, ${Object.keys(categoryMap).length} categories`
  );
  await admin.app().delete();
  process.exit(0);
})();
