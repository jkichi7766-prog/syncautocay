import { firebaseConfig, databasePath, imgbbKey } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
  onValue,
  push,
  set,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';

const ui = {
  grid: document.getElementById('productGrid'),
  quickList: document.getElementById('quickList'),
  recentList: document.getElementById('recentList'),
  loadMoreBtn: document.getElementById('loadMoreBtn'),
  loadMoreContainer: document.getElementById('loadMoreContainer'),
  loadMoreStatus: document.getElementById('loadMoreStatus'),
  loadMoreSentinel: document.getElementById('loadMoreSentinel'),
  autoCarouselTrack: document.getElementById('autoCarouselTrack'),
  search: document.getElementById('searchInput'),
  status: document.getElementById('statusMessage'),
  categoryFilters: document.getElementById('categoryFilters'),
  drawer: document.getElementById('productDrawer'),
  drawerClose: document.getElementById('drawerClose'),
  drawerTitle: document.getElementById('drawerTitle'),
  drawerPrice: document.getElementById('drawerPrice'),
  drawerDescription: document.getElementById('drawerDescription'),
  drawerCategory: document.getElementById('drawerCategory'),
  drawerTags: document.getElementById('drawerTags'),
  drawerImage: document.getElementById('drawerImage'),
  drawerBadge: document.getElementById('drawerBadge'),
  drawerSourceLink: document.getElementById('drawerSourceLink'),
  drawerShare: document.getElementById('drawerShare'),
  submitFab: document.getElementById('submitFab'),
  submitSection: document.getElementById('submitSection'),
  submitForm: document.getElementById('submitProductForm'),
  submitStatus: document.getElementById('submitStatus'),
  submitButton: document.getElementById('submitButton'),
  submitImage: document.getElementById('submitImage'),
  submitTitle: document.getElementById('submitTitle'),
  submitDescription: document.getElementById('submitDescription'),
  submitLink: document.getElementById('submitLink'),
  submitCategory: document.getElementById('submitCategory'),
  submitTags: document.getElementById('submitTags'),
  submitContactMethod: document.getElementById('submitContactMethod'),
  submitContactValue: document.getElementById('submitContactValue'),
  loader: document.getElementById('loader'),
  communityGrid: document.getElementById('communityGrid'),
  communityStatus: document.getElementById('communityStatus'),
  navHome: document.getElementById('navHome'),
  navFeatured: document.getElementById('navFeatured'),
  navCategories: document.getElementById('navCategories'),
  navAddProduct: document.getElementById('navAddProduct'),
  navAccount: document.getElementById('navAccount'),
  featuredGrid: document.getElementById('featuredGrid'),
  featuredStatus: document.getElementById('featuredStatus'),
  categoryList: document.getElementById('categoryList'),
  profileSection: document.getElementById('profileSection'),
  profileInfo: document.getElementById('profileInfo'),
  profileSubmissionList: document.getElementById('profileSubmissionList'),
  profileStatus: document.getElementById('profileStatus'),
  packageGrid: document.getElementById('packageGrid'),
  purchaseForm: document.getElementById('purchaseForm'),
  purchasePackage: document.getElementById('purchasePackage'),
  purchaseAmount: document.getElementById('purchaseAmount'),
  purchaseNetwork: document.getElementById('purchaseNetwork'),
  purchaseTxId: document.getElementById('purchaseTxId'),
  purchaseNote: document.getElementById('purchaseNote'),
  purchaseSubmit: document.getElementById('purchaseSubmit'),
  purchaseStatus: document.getElementById('purchaseStatus'),
  walletDisplay: document.getElementById('walletDisplay'),
  totalProducts: document.getElementById('totalProducts'),
  authModal: document.getElementById('authModal'),
  authClose: document.getElementById('authClose'),
  authFormModal: document.getElementById('authFormModal'),
  authEmailModal: document.getElementById('authEmailModal'),
  authPasswordModal: document.getElementById('authPasswordModal'),
  authSubmitModal: document.getElementById('authSubmitModal'),
  authLogoutModal: document.getElementById('authLogoutModal'),
  authModalStatus: document.getElementById('authModalStatus'),
  authTabs: Array.from(document.querySelectorAll('.auth-tab')),
  newGrid: document.getElementById('newProductGrid')
};

const defaults = {
  title: document.title,
  description: (document.querySelector('meta[name="description"]') || {}).content || '',
  canonical: (document.querySelector('link[rel="canonical"]') || {}).href || window.location.href,
  ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content || '',
  ogDescription: (document.querySelector('meta[property="og:description"]') || {}).content || '',
  ogImage: (document.querySelector('meta[property="og:image"]') || {}).content || '',
  ogImageWidth: (document.querySelector('meta[property="og:image:width"]') || {}).content || '',
  ogImageHeight: (document.querySelector('meta[property="og:image:height"]') || {}).content || '',
  twitterTitle: (document.querySelector('meta[name="twitter:title"]') || {}).content || '',
  twitterDescription: (document.querySelector('meta[name="twitter:description"]') || {}).content || '',
  twitterImage: (document.querySelector('meta[name="twitter:image"]') || {}).content || ''
};

const PAGE_SIZE = 15;

const state = {
  allProducts: [],
  communityProducts: [],
  filtered: [],
  visibleCount: PAGE_SIZE,
  categories: new Set(['All']),
  selectedCategory: 'All',
  currentProduct: null,
  adminCategories: [],
  user: null,
  userProfile: null,
  userSubmissions: [],
  packages: [],
  walletSettings: {},
  recentlyViewed: [],
  showAllCategories: false,
  categoryCounts: {}
};

const submissionConfig = {
  path: 'submissions',
  imgbbKey: imgbbKey || ''
};

const AUTH_MODES = ['login', 'signup', 'reset'];
let currentAuthMode = 'login';

let dbInstance = null;
let authInstance = null;
let userSubUnsubscribe = null;
let packagesUnsubscribe = null;
let walletUnsubscribe = null;
let quickListAutoScrollTimer = null;
let autoCarouselTimer = null;
let loadObserver = null;
const viewSections = [
  'homeSection',
  'communitySection',
  'featuredSection',
  'categoriesSection',
  'packagesSection',
  'profileSection',
  'submitSection'
];


const sampleProducts = [
  {
    id: 'sample-dress',
    title: 'Satin A-Line Wedding Dress',
    description: 'Minimal satin silhouette with subtle sheen, ideal for modern weddings.',
    price: 249.99,
    category: 'Dresses',
    tags: ['satin', 'a-line', 'wedding'],
    image: 'https://images.unsplash.com/photo-1504203700686-0f3a5af7c5c0?auto=format&fit=crop&w=800&q=80',
    sourceUrl: 'https://caylin.wed2c.com/',
    badge: 'New',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24
  },
  {
    id: 'sample-veil',
    title: 'Cathedral Length Veil',
    description: 'Featherlight tulle with raw edge finish for a dramatic aisle look.',
    price: 79.0,
    category: 'Accessories',
    tags: ['veil', 'tulle', 'cathedral'],
    image: 'https://images.unsplash.com/photo-1520256862855-398228c41684?auto=format&fit=crop&w=800&q=80',
    sourceUrl: 'https://caylin.wed2c.com/',
    badge: 'Featured',
    updatedAt: Date.now() - 1000 * 60 * 60 * 12
  },
  {
    id: 'sample-rings',
    title: 'Stackable Bands',
    description: 'Warm gold stacking rings that layer with engagement sets.',
    price: 39.5,
    category: 'Jewelry',
    tags: ['rings', 'gold', 'stackable'],
    image: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=800&q=80',
    sourceUrl: 'https://caylin.wed2c.com/',
    badge: 'Bestseller',
    updatedAt: Date.now() - 1000 * 60 * 90
  },
  {
    id: 'sample-decor',
    title: 'Glass Candle Set',
    description: 'Smoky glass votives that add atmosphere to reception tables.',
    price: 59.0,
    category: 'Decor',
    tags: ['ambience', 'tabletop', 'votive'],
    image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
    sourceUrl: 'https://caylin.wed2c.com/',
    badge: 'Limited',
    updatedAt: Date.now() - 1000 * 60 * 300
  },
  {
    id: 'sample-shoes',
    title: 'Pearl Strap Heels',
    description: 'Low block heel with pearl-encrusted straps for comfort and polish.',
    price: 119.0,
    category: 'Shoes',
    tags: ['heels', 'pearl', 'bridal'],
    image: 'https://images.unsplash.com/photo-1514986888952-8cd320577b68?auto=format&fit=crop&w=800&q=80',
    sourceUrl: 'https://caylin.wed2c.com/',
    badge: 'New',
    updatedAt: Date.now() - 1000 * 60 * 60 * 6
  }
];

const configLooksValid = () => {
  const values = Object.values(firebaseConfig || {});
  const hasPlaceholder = values.some((val) => typeof val === 'string' && val.includes('YOUR_'));
  return Boolean(firebaseConfig?.apiKey && firebaseConfig?.databaseURL && !hasPlaceholder);
};

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const slugify = (value, fallback) => {
  const base = value || fallback || '';
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120) || String(fallback || '').toLowerCase();
};

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const normalizeCategories = (raw) => {
  const list = [];
  if (!raw) return list;
  const pushVal = (val) => {
    if (!val) return;
    if (typeof val === 'string') {
      list.push(val);
      return;
    }
    if (typeof val === 'object') {
      const name = val.name || '';
      const sub = val.subcategory || '';
      if (name) list.push(name);
      if (name && sub) list.push(`${name} - ${sub}`);
    }
  };
  if (Array.isArray(raw)) {
    raw.forEach(pushVal);
  } else if (typeof raw === 'object') {
    Object.values(raw).forEach(pushVal);
  }
  return list;
};

const uploadImageToImgbb = async (file) => {
  if (!submissionConfig.imgbbKey) throw new Error('Image upload key is not configured.');
  const base64 = await toBase64(file);
  const formData = new FormData();
  formData.append('key', submissionConfig.imgbbKey);
  formData.append('image', (base64 || '').split(',').pop());
  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Image upload failed');
  const data = await res.json();
  const url = data?.data?.display_url || data?.data?.url;
  if (!url) throw new Error('Upload response missing URL');
  return url;
};

const normalizeProduct = (id, raw = {}) => {
  const fallbackId =
    id ||
    raw.jobsProductId ||
    raw.productId ||
    raw.slug ||
    `product-${(globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || Math.random().toString(36).slice(2)}`;
  const titleCandidate = (raw.title || raw.name || raw.productName || '').trim();
  if (!titleCandidate) return null;
  const imageList = ensureArray(
    raw.images ||
      raw.gallery ||
      raw.photos ||
      raw.thumbs ||
      raw.image ||
      raw.imageUrl ||
      raw.mainPic ||
      raw.picUrl ||
      raw.coverImage ||
      raw.coverPhoto ||
      raw.photoUrlList ||
      raw.photoUrls ||
      raw.thumbnail ||
      raw.mainPhotoUrl ||
      raw.mainImage ||
      raw.mainImageUrl
  );
  const priceValue = raw.price ?? raw.salePrice ?? raw.cost ?? raw.amount ?? raw.originAmount ?? null;
  const parsedPrice = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
  const numericPrice =
    typeof parsedPrice === 'number' && parsedPrice > 50 ? parsedPrice / 100 : parsedPrice; // site returns cents
  const tags = ensureArray(raw.tags || raw.labels || raw.categories || raw.collections || raw.variantKeyJson);
  const sourceUrl =
    raw.sourceUrl ||
    raw.url ||
    raw.link ||
    raw.productUrl ||
    (raw.jobsProductId
      ? `https://caylin.wed2c.com/goodsDetails?jobsProductId=${raw.jobsProductId}${
          raw.recommendProductId ? `&recommendProductId=${raw.recommendProductId}` : ''
        }&hyId=kibt-fe-cj`
      : null) ||
    (fallbackId ? `https://caylin.wed2c.com/goodsDetails?jobsProductId=${fallbackId}` : '#');

  return {
    id: fallbackId,
    slug: raw.slug || raw.handle || raw.urlKey || slugify(raw.title || raw.name || raw.productName, fallbackId),
    title: titleCandidate,
    description: raw.description || raw.shortDescription || raw.seoDescription || raw.subtitle || raw.category || '',
    price: numericPrice,
    category: raw.category || raw.collection || raw.type || raw.categoryName || 'Featured',
    tags,
    image: imageList[0] || 'https://frontend.wed2c.com/jobs-buyer-h5/static/media/default-small.77979952.png',
    gallery: imageList,
    badge: raw.badge || raw.status || (raw.isNew ? 'New' : '') || (raw.isFeatured ? 'Featured' : ''),
    sourceUrl,
    rating: raw.rating || raw.stars || null,
    updatedAt: raw.updatedAt || raw.timestamp || raw.createdAt || Date.now()
  };
};

const setStatus = (message) => {
  if (ui.status) ui.status.textContent = message;
};

const setSubmitStatus = (message, tone = 'muted') => {
  if (!ui.submitStatus) return;
  ui.submitStatus.textContent = message;
  ui.submitStatus.dataset.tone = tone;
};

const setSubmitEnabled = (enabled) => {
  if (!ui.submitForm) return;
  Array.from(ui.submitForm.elements).forEach((el) => {
    el.disabled = !enabled;
  });
};

const navigateToProduct = (product) => {
  openDrawer(product, true);
};

const shuffleProducts = (list = []) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const setAuthMode = (mode = 'login') => {
  if (!AUTH_MODES.includes(mode)) return;
  currentAuthMode = mode;
  ui.authTabs?.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('auth-tab--active', active);
  });
  if (ui.authPasswordModal) {
    ui.authPasswordModal.parentElement.style.display = mode === 'reset' ? 'none' : 'grid';
  }
  if (ui.authSubmitModal) {
    ui.authSubmitModal.textContent = mode === 'signup' ? 'Sign up' : mode === 'reset' ? 'Send reset link' : 'Sign in';
  }
  if (ui.authModalStatus) {
    const copy = {
      login: 'Enter your email and password to sign in.',
      signup: 'Create an account to submit and manage products.',
      reset: 'Enter your email to receive a reset link.'
    };
    ui.authModalStatus.textContent = copy[mode];
  }
};

const openAuthModal = (mode = 'login') => {
  setAuthMode(mode);
  if (ui.authModal) {
    ui.authModal.classList.add('is-open');
    ui.authModal.setAttribute('aria-hidden', 'false');
  }
};

const closeAuthModal = () => {
  if (ui.authModal) {
    ui.authModal.classList.remove('is-open');
    ui.authModal.setAttribute('aria-hidden', 'true');
  }
};

const toggleProfileVisibility = (visible) => {
  if (!ui.profileSection) return;
  ui.profileSection.classList.toggle('is-hidden', !visible);
};

const updateNavAccount = () => {
  if (!ui.navAccount) return;
  if (state.user) {
    ui.navAccount.textContent = 'Account';
    ui.navAccount.classList.add('nav-link--active');
  } else {
    ui.navAccount.textContent = 'Sign in';
    ui.navAccount.classList.remove('nav-link--active');
  }
};

const updateTotals = () => {
  if (!ui.totalProducts) return;
  const totalMain = state.allProducts.length;
  const totalCommunity = state.communityProducts.length;
  const parts = [`Total products: ${totalMain}`];
  if (totalCommunity) parts.push(`Community: ${totalCommunity}`);
  ui.totalProducts.textContent = parts.join(' • ');
};

const renderProfileInfo = () => {
  if (!ui.profileInfo) return;
  if (!state.user || !state.userProfile) {
    ui.profileInfo.innerHTML = '';
    return;
  }
  const { email } = state.user;
  const { submissionLimit = 0, submissionsUsed = 0, package: pkg = 'free' } = state.userProfile;
  const remaining = Math.max(0, submissionLimit - submissionsUsed);
  ui.profileInfo.innerHTML = `
    <div><strong>Email:</strong> ${email || '-'}</div>
    <div><strong>Package:</strong> ${pkg}</div>
    <div><strong>Usage:</strong> ${submissionsUsed} / ${submissionLimit} (${remaining} left)</div>
  `;
};

const renderUserSubmissions = () => {
  if (!ui.profileSubmissionList) return;
  ui.profileSubmissionList.innerHTML = '';
  if (!state.user) {
    ui.profileStatus.textContent = 'Sign in to view your submissions.';
    return;
  }
  if (!state.userSubmissions.length) {
    ui.profileStatus.textContent = 'No submissions yet.';
    return;
  }
  ui.profileStatus.textContent = `You have ${state.userSubmissions.length} submission(s).`;
  const fragment = document.createDocumentFragment();
  state.userSubmissions.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = `
      <div class="profile-card__row">
        <strong>${item.title || 'Untitled'}</strong>
        <span class="badge">${item.status || 'pending'}</span>
      </div>
      <p class="muted">${item.description || ''}</p>
      <div class="tags">
        <span class="tag">${item.category || 'Uncategorized'}</span>
        ${item.requestedFeature ? '<span class="tag">Feature requested</span>' : ''}
        ${item.deleteRequested ? '<span class="tag">Delete requested</span>' : ''}
        ${item.editRequested ? '<span class="tag">Edit requested</span>' : ''}
      </div>
      <div class="profile-actions">
        <button class="ghost btn--small" data-action="feature" data-id="${item.id}">Request feature</button>
        <button class="ghost btn--small" data-action="edit" data-id="${item.id}">Request edit</button>
        <button class="ghost btn--small" data-action="delete" data-id="${item.id}">Request delete</button>
      </div>
    `;
    card.addEventListener('click', (evt) => {
      const action = evt.target?.dataset?.action;
      const id = evt.target?.dataset?.id;
      if (!action || !id) return;
      if (action === 'feature') {
        requestSubmissionUpdate(id, { requestedFeature: true });
      }
      if (action === 'delete') {
        requestSubmissionUpdate(id, { deleteRequested: true });
      }
      if (action === 'edit') {
        const note = prompt('Describe the edits you want') || '';
        requestSubmissionUpdate(id, { editRequested: true, editPayload: note });
      }
    });
    fragment.appendChild(card);
  });
  ui.profileSubmissionList.appendChild(fragment);
};

const renderPackages = () => {
  if (!ui.purchasePackage) return;
  ui.purchasePackage.innerHTML = '<option value="">Select a package</option>';
  state.packages.forEach((pkg) => {
    const option = document.createElement('option');
    option.value = pkg.id;
    option.textContent = `${pkg.name} — $${pkg.price} for ${pkg.submissionLimit} submissions`;
    ui.purchasePackage.appendChild(option);
  });
};

const renderPackageGrid = () => {
  if (!ui.packageGrid) return;
  ui.packageGrid.innerHTML = '';
  if (!state.packages.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'No packages published yet.';
    ui.packageGrid.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  state.packages.forEach((pkg) => {
    const card = document.createElement('article');
    card.className = 'package-card';
    card.innerHTML = `
      <h4>${pkg.name || pkg.id}</h4>
      <p class="muted">$${pkg.price} — ${pkg.submissionLimit} submissions</p>
    `;
    fragment.appendChild(card);
  });
  ui.packageGrid.appendChild(fragment);
};

const renderWallet = () => {
  if (!ui.walletDisplay) return;
  const { network, address } = state.walletSettings || {};
  if (!network && !address) {
    ui.walletDisplay.textContent = 'Wallet details not set.';
    return;
  }
  ui.walletDisplay.innerHTML = `
    <div><strong>Network:</strong> ${network || '—'}</div>
    <div><strong>Wallet address:</strong> ${address || '—'}</div>
    <div class="muted">Send at least $1 equivalent, then submit your transaction below.</div>
  `;
};

const getRouteFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get('postname') || params.get('slug');
  const queryId = params.get('product');
  const path = window.location.pathname || '';
  const match = path.match(/\/product\/([^/?#]+)/i);
  const pathSlug = match ? decodeURIComponent(match[1]) : decodeURIComponent(path.replace(/^\/+/, '') || '');
  return { querySlug, queryId, pathSlug };
};

const requestSubmissionUpdate = async (id, payload) => {
  if (!dbInstance || !state.user) return;
  try {
    const submissionRef = ref(dbInstance, `${submissionConfig.path}/${id}`);
    const snap = await get(submissionRef);
    const existing = snap.val();
    if (!existing || existing.createdBy !== state.user.uid) {
      setStatus('Cannot update this submission.');
      return;
    }
    await set(submissionRef, { ...existing, ...payload, updatedAt: Date.now() });
    setStatus('Request sent to admin.');
  } catch (err) {
    console.error('Submission request failed', err);
    setStatus('Could not send request.');
  }
};

const fetchUserProfile = async (user) => {
  if (!dbInstance || !user) return null;
  const userRef = ref(dbInstance, `users/${user.uid}`);
  try {
    const snap = await get(userRef);
    const existing = snap.val();
    if (existing) return existing;
    const defaultProfile = {
      email: user.email || '',
      package: 'free',
      submissionLimit: 5,
      submissionsUsed: 0,
      createdAt: Date.now()
    };
    await set(userRef, defaultProfile);
    return defaultProfile;
  } catch (err) {
    console.warn('Could not fetch/create profile', err);
    return null;
  }
};

const startUserSubmissionsListener = (uid) => {
  if (!dbInstance || !uid) return;
  if (userSubUnsubscribe) userSubUnsubscribe();
  const subsRef = ref(dbInstance, submissionConfig.path);
  userSubUnsubscribe = onValue(subsRef, (snapshot) => {
    const data = snapshot.val() || {};
    const mine = Object.entries(data)
      .filter(([, value]) => value.createdBy === uid)
      .map(([id, value]) => ({ id, ...value }));
    state.userSubmissions = mine;
    renderUserSubmissions();
  });
};

const stopUserSubmissionsListener = () => {
  if (userSubUnsubscribe) {
    userSubUnsubscribe();
    userSubUnsubscribe = null;
  }
  state.userSubmissions = [];
  renderUserSubmissions();
};

const startPackagesListener = () => {
  if (!dbInstance) return;
  if (packagesUnsubscribe) packagesUnsubscribe();
  const packagesRef = ref(dbInstance, 'packages');
  packagesUnsubscribe = onValue(packagesRef, (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    state.packages = list;
    renderPackages();
    renderPackageGrid();
  });
};

const startWalletListener = () => {
  if (!dbInstance) return;
  if (walletUnsubscribe) walletUnsubscribe();
  const walletRef = ref(dbInstance, 'settings/wallet');
  walletUnsubscribe = onValue(walletRef, (snapshot) => {
    state.walletSettings = snapshot.val() || {};
    renderWallet();
  });
};

const applyUserState = async (user) => {
  state.user = user;
  updateNavAccount();
  if (!user) {
    state.userProfile = null;
    toggleProfileVisibility(false);
    setSubmitEnabled(false);
    setSubmitStatus('Sign in to submit products.', 'error');
    stopUserSubmissionsListener();
    return;
  }

  try {
    const profile = await fetchUserProfile(user);
    state.userProfile = profile;
    toggleProfileVisibility(true);
    renderProfileInfo();
    renderUserSubmissions();
    setSubmitEnabled(Boolean(submissionConfig.imgbbKey));
    setSubmitStatus('Share your product. Admin approval is required.', 'muted');
    startUserSubmissionsListener(user.uid);
  } catch (err) {
    console.error('Profile load failed', err);
    setStatus('Could not load profile.');
    toggleProfileVisibility(false);
  }
};

const setLoading = (active) => {
  if (!ui.loader) return;
  if (active) {
    ui.loader.classList.remove('is-hidden');
    ui.loader.setAttribute('aria-hidden', 'false');
  } else {
    ui.loader.classList.add('is-hidden');
    ui.loader.setAttribute('aria-hidden', 'true');
  }
};

const renderFilters = () => {
  let categories = Array.from(state.categories);
  const counts = state.categoryCounts || {};
  categories = categories.filter((cat) => cat === 'All' || counts[cat] > 0);
  categories.sort((a, b) => {
    if (a === 'All') return -1;
    if (b === 'All') return 1;
    return (counts[b] || 0) - (counts[a] || 0);
  });
  const targets = [ui.categoryFilters];

  targets.forEach((target) => {
    if (!target) return;
    target.innerHTML = '';
    categories.forEach((category) => {
      const pill = document.createElement('button');
      pill.className = `pill ${category === state.selectedCategory ? 'pill--active' : ''}`;
      pill.type = 'button';
      pill.textContent = category;
      pill.addEventListener('click', () => {
        state.selectedCategory = category;
        applyFilters();
        window.scrollTo({ top: target.offsetTop - 20, behavior: 'smooth' });
      });
      target.appendChild(pill);
    });
  });
};

const renderCategorySelect = () => {
  if (!ui.submitCategory) return;
  const categories = Array.from(state.categories).filter((cat) => cat !== 'All');
  ui.submitCategory.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = categories.length ? 'Choose a category' : 'No categories yet';
  ui.submitCategory.appendChild(placeholder);

  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    ui.submitCategory.appendChild(option);
  });
};

const buildProductCard = (product) => {
  const card = document.createElement("article");
  card.className = "card card--pill";
  card.dataset.id = product.id;
  const priceLabel = product.price ? `${Number(product.price).toFixed(2)}` : 'See details';
  const oldPrice = product.price ? `${Number(product.price * 1.2).toFixed(2)}` : '';
  const shortDescription = (product.description || '').replace(/\s+/g, ' ').slice(0, 100);
  const tagsLine = product.tags.slice(0, 3).join(' � ');
  const ratingVal = product.rating || 4.5;
  const stars = '?????'.slice(0, Math.round(ratingVal)) || '';
  const badgeLabel = product.badge || 'Top pick';

  card.innerHTML = `
    <div class="card__media">
      <span class="card__chip">${badgeLabel}</span>
      <img src="${product.image}" alt="${product.title}">
    </div>
    <div class="card__body">
      <p class="pill-badge">Caylin.shop</p>
      <h3 class="pill-title">${product.title}</h3>
      <p class="pill-line">${tagsLine || product.category || 'Featured'}</p>
      <p class="pill-desc">${shortDescription}${shortDescription.length >= 98 ? '...' : ''}</p>
      <div class="pill-rating">
        <span class="stars" aria-label="Rating ${ratingVal}">${stars}</span>
        <span class="rating-text">${ratingVal.toFixed(1)}</span>
      </div>
      <p class="pill-delivery">Incl. Free Delivery</p>
      <p class="pill-stock">In-Stock</p>
      <div class="pill-price-row">
        <span class="price pill-price">${priceLabel}</span>
        ${oldPrice ? `<span class="pill-old-price">${oldPrice}</span>` : ''}
      </div>
      <div class="pill-actions">
        <button class="pill-cart" type="button" aria-label="View product">View</button>
        <button class="pill-buy" type="button" aria-label="Buy now">Buy it now</button>
      </div>
    </div>
  `;

  const navigate = () => navigateToProduct(product);
  card.addEventListener('click', navigate);
  const cta = card.querySelector('.pill-cart');
  if (cta) {
    cta.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate();
    });
  }
  const buy = card.querySelector('.pill-buy');
  if (buy) {
    buy.addEventListener('click', (e) => {
      e.stopPropagation();
      if (product.sourceUrl) window.location.href = product.sourceUrl;
    });
  }
  return card;
};

const renderIntoGrid = (gridEl, products, emptyMessage) => {
  if (!gridEl) return;
  gridEl.innerHTML = '';

  if (!products.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = emptyMessage;
    gridEl.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach((product) => fragment.appendChild(buildProductCard(product)));
  gridEl.appendChild(fragment);
};

const observeLoadMore = (shouldObserve) => {
  if (!ui.loadMoreSentinel) return;
  if (shouldObserve) {
    if (!loadObserver) {
      loadObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry?.isIntersecting) {
            loadMoreProducts();
          }
        },
        { rootMargin: '0px 0px 320px 0px' }
      );
    }
    loadObserver.disconnect();
    loadObserver.observe(ui.loadMoreSentinel);
  } else if (loadObserver) {
    loadObserver.disconnect();
  }
};

const updateLoadMoreUi = (total, visible) => {
  if (!ui.loadMoreContainer) return;
  const hasProducts = total > 0;
  const hasMore = visible < total;

  ui.loadMoreContainer.classList.toggle('is-hidden', !hasProducts);
  if (ui.loadMoreBtn) {
    ui.loadMoreBtn.disabled = !hasMore;
    ui.loadMoreBtn.textContent = hasMore ? 'Show more products' : 'All products loaded';
  }
  if (ui.loadMoreStatus) {
    ui.loadMoreStatus.textContent = hasProducts
      ? `Showing ${visible} of ${total} product${total === 1 ? '' : 's'}`
      : 'No products found. Adjust filters or check your Firebase data.';
  }
  if (ui.loadMoreSentinel) {
    ui.loadMoreSentinel.hidden = !hasMore;
  }
  observeLoadMore(hasMore);
};

const renderProducts = (products) => {
  if (!ui.grid) return;
  ui.grid.innerHTML = '';

  const visibleProducts = products.slice(0, state.visibleCount);

  if (!visibleProducts.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'No products found. Adjust filters or check your Firebase data.';
    ui.grid.appendChild(empty);
    updateLoadMoreUi(products.length, visibleProducts.length);
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleProducts.forEach((product) => {
    fragment.appendChild(buildProductCard(product));
  });
  ui.grid.appendChild(fragment);

  updateLoadMoreUi(products.length, visibleProducts.length);
};

const renderNewProducts = () => {
  if (!ui.newGrid) return;
  ui.newGrid.innerHTML = '';
  const sorted = [...state.allProducts].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const top = sorted.slice(0, 8);
  if (!top.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'No recent products.';
    ui.newGrid.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  top.forEach((product) => fragment.appendChild(buildProductCard(product)));
  ui.newGrid.appendChild(fragment);
};

const loadMoreProducts = () => {
  if (!state.filtered.length) return;
  const nextCount = Math.min(state.visibleCount + PAGE_SIZE, state.filtered.length);
  if (nextCount === state.visibleCount) return;
  state.visibleCount = nextCount;
  renderProducts(state.filtered);
  const visible = Math.min(state.visibleCount, state.filtered.length);
  setStatus(`Showing ${visible} of ${state.filtered.length} product(s)`);
};

const buildQuickListItem = (product) => {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'quicklist__item';
  const priceLabel = product.price ? `$${Number(product.price).toFixed(2)}` : 'See details';
  item.innerHTML = `
    <span class="quicklist__thumb">
      <img src="${product.image}" alt="${product.title}">
    </span>
    <span class="quicklist__meta">
      <span class="quicklist__title">${product.title}</span>
      <span class="quicklist__price">${priceLabel}</span>
    </span>
  `;
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateToProduct(product);
  });
  return item;
};

const stopQuickListAutoScroll = () => {
  if (quickListAutoScrollTimer) {
    clearInterval(quickListAutoScrollTimer);
    quickListAutoScrollTimer = null;
  }
};

const startQuickListAutoScroll = (listEl) => {
  stopQuickListAutoScroll();
  if (!listEl) return;

  const tick = () => {
    const maxScroll = listEl.scrollHeight - listEl.clientHeight;
    if (maxScroll <= 0) return;
    const nearBottom = listEl.scrollTop + listEl.clientHeight >= maxScroll - 6;
    if (nearBottom) {
      listEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      listEl.scrollBy({ top: 140, behavior: 'smooth' });
    }
  };

  quickListAutoScrollTimer = setInterval(tick, 3200);

  // Pause auto-scroll on hover/touch/focus, resume on leave.
  if (!listEl.dataset.autoscrollBound) {
    const pause = () => stopQuickListAutoScroll();
    const resume = () => startQuickListAutoScroll(listEl);
    ['mouseenter', 'touchstart', 'focusin'].forEach((ev) => listEl.addEventListener(ev, pause));
    ['mouseleave', 'touchend', 'focusout'].forEach((ev) => listEl.addEventListener(ev, resume));
    listEl.dataset.autoscrollBound = 'true';
  }
};

const addRecentlyViewed = (product) => {
  if (!product || !product.id) return;
  const deduped = [product, ...(state.recentlyViewed || []).filter((p) => p.id !== product.id)];
  state.recentlyViewed = deduped.slice(0, 8);
  renderRecentList();
};

const stopAutoCarousel = () => {
  if (autoCarouselTimer) {
    clearInterval(autoCarouselTimer);
    autoCarouselTimer = null;
  }
};

const startAutoCarousel = (viewport) => {
  stopAutoCarousel();
  if (!viewport) return;

  const step = 240; // pixels per tick
  const tick = () => {
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    if (maxScroll <= 0) return;
    const nearEnd = viewport.scrollLeft + viewport.clientWidth >= maxScroll - 12;
    if (nearEnd) {
      viewport.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      viewport.scrollBy({ left: step, behavior: 'smooth' });
    }
  };

  autoCarouselTimer = setInterval(tick, 2600);

  if (!viewport.dataset.autoscrollBound) {
    const pause = () => stopAutoCarousel();
    const resume = () => startAutoCarousel(viewport);
    ['mouseenter', 'touchstart', 'focusin'].forEach((ev) => viewport.addEventListener(ev, pause));
    ['mouseleave', 'touchend', 'focusout'].forEach((ev) => viewport.addEventListener(ev, resume));
    viewport.dataset.autoscrollBound = 'true';
  }
};

const renderQuickList = (products) => {
  if (!ui.quickList) return;
  ui.quickList.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'quicklist__inner';
  container.innerHTML = `
    <div class="quicklist__head">
      <p class="eyebrow">Quick browse</p>
      <h4>Products</h4>
      <p class="muted quicklist__hint">Tap any item to open details.</p>
    </div>
  `;

  const listEl = document.createElement('div');
  listEl.className = 'quicklist__items';

  if (!products.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'No products match your filters yet.';
    listEl.appendChild(empty);
    stopQuickListAutoScroll();
  } else {
    const items = products.slice(0, 40);
    items.forEach((product) => listEl.appendChild(buildQuickListItem(product)));
    startQuickListAutoScroll(listEl);
  }

  container.appendChild(listEl);
  ui.quickList.appendChild(container);
};

const renderRecentList = () => {
  if (!ui.recentList) return;
  ui.recentList.innerHTML = '';
  const recent = state.recentlyViewed || [];

  const container = document.createElement('div');
  container.className = 'quicklist__inner recentlist__inner';
  container.innerHTML = `
    <div class="quicklist__head">
      <p class="eyebrow">Recently viewed</p>
      <h4>Latest products</h4>
      <p class="muted quicklist__hint">Your last opened items.</p>
    </div>
  `;

  const listEl = document.createElement('div');
  listEl.className = 'quicklist__items';
  if (!recent.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'No products viewed yet.';
    listEl.appendChild(empty);
  } else {
    recent.forEach((product) => listEl.appendChild(buildQuickListItem(product)));
  }
  container.appendChild(listEl);
  ui.recentList.appendChild(container);
};

const buildAutoCard = (product) => {
  const priceLabel = product.price ? `$${Number(product.price).toFixed(2)}` : 'See details';
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'auto-card';
  card.innerHTML = `
    <div class="auto-card__media">
      <img src="${product.image}" alt="${product.title}">
    </div>
    <div class="auto-card__body">
      <p class="auto-card__title">${product.title}</p>
      <p class="auto-card__price">${priceLabel}</p>
    </div>
  `;
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateToProduct(product);
  });
  return card;
};

const renderAutoCarousel = (products) => {
  const track = ui.autoCarouselTrack;
  if (!track) return;

  track.innerHTML = '';
  const subset = products.slice(0, 15);
  if (!subset.length) {
    stopAutoCarousel();
    return;
  }

  subset.forEach((product) => track.appendChild(buildAutoCard(product)));
  startAutoCarousel(track);
};

const renderFeatured = (products = state.allProducts) => {
  if (!ui.featuredGrid) return;
  const featured = products
    .filter((product) => {
      const badge = (product.badge || '').toLowerCase();
      return badge.includes('featured');
    })
    .slice(0, 8);

  ui.featuredGrid.innerHTML = '';
  if (!featured.length) {
    if (ui.featuredStatus) ui.featuredStatus.textContent = 'No featured products yet.';
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'Mark a product as Featured in Firebase to show it here.';
    ui.featuredGrid.appendChild(empty);
    return;
  }

  if (ui.featuredStatus) ui.featuredStatus.textContent = `Showing ${featured.length} featured product(s).`;
  const fragment = document.createDocumentFragment();
  featured.forEach((product) => fragment.appendChild(buildProductCard(product)));
  ui.featuredGrid.appendChild(fragment);
};

const renderCategoryList = (products = state.allProducts) => {
  if (!ui.categoryList) return;
  const counts = state.categoryCounts || {};
  const allCategories = Array.from(state.categories)
    .filter((cat) => cat !== 'All' && counts[cat] > 0)
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  ui.categoryList.innerHTML = '';

  if (!allCategories.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'Add a category to organize your products.';
    ui.categoryList.appendChild(empty);
    return;
  }

  const limit = 8;
  const categories = state.showAllCategories ? allCategories : allCategories.slice(0, limit);
  const fragment = document.createDocumentFragment();
  categories.forEach((cat) => {
    const count = products.filter(
      (product) => product.category === cat || product.tags.includes(cat)
    ).length;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'category-card';
    item.dataset.category = cat;
    item.innerHTML = `
      <div class="category-card__header">
        <span class="badge">${cat}</span>
        <span class="count">${count} item${count === 1 ? '' : 's'}</span>
      </div>
      <p class="muted">Tap to filter by this category.</p>
    `;
    fragment.appendChild(item);
  });

  ui.categoryList.appendChild(fragment);

  if (allCategories.length > limit) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ghost btn--small category-toggle';
    toggle.textContent = state.showAllCategories ? 'Show fewer' : `Show all (${allCategories.length})`;
    toggle.addEventListener('click', () => {
      state.showAllCategories = !state.showAllCategories;
      renderCategoryList(products);
    });
    ui.categoryList.appendChild(toggle);
  }
};

const refreshCategories = (products = state.allProducts) => {
  const categories = new Set(['All']);
  const counts = {};
  products.forEach((product) => {
    const cat = product.category;
    if (cat) {
      categories.add(cat);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    product.tags?.forEach((tag) => {
      categories.add(tag);
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  if (state.adminCategories.length) {
    state.adminCategories.forEach((cat) => categories.add(cat));
  }
  state.categories = categories;
  state.categoryCounts = counts;
  renderFilters();
  renderCategoryList(products);
  renderCategorySelect();
};

const applyFilters = () => {
  const query = (ui.search.value || '').trim().toLowerCase();
  const category = state.selectedCategory;

  const matches = state.allProducts.filter((product) => {
    const matchesQuery =
      !query ||
      product.title.toLowerCase().includes(query) ||
      (product.description || '').toLowerCase().includes(query) ||
      product.tags.some((tag) => tag.toLowerCase().includes(query));
    const matchesCategory = category === 'All' || product.category === category || product.tags.includes(category);
    return matchesQuery && matchesCategory;
  });

  state.filtered = matches;
  state.visibleCount = PAGE_SIZE;
  renderProducts(matches);
  renderQuickList(matches);
  renderAutoCarousel(matches);
  const visible = Math.min(state.visibleCount, matches.length);
  setStatus(`Showing ${visible} of ${matches.length} product(s)`);

  if (state.communityProducts.length) {
    const communityMatches = state.communityProducts.filter((product) => {
      const matchesQuery =
        !query ||
        product.title.toLowerCase().includes(query) ||
        (product.description || '').toLowerCase().includes(query) ||
        product.tags.some((tag) => tag.toLowerCase().includes(query));
      return matchesQuery;
    });
    renderIntoGrid(
      ui.communityGrid,
      communityMatches,
      'No community products found. Admin-approved submissions will appear here.'
    );
    if (ui.communityStatus) ui.communityStatus.textContent = `Community: ${communityMatches.length}`;
  }
};

const updateMetaForProduct = (product) => {
  document.title = `${product.title} | Caylin Shop`;
  const detailUrl = buildDetailUrl(product);
  const fullDesc = (product.description || defaults.description || '').replace(/\s+/g, ' ').trim();
  const desc = fullDesc.length > 160 ? `${fullDesc.slice(0, 157)}...` : fullDesc;
  const image = product.image || defaults.ogImage || defaults.twitterImage;

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) descriptionMeta.content = desc;

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = detailUrl;

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = document.title;
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = desc;
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = detailUrl;
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && image) ogImage.content = image;
  const ogWidth = document.querySelector('meta[property="og:image:width"]');
  if (ogWidth) ogWidth.content = '1200';
  const ogHeight = document.querySelector('meta[property="og:image:height"]');
  if (ogHeight) ogHeight.content = '630';

  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.content = document.title;
  const twDescription = document.querySelector('meta[name="twitter:description"]');
  if (twDescription) twDescription.content = desc;
  const twImage = document.querySelector('meta[name="twitter:image"]');
  if (twImage && image) twImage.content = image;
};

const resetMeta = () => {
  document.title = defaults.title;
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) descriptionMeta.content = defaults.description;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = defaults.canonical;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = defaults.ogTitle || defaults.title;
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = defaults.ogDescription || defaults.description;
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = defaults.canonical;
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && defaults.ogImage) ogImage.content = defaults.ogImage;
  const ogWidth = document.querySelector('meta[property="og:image:width"]');
  if (ogWidth && defaults.ogImageWidth) ogWidth.content = defaults.ogImageWidth;
  const ogHeight = document.querySelector('meta[property="og:image:height"]');
  if (ogHeight && defaults.ogImageHeight) ogHeight.content = defaults.ogImageHeight;
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.content = defaults.twitterTitle || defaults.title;
  const twDescription = document.querySelector('meta[name="twitter:description"]');
  if (twDescription) twDescription.content = defaults.twitterDescription || defaults.description;
  const twImage = document.querySelector('meta[name="twitter:image"]');
  if (twImage && defaults.twitterImage) twImage.content = defaults.twitterImage;
};

const buildDetailUrl = (product) => {
  const base = window.location.origin || '';
  const slug = encodeURIComponent(product.slug || product.id);
  return `${base}/product/${slug}`;
};

const openDrawer = (product, pushState) => {
  if (!product) return;
  state.currentProduct = product;

  ui.drawerTitle.textContent = product.title;
  ui.drawerPrice.textContent = product.price ? `$${Number(product.price).toFixed(2)}` : 'See details';
  ui.drawerDescription.textContent = product.description || 'Discover full details on caylin.wed2c.com.';
  ui.drawerCategory.textContent = product.category || 'Product';
  ui.drawerImage.src = product.image;
  ui.drawerImage.alt = product.title;
  ui.drawerBadge.innerHTML = product.badge ? `<span class="badge">${product.badge}</span>` : '';
  ui.drawerTags.innerHTML = product.tags.map((tag) => `<span class="tag">${tag}</span>`).join('');
  ui.drawerSourceLink.href = product.sourceUrl || buildDetailUrl(product);
  ui.drawerSourceLink.target = '_blank';
  ui.drawerShare.onclick = () => shareLink(buildDetailUrl(product));

  updateMetaForProduct(product);
  addRecentlyViewed(product);

  if (pushState) {
    const url = buildDetailUrl(product);
    window.history.pushState({ productId: product.id }, '', url);
  }

  ui.drawer.classList.add('drawer--open');
  ui.drawer.setAttribute('aria-hidden', 'false');
};

const closeDrawer = (updateUrl) => {
  ui.drawer.classList.remove('drawer--open');
  ui.drawer.setAttribute('aria-hidden', 'true');
  state.currentProduct = null;
  resetMeta();
  showSectionsFor('home');

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.delete('product');
    url.searchParams.delete('postname');
    url.pathname = '/';
    window.history.replaceState({}, '', url);
  }
};

const shareLink = async (url) => {
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Link copied to clipboard');
  } catch (err) {
    console.warn('Clipboard API unavailable', err);
    setStatus('Unable to copy link. Long-press or right click to copy.');
  }
};

const prefetchMetaFromUrl = async () => {
  const { queryId, querySlug, pathSlug } = getRouteFromLocation();
  const slug = querySlug || pathSlug;
  if (!firebaseConfig?.databaseURL) return;
  const base = firebaseConfig.databaseURL.replace(/\/$/, '');

  const fetchById = async (id) => {
    const path = `${databasePath || 'products'}/${id}.json`;
    const res = await fetch(`${base}/${path}`);
    if (!res.ok) return null;
    return res.json();
  };

  const fetchBySlug = async (slugValue) => {
    if (!slugValue) return null;
    const path = `${databasePath || 'products'}.json?orderBy=%22slug%22&equalTo=%22${encodeURIComponent(slugValue)}%22`;
    const res = await fetch(`${base}/${path}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    const first = Object.entries(data)[0];
    if (!first) return null;
    const [id, value] = first;
    return normalizeProduct(id, value);
  };

  try {
    if (queryId) {
      const data = await fetchById(queryId);
      if (data && data.title) {
        const normalized = normalizeProduct(queryId, data);
        updateMetaForProduct(normalized);
        return;
      }
    }
    const bySlug = await fetchBySlug(slug);
    if (bySlug) {
      updateMetaForProduct(bySlug);
    }
  } catch (err) {
    console.warn('Prefetch meta failed', err);
  }
};

const hydrateFromUrl = () => {
  const { querySlug, queryId, pathSlug } = getRouteFromLocation();
  const target =
    (querySlug && state.allProducts.find((p) => String(p.slug) === String(querySlug))) ||
    (queryId && state.allProducts.find((p) => String(p.id) === String(queryId))) ||
    (pathSlug && state.allProducts.find((p) => String(p.slug) === String(pathSlug)));
  if (target) {
    openDrawer(target, false);
    return;
  }
  closeDrawer(false);
};

const normalizeList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => normalizeProduct(item?.id || index, item))
      .filter(Boolean);
  }
  return Object.entries(raw)
    .map(([key, value]) => normalizeProduct(key, value))
    .filter(Boolean);
};

const startRealtimeListener = (db) => {
  const path = databasePath || 'products';
  const productsRef = ref(db, path);
  onValue(
    productsRef,
    (snapshot) => {
      const data = snapshot.val();
      const products = normalizeList(data).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const randomized = shuffleProducts(products);
      const isCommunity = (p) =>
        (p.badge || '').toLowerCase().includes('community') ||
        (p.category || '').toLowerCase() === 'community' ||
        Boolean(p.createdBy);
      state.communityProducts = randomized.filter(isCommunity);
      state.allProducts = randomized.filter((p) => !isCommunity(p));
      refreshCategories(state.allProducts);
      renderFeatured(products);
      applyFilters();
      renderNewProducts();
      hydrateFromUrl();
      const visibleMain = Math.min(state.visibleCount, state.allProducts.length);
      setStatus(
        `Showing ${visibleMain} of ${state.allProducts.length} main product(s) and ${state.communityProducts.length} community product(s) from Firebase RTDB`
      );
      updateTotals();
      setLoading(false);
    },
    (error) => {
      console.error('Firebase listener failed', error);
      setStatus('Could not fetch products from Firebase. Showing fallback data.');
      loadFallback();
      setLoading(false);
    }
  );
};

const startCategoriesListener = (db) => {
  const categoriesRef = ref(db, 'categories');
  onValue(
    categoriesRef,
    (snapshot) => {
      const data = snapshot.val();
      state.adminCategories = normalizeCategories(data);
      refreshCategories(state.allProducts);
    },
    (error) => {
      console.warn('Categories listener failed', error);
    }
  );
};

const loadFallback = () => {
  state.allProducts = sampleProducts;
  state.communityProducts = [];
  refreshCategories(sampleProducts);
  renderFeatured(sampleProducts);
  renderNewProducts();
  applyFilters();
  hydrateFromUrl();
  updateTotals();
  setLoading(false);
};

const showSubmitSection = () => {
  if (!ui.submitSection) return;
  showSectionsFor('submit');
  ui.submitSection.classList.remove('is-hidden');
  requestAnimationFrame(() => {
    ui.submitSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstField = ui.submitForm?.querySelector('input, textarea, select');
    if (firstField) {
      firstField.focus({ preventScroll: true });
    }
  });
};

const scrollToSection = (id) => {
  if (!id) return;
  if (id === 'submitSection') {
    showSubmitSection();
    return;
  }
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const showSectionsFor = (key) => {
  const config = {
    home: ['homeSection', 'communitySection', 'featuredSection', 'categoriesSection', 'packagesSection'],
    featured: ['featuredSection'],
    categories: ['categoriesSection'],
    submit: ['submitSection'],
    profile: ['profileSection']
  };
  const visible = config[key] || config.home;
  viewSections.forEach((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    if (visible.includes(sectionId)) {
      el.classList.remove('is-hidden');
    } else {
      el.classList.add('is-hidden');
    }
  });
  if (ui.hero) {
    ui.hero.classList.toggle('is-hidden', key === 'submit' || key === 'profile');
  }
};

const setupNavigation = () => {
  ['navHome', 'navFeatured', 'navCategories', 'navAddProduct'].forEach((key) => {
    const el = ui[key];
    if (!el) return;
    const target = el.dataset.target;
    el.addEventListener('click', (evt) => {
      evt.preventDefault();
      if (target === 'submitSection') {
        showSectionsFor('submit');
      } else if (target === 'featuredSection') {
        showSectionsFor('featured');
      } else if (target === 'categoriesSection') {
        showSectionsFor('categories');
      } else {
        showSectionsFor('home');
      }
      scrollToSection(target);
    });
  });
  if (ui.submitFab) {
    ui.submitFab.addEventListener('click', (evt) => {
      evt.preventDefault();
      scrollToSection('submitSection');
    });
  }
  if (ui.navAccount) {
    ui.navAccount.addEventListener('click', (evt) => {
      evt.preventDefault();
      if (state.user) {
        showSectionsFor('profile');
        const section = document.getElementById('profileSection');
        if (section) section.classList.remove('is-hidden');
        scrollToSection('profileSection');
      } else {
        openAuthModal('signup');
      }
    });
  }
};

const handleSubmission = async (evt) => {
  evt.preventDefault();
  if (!ui.submitForm) return;
  if (!dbInstance) {
    setSubmitStatus('Add Firebase credentials to submit products.', 'error');
    return;
  }
  if (!state.user) {
    setSubmitStatus('Sign in to submit products.', 'error');
    openAuthModal('login');
    return;
  }
  const { submissionLimit = 0, submissionsUsed = 0 } = state.userProfile || {};
  if (submissionsUsed >= submissionLimit) {
    setSubmitStatus('Submission limit reached. Contact admin for more slots.', 'error');
    return;
  }

  const title = (ui.submitTitle?.value || '').trim();
  const description = (ui.submitDescription?.value || '').trim();
  const productLink = (ui.submitLink?.value || '').trim();
  const contactMethod = ui.submitContactMethod?.value || 'whatsapp';
  const contactValue = (ui.submitContactValue?.value || '').trim();
  const category = (ui.submitCategory?.value || '').trim();
  const tags = ensureArray(ui.submitTags?.value || '');
  const imageFile = ui.submitImage?.files?.[0];

  if (!title || !description || !productLink || !contactValue) {
    setSubmitStatus('Please fill all required fields.', 'error');
    return;
  }
  if (!imageFile) {
    setSubmitStatus('Please add a product image.', 'error');
    return;
  }

  setSubmitEnabled(false);
  setSubmitStatus('Uploading image to imgbb...', 'muted');

  try {
    const imageUrl = await uploadImageToImgbb(imageFile);
    setSubmitStatus('Saving submission...', 'muted');

    const payload = {
      title,
      description,
      productLink,
      category,
      tags,
      contactMethod,
      contactValue,
      imageUrl,
      status: 'pending',
      createdAt: Date.now(),
      createdBy: state.user.uid
    };

    const submissionsRef = ref(dbInstance, submissionConfig.path);
    const newRef = push(submissionsRef);
    await set(newRef, payload);
    await runTransaction(ref(dbInstance, `users/${state.user.uid}/submissionsUsed`), (val) => (val || 0) + 1);
    if (state.userProfile) {
      state.userProfile.submissionsUsed = (state.userProfile.submissionsUsed || 0) + 1;
      renderProfileInfo();
    }
    ui.submitForm.reset();
    setSubmitStatus('Submitted for approval. It will appear after admin review.', 'success');
  } catch (err) {
    console.error('Submission failed', err);
    setSubmitStatus(`Submission failed: ${err.message}`, 'error');
  } finally {
    setSubmitEnabled(true);
  }
};

const setupSubmissionUi = () => {
  if (!ui.submitForm) return;
  ui.submitForm.addEventListener('submit', handleSubmission);
  const ready = configLooksValid() && Boolean(submissionConfig.imgbbKey) && Boolean(state.user);
  setSubmitEnabled(ready);
  if (!configLooksValid()) {
    setSubmitStatus('Add Firebase credentials to enable submissions.', 'error');
  } else if (!submissionConfig.imgbbKey) {
    setSubmitStatus('Image upload key not configured. Contact admin.', 'error');
  } else if (!state.user) {
    setSubmitStatus('Sign in to submit products.', 'error');
  } else {
    setSubmitStatus('Share your product. Admin approval is required before it appears here.');
  }
};

const setupAuthModal = () => {
  ui.authTabs?.forEach((tab) => {
    tab.addEventListener('click', () => setAuthMode(tab.dataset.mode));
  });
  if (ui.authClose) {
    ui.authClose.addEventListener('click', () => closeAuthModal());
  }
  if (ui.authModal) {
    ui.authModal.addEventListener('click', (evt) => {
      if (evt.target === ui.authModal) closeAuthModal();
    });
  }
  if (ui.authLogoutModal) {
    ui.authLogoutModal.addEventListener('click', async () => {
      if (authInstance) await signOut(authInstance);
      closeAuthModal();
    });
  }
  if (ui.authFormModal) {
    ui.authFormModal.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      if (!authInstance) return;
      const email = (ui.authEmailModal?.value || '').trim();
      const password = (ui.authPasswordModal?.value || '').trim();
      if (!email) {
        ui.authModalStatus.textContent = 'Email is required.';
        return;
      }
      if (currentAuthMode !== 'reset' && !password) {
        ui.authModalStatus.textContent = 'Password is required.';
        return;
      }
      try {
        if (currentAuthMode === 'reset') {
          await sendPasswordResetEmail(authInstance, email);
          ui.authModalStatus.textContent = 'Reset link sent if the email exists.';
        } else if (currentAuthMode === 'signup') {
          await createUserWithEmailAndPassword(authInstance, email, password);
          ui.authModalStatus.textContent = 'Account created.';
          closeAuthModal();
        } else {
          await signInWithEmailAndPassword(authInstance, email, password);
          ui.authModalStatus.textContent = 'Signed in.';
          closeAuthModal();
        }
      } catch (err) {
        ui.authModalStatus.textContent = err.message;
      }
    });
  }
  setAuthMode('login');
};

const setupPurchaseForm = () => {
  if (!ui.purchaseForm) return;
  ui.purchaseForm.addEventListener('submit', handlePurchaseRequest);
};

const handlePurchaseRequest = async (evt) => {
  evt.preventDefault();
  if (!dbInstance) return;
  if (!state.user) {
    setStatus('Sign in to submit a purchase request.');
    openAuthModal('login');
    return;
  }
  const pkg = ui.purchasePackage?.value || '';
  const amount = parseFloat(ui.purchaseAmount?.value || '0');
  const network = (ui.purchaseNetwork?.value || '').trim();
  const txId = (ui.purchaseTxId?.value || '').trim();
  const note = (ui.purchaseNote?.value || '').trim();
  const walletAddress = state.walletSettings?.address || '';
  if (!pkg || !amount || amount < 1 || !network || !txId) {
    ui.purchaseStatus.textContent = 'Fill all fields. Minimum $1.';
    ui.purchaseStatus.dataset.tone = 'error';
    return;
  }
  try {
    ui.purchaseSubmit.disabled = true;
    ui.purchaseStatus.textContent = 'Submitting...';
    ui.purchaseStatus.dataset.tone = 'muted';
    const payload = {
      uid: state.user.uid,
      packageRequested: pkg,
      amount,
      network,
      walletAddress,
      txId,
      note,
      createdAt: Date.now(),
      status: 'pending'
    };
    await set(push(ref(dbInstance, 'purchaseRequests')), payload);
    if (ui.purchaseForm) ui.purchaseForm.reset();
    ui.purchaseStatus.textContent = 'Submitted. Admin will review.';
    ui.purchaseStatus.dataset.tone = 'success';
  } catch (err) {
    ui.purchaseStatus.textContent = `Failed: ${err.message}`;
    ui.purchaseStatus.dataset.tone = 'error';
  } finally {
    ui.purchaseSubmit.disabled = false;
  }
};

const init = () => {
  ui.search.addEventListener('input', () => applyFilters());
  if (ui.loadMoreBtn) {
    ui.loadMoreBtn.addEventListener('click', () => loadMoreProducts());
  }
  ui.drawerClose.addEventListener('click', () => closeDrawer(true));
  ui.drawer.addEventListener('click', (evt) => {
    if (evt.target === ui.drawer) closeDrawer(true);
  });
  prefetchMetaFromUrl();
  window.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && ui.drawer.classList.contains('drawer--open')) {
      closeDrawer(true);
    }
  });
  window.addEventListener('popstate', () => hydrateFromUrl());
  setLoading(true);
  showSectionsFor('home');
  renderRecentList();
  setupNavigation();
  setupSubmissionUi();
  setupAuthModal();
  setupPurchaseForm();

  if (!configLooksValid()) {
    setStatus('Add Firebase credentials in firebase-config.js to fetch live data. Showing sample catalog.');
    loadFallback();
    setSubmitEnabled(false);
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
    authInstance = getAuth(app);
    onAuthStateChanged(authInstance, async (user) => {
      await applyUserState(user);
    });
    startRealtimeListener(dbInstance);
    startCategoriesListener(dbInstance);
    startPackagesListener();
    startWalletListener();
    setSubmitEnabled(Boolean(state.user));
  } catch (err) {
    console.error('Firebase init failed', err);
    setStatus('Firebase init failed. Check firebase-config.js.');
    loadFallback();
    setSubmitEnabled(false);
  }
};

init();


