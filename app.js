/* Caramel Store — Complete App Logic */

const WHATSAPP_NUMBER = '201000000000'; // ضع رقم الواتساب الخاص بالمتجر بصيغة دولية بدون +

const STORAGE_KEYS = {
  CART: 'caramel_cart_v1',
  ORDERS: 'caramel_orders_v1',
  CUSTOMER: 'caramel_customer_v1',
  THEME: 'caramel_theme_v1',
  NOTIFS: 'caramel_notifs_v1'
};

const GITHUB_MERCHANTS_CONFIG = [
  { slug: 'shireen-ghareeb', name: 'شيرين غريب' },
  { slug: 'mohamed-ghareeb', name: 'محمد غريب' },
  { slug: 'umm-ammar', name: 'أم عمار' }
];

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'welcome-caramel',
    title: 'أهلاً بك في كارامل ستور',
    body: 'تصفح منتجات التجار والشركاء في السويس وأرسل طلبك مباشرة عبر واتساب.',
    date: 'اليوم'
  },

];

const state = {
  merchants: [],
  products: [],
  cart: [],
  orders: [],
  notifications: [],
  customer: { name: '', phone: '', address: '', notes: '' },
  selectedMerchantSlug: 'all',
  selectedCategory: 'all',
  selectedPriceRange: 'all',
  searchQuery: '',
  sortBy: 'default',
  activeOrderTab: 'active',
  overlayStack: [],
  suppressHistoryStep: false,
  cardImageIndices: {},
  previewProductId: null,
  previewSelectedImageIndex: 0,
  previewSelectedOptions: {},
  optionModalProductId: null,
  optionModalSelectedImageIndex: 0,
  optionModalSelectedOptions: {},
  pendingConfirmCallback: null
};

/* ---------- Helper Functions ---------- */

function formatPrice(val) {
  const num = Number(val) || 0;
  return `${num.toLocaleString('ar-EG')} ج.م`;
}

function normalizeArabic(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/\s+/g, ' ')
    .trim();
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 2400);
}

function getProductById(productId) {
  return state.products.find((p) => p.id === productId) || null;
}

function getMerchantBySlug(slug) {
  return state.merchants.find((m) => m.slug === slug) || null;
}

function isProductImageSoldOut(product, imgSrc) {
  if (!product || !imgSrc) return false;
  if (product.soldOut === true) return true;
  const list = Array.isArray(product.soldOutImages) ? product.soldOutImages : [];
  return list.includes(imgSrc);
}

function syncSoldOutOverlayOnElement(overlayEl, isSoldOut, label = 'نفدت الكمية') {
  if (!overlayEl) return;
  overlayEl.textContent = label;
  overlayEl.classList.toggle('hidden', !isSoldOut);
}

function getProductVariantConfig(product, selectedOptions = {}, selectedImageIndex = 0) {
  const images = Array.isArray(product?.images) && product.images.length
    ? product.images
    : ['compressed_1795766509611.jpeg'];
  const safeIdx = Math.max(0, Math.min(selectedImageIndex, images.length - 1));
  const activeImage = images[safeIdx];
  const imageSoldOut = isProductImageSoldOut(product, activeImage);

  const optionEntries = Object.entries(selectedOptions || {}).filter(([, v]) => Boolean(v));
  const variantLabel = optionEntries.map(([k, v]) => `${k}: ${v}`).join(' | ');

  let unitPrice = Number(product?.price) || 0;
  if (Array.isArray(product?.optionPrices)) {
    for (const [k, v] of optionEntries) {
      const match = product.optionPrices.find(
        (item) => normalizeArabic(item.optionName) === normalizeArabic(k) && normalizeArabic(item.value) === normalizeArabic(v)
      );
      if (match && typeof match.price === 'number') {
        unitPrice = match.price;
      } else if (match && typeof match.delta === 'number') {
        unitPrice += match.delta;
      }
    }
  }

  return {
    activeImage,
    imageSoldOut,
    variantLabel,
    unitPrice
  };
}

/* ---------- Storage & Persistence ---------- */

function loadPersistentData() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
    if (Array.isArray(savedCart)) state.cart = savedCart;
  } catch (_) {
    state.cart = [];
  }

  try {
    const savedOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
    if (Array.isArray(savedOrders)) state.orders = savedOrders;
  } catch (_) {
    state.orders = [];
  }

  try {
    const savedCustomer = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMER) || '{}');
    if (savedCustomer && typeof savedCustomer === 'object') {
      state.customer = { ...state.customer, ...savedCustomer };
    }
  } catch (_) {}

  try {
    const savedNotifs = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFS) || 'null');
    state.notifications = Array.isArray(savedNotifs) && savedNotifs.length ? savedNotifs : DEFAULT_NOTIFICATIONS;
  } catch (_) {
    state.notifications = DEFAULT_NOTIFICATIONS;
  }

  const theme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  }
  syncThemeIcon();
}

function saveCart() {
  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart));
  updateCartHeaderUI();
}

function saveOrders() {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(state.orders));
  updateOrdersBadgeUI();
}

function saveCustomerForm() {
  state.customer = {
    name: (document.getElementById('customerNameInput')?.value || '').trim(),
    phone: (document.getElementById('customerPhoneInput')?.value || '').trim(),
    address: (document.getElementById('customerAddressInput')?.value || '').trim(),
    notes: (document.getElementById('customerNotesInput')?.value || '').trim()
  };
  localStorage.setItem(STORAGE_KEYS.CUSTOMER, JSON.stringify(state.customer));
}

function populateCustomerForm() {
  const nameEl = document.getElementById('customerNameInput');
  const phoneEl = document.getElementById('customerPhoneInput');
  const addrEl = document.getElementById('customerAddressInput');
  const notesEl = document.getElementById('customerNotesInput');
  if (nameEl) nameEl.value = state.customer.name || '';
  if (phoneEl) phoneEl.value = state.customer.phone || '';
  if (addrEl) addrEl.value = state.customer.address || '';
  if (notesEl) notesEl.value = state.customer.notes || '';
}

/* ---------- Theme & Splash ---------- */

function syncThemeIcon() {
  const icon = document.getElementById('themeIcon');
  const isDark = document.body.classList.contains('dark-mode');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  syncThemeIcon();
}

function runSplashScreen() {
  const splash = document.getElementById('caramelSplashScreen');
  const typedEl = document.getElementById('splashTypedText');
  const barEl = document.getElementById('splashProgressBar');
  const skipBtn = document.getElementById('splashSkipBtn');

  if (!splash) return;

  const phrases = [
    'أهلاً بك في كارامل ستور...',
    'إكسسوارات وهدايا وملابس في السويس',
    'اطلب بسهولة وراحة عبر واتساب'
  ];

  let phraseIdx = 0;
  let charIdx = 0;
  let dismissed = false;
  let progress = 12;

  const finishSplash = () => {
    if (dismissed) return;
    dismissed = true;
    clearInterval(typeTimer);
    clearInterval(progTimer);
    clearTimeout(autoHideTimer);
    if (barEl) barEl.style.width = '100%';
    splash.classList.add('splash-hide');
    splash.setAttribute('aria-hidden', 'true');
    setTimeout(() => splash.classList.add('hidden'), 480);
  };

  if (skipBtn) skipBtn.addEventListener('click', finishSplash);

  const typeTimer = setInterval(() => {
    if (dismissed || !typedEl) return;
    const current = phrases[phraseIdx];
    typedEl.textContent = current.slice(0, charIdx + 1);
    charIdx++;
    if (charIdx > current.length + 6) {
      charIdx = 0;
      phraseIdx = (phraseIdx + 1) % phrases.length;
    }
  }, 55);

  const progTimer = setInterval(() => {
    if (dismissed) return;
    progress = Math.min(92, progress + 14);
    if (barEl) barEl.style.width = `${progress}%`;
  }, 180);

  const autoHideTimer = setTimeout(finishSplash, 1450);
}

/* ---------- Overlay Stack Management ---------- */

function openOverlayElement(el, type, id) {
  if (!el) return;
  el.classList.remove('hidden');
  const existingIdx = state.overlayStack.findIndex((item) => item.id === id);
  if (existingIdx !== -1) {
    state.overlayStack.splice(existingIdx, 1);
  }
  state.overlayStack.push({ type, id, el });
  if (history && history.pushState) {
    try {
      history.pushState({ overlayId: id }, '');
    } catch (_) {}
  }
}

function closeOverlayElement(el, fromPopState = false) {
  if (!el || el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  const idx = state.overlayStack.findIndex((item) => item.el === el);
  if (idx !== -1) {
    state.overlayStack.splice(idx, 1);
  }
  if (!fromPopState && history && history.state && history.state.overlayId) {
    state.suppressHistoryStep = true;
    try {
      history.back();
    } catch (_) {
      state.suppressHistoryStep = false;
    }
    setTimeout(() => {
      state.suppressHistoryStep = false;
    }, 60);
  }
}

window.addEventListener('popstate', () => {
  if (state.suppressHistoryStep) {
    state.suppressHistoryStep = false;
    return;
  }
  const top = state.overlayStack.pop();
  if (top && top.el) {
    top.el.classList.add('hidden');
  }
});

/* ---------- Data Loading ---------- */

async function fetchJsonWithFallback(paths) {
  for (const path of paths) {
    try {
      const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
  }
  return null;
}

async function loadAllStoreData() {
  const merchantsMap = new Map();
  const collectedProducts = [];

  for (const cfg of GITHUB_MERCHANTS_CONFIG) {
    const data = await fetchJsonWithFallback([
      `merchants/${cfg.slug}.json`,
      `${cfg.slug}.json`
    ]);

    const mInfo = data?.merchant || {};
    const slug = mInfo.slug || cfg.slug;
    const merchantObj = {
      id: mInfo.id || slug,
      slug,
      name: mInfo.name || cfg.name,
      category: mInfo.category || 'متنوع',
      image: mInfo.image || 'compressed_1795766509611.jpeg',
      description: mInfo.description || ''
    };
    merchantsMap.set(slug, merchantObj);

    const prods = Array.isArray(data?.products) ? data.products : [];
    prods.forEach((prod, idx) => {
      const images = Array.isArray(prod.images) && prod.images.length
        ? prod.images
        : [merchantObj.image || 'compressed_1795766509611.jpeg'];
      collectedProducts.push({
        id: prod.id || `${slug}-prod-${idx + 1}`,
        title: prod.title || 'منتج بدون اسم',
        price: Number(prod.price) || 0,
        category: prod.category || merchantObj.category || 'عام',
        description: prod.description || '',
        images,
        soldOutImages: Array.isArray(prod.soldOutImages) ? prod.soldOutImages : [],
        soldOut: Boolean(prod.soldOut),
        options: Array.isArray(prod.options) ? prod.options : [],
        optionPrices: Array.isArray(prod.optionPrices) ? prod.optionPrices : [],
        merchantSlug: slug,
        merchantName: merchantObj.name,
        _orderIndex: collectedProducts.length
      });
    });
  }

  state.merchants = Array.from(merchantsMap.values());
  state.products = collectedProducts;
}

/* ---------- Filtering & Rendering ---------- */

function getFilteredProducts() {
  const normSearch = normalizeArabic(state.searchQuery);

  let list = state.products.filter((p) => {
    if (state.selectedMerchantSlug !== 'all' && p.merchantSlug !== state.selectedMerchantSlug) {
      return false;
    }
    if (state.selectedCategory !== 'all' && normalizeArabic(p.category) !== normalizeArabic(state.selectedCategory)) {
      return false;
    }
    if (state.selectedPriceRange !== 'all') {
      const price = Number(p.price) || 0;
      if (state.selectedPriceRange === 'under-150' && price >= 150) return false;
      if (state.selectedPriceRange === '150-300' && (price < 150 || price > 300)) return false;
      if (state.selectedPriceRange === 'over-300' && price <= 300) return false;
    }
    if (normSearch) {
      const hay = normalizeArabic(`${p.title} ${p.description} ${p.category} ${p.merchantName} ${p.id}`);
      if (!hay.includes(normSearch)) return false;
    }
    return true;
  });

  if (state.sortBy === 'price-asc') {
    list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (state.sortBy === 'price-desc') {
    list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (state.sortBy === 'newest') {
    list = [...list].sort((a, b) => b._orderIndex - a._orderIndex);
  }

  return list;
}

function renderMerchantsStrip() {
  const strip = document.getElementById('merchantsStrip');
  if (!strip) return;

  const allCount = state.products.length;
  const cards = [
    `<div class="merchant-card ${state.selectedMerchantSlug === 'all' ? 'active' : ''}" data-merchant="all">
      <img src="compressed_1795766509611.jpeg" alt="كل التجار" class="merchant-avatar" />
      <div class="merchant-info">
        <span class="merchant-name">كل التجار</span>
        <span class="merchant-count">${allCount} منتج</span>
      </div>
    </div>`
  ];

  state.merchants.forEach((m) => {
    const count = state.products.filter((p) => p.merchantSlug === m.slug).length;
    cards.push(`
      <div class="merchant-card ${state.selectedMerchantSlug === m.slug ? 'active' : ''}" data-merchant="${m.slug}">
        <img src="${m.image}" alt="${m.name}" class="merchant-avatar" onerror="this.src='compressed_1795766509611.jpeg'" />
        <div class="merchant-info">
          <span class="merchant-name">${m.name}</span>
          <span class="merchant-count">${count} منتج</span>
        </div>
      </div>
    `);
  });

  strip.innerHTML = cards.join('');
  strip.querySelectorAll('.merchant-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.selectedMerchantSlug = card.dataset.merchant || 'all';
      renderAllViews();
    });
  });
}

function renderCategoryChips() {
  const wrap = document.getElementById('categoryChips');
  if (!wrap) return;

  const baseProducts = state.selectedMerchantSlug === 'all'
    ? state.products
    : state.products.filter((p) => p.merchantSlug === state.selectedMerchantSlug);

  const categories = Array.from(new Set(baseProducts.map((p) => p.category).filter(Boolean)));
  if (state.selectedCategory !== 'all' && !categories.includes(state.selectedCategory)) {
    state.selectedCategory = 'all';
  }

  const html = [
    `<button type="button" class="chip-btn ${state.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">الكل</button>`,
    ...categories.map(
      (cat) => `<button type="button" class="chip-btn ${state.selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>`
    )
  ].join('');

  wrap.innerHTML = html;
  wrap.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.dataset.cat || 'all';
      renderProductsGrid();
      renderFilterBanner();
    });
  });
}

function renderPriceChips() {
  const wrap = document.getElementById('priceChips');
  if (!wrap) return;

  const ranges = [
    { key: 'all', label: 'كل الأسعار' },
    { key: 'under-150', label: 'أقل من 150 ج.م' },
    { key: '150-300', label: '150 – 300 ج.م' },
    { key: 'over-300', label: 'أكثر من 300 ج.م' }
  ];

  wrap.innerHTML = ranges
    .map(
      (r) => `<button type="button" class="price-chip-btn ${state.selectedPriceRange === r.key ? 'active' : ''}" data-price="${r.key}">${r.label}</button>`
    )
    .join('');

  wrap.querySelectorAll('.price-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedPriceRange = btn.dataset.price || 'all';
      renderProductsGrid();
      renderFilterBanner();
    });
  });
}

function renderFilterBanner() {
  const banner = document.getElementById('activeFilterBanner');
  const textEl = document.getElementById('activeFilterText');
  const resetHeadBtn = document.getElementById('resetFiltersBtn');
  if (!banner || !textEl) return;

  const parts = [];
  if (state.selectedMerchantSlug !== 'all') {
    const m = getMerchantBySlug(state.selectedMerchantSlug);
    if (m) parts.push(`التاجر: ${m.name}`);
  }
  if (state.selectedCategory !== 'all') {
    parts.push(`القسم: ${state.selectedCategory}`);
  }
  if (state.selectedPriceRange !== 'all') {
    const map = { 'under-150': 'أقل من 150 ج.م', '150-300': '150 – 300 ج.م', 'over-300': 'أكثر من 300 ج.م' };
    parts.push(`السعر: ${map[state.selectedPriceRange] || state.selectedPriceRange}`);
  }
  if (state.searchQuery.trim()) {
    parts.push(`بحث: "${state.searchQuery.trim()}"`);
  }

  const hasFilter = parts.length > 0;
  banner.classList.toggle('hidden', !hasFilter);
  if (resetHeadBtn) resetHeadBtn.classList.toggle('hidden', !hasFilter);
  if (hasFilter) {
    textEl.textContent = `الفلاتر النشطة: ${parts.join(' • ')}`;
  }
}

function buildProductCardHTML(product) {
  const images = product.images.length ? product.images : ['compressed_1795766509611.jpeg'];
  const idx = state.cardImageIndices[product.id] || 0;
  const safeIdx = Math.max(0, Math.min(idx, images.length - 1));
  const currentImg = images[safeIdx];
  const soldOut = isProductImageSoldOut(product, currentImg);
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;

  const navButtons = images.length > 1
    ? `
      <button type="button" class="product-img-nav prev" data-action="prev-img" data-id="${product.id}" aria-label="الصورة السابقة">›</button>
      <button type="button" class="product-img-nav next" data-action="next-img" data-id="${product.id}" aria-label="الصورة التالية">‹</button>
      <div class="img-dots">
        ${images.map((_, dIdx) => `<span class="img-dot ${dIdx === safeIdx ? 'active' : ''}"></span>`).join('')}
      </div>
    `
    : '';

  return `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-img-wrap" data-action="preview" data-id="${product.id}">
        <img src="${currentImg}" alt="${product.title}" class="product-img" loading="lazy" onerror="this.src='compressed_1795766509611.jpeg'" />
        <div class="sold-out-overlay ${soldOut ? '' : 'hidden'}">نفدت الكمية</div>
        ${navButtons}
      </div>
      <div class="product-body">
        <div class="product-merchant-line">${product.merchantName} • ${product.category}</div>
        <h3 class="product-title" data-action="preview" data-id="${product.id}">${product.title}</h3>
        <div class="product-price-row">
          <span class="product-price">${formatPrice(product.price)}</span>
        </div>
        <button type="button" class="product-add-btn" data-action="add-or-options" data-id="${product.id}">
          ${soldOut ? 'غير متاح حالياً' : hasOptions ? 'اختر المواصفات' : 'أضف للسلة +'}
        </button>
      </div>
    </article>
  `;
}

function setCardImageByIndex(productId, nextIndex) {
  const product = getProductById(productId);
  if (!product) return;
  const images = product.images.length ? product.images : ['compressed_1795766509611.jpeg'];
  const wrapped = ((nextIndex % images.length) + images.length) % images.length;
  state.cardImageIndices[productId] = wrapped;

  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  if (!card) return;

  const imgEl = card.querySelector('.product-img');
  const overlayEl = card.querySelector('.sold-out-overlay');
  const addBtn = card.querySelector('.product-add-btn');
  const dots = card.querySelectorAll('.img-dot');

  const imgSrc = images[wrapped];
  if (imgEl) imgEl.src = imgSrc;
  const soldOut = isProductImageSoldOut(product, imgSrc);
  syncSoldOutOverlayOnElement(overlayEl, soldOut);

  if (addBtn) {
    const hasOptions = Array.isArray(product.options) && product.options.length > 0;
    addBtn.textContent = soldOut ? 'غير متاح حالياً' : hasOptions ? 'اختر المواصفات' : 'أضف للسلة +';
  }

  dots.forEach((dot, dIdx) => dot.classList.toggle('active', dIdx === wrapped));
}

function renderProductsGrid() {
  const grid = document.getElementById('productsGrid');
  const countLabel = document.getElementById('productsCountLabel');
  const titleEl = document.getElementById('productsSectionTitle');
  const emptyBox = document.getElementById('emptyStateBox');
  if (!grid) return;

  const filtered = getFilteredProducts();

  if (titleEl) {
    if (state.selectedMerchantSlug !== 'all') {
      const m = getMerchantBySlug(state.selectedMerchantSlug);
      titleEl.textContent = m ? `منتجات ${m.name}` : 'المنتجات';
    } else {
      titleEl.textContent = 'جميع المنتجات';
    }
  }

  if (countLabel) {
    countLabel.textContent = `${filtered.length} منتج`;
  }

  if (!filtered.length) {
    grid.innerHTML = '';
    if (emptyBox) emptyBox.classList.remove('hidden');
    return;
  }

  if (emptyBox) emptyBox.classList.add('hidden');
  grid.innerHTML = filtered.map(buildProductCardHTML).join('');

  grid.querySelectorAll('[data-action="prev-img"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      setCardImageByIndex(id, (state.cardImageIndices[id] || 0) - 1);
    });
  });

  grid.querySelectorAll('[data-action="next-img"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      setCardImageByIndex(id, (state.cardImageIndices[id] || 0) + 1);
    });
  });

  grid.querySelectorAll('[data-action="preview"]').forEach((el) => {
    el.addEventListener('click', () => {
      openProductPreview(el.dataset.id);
    });
  });

  grid.querySelectorAll('[data-action="add-or-options"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAddOrSelectOptions(btn.dataset.id);
    });
  });
}

function renderAllViews() {
  renderMerchantsStrip();
  renderCategoryChips();
  renderPriceChips();
  renderFilterBanner();
  renderProductsGrid();
}

function resetAllFilters() {
  state.selectedMerchantSlug = 'all';
  state.selectedCategory = 'all';
  state.selectedPriceRange = 'all';
  state.searchQuery = '';
  state.sortBy = 'default';
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const sortSelect = document.getElementById('sortSelect');
  if (searchInput) searchInput.value = '';
  if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
  if (sortSelect) sortSelect.value = 'default';
  renderAllViews();
}

/* ---------- Adding to Cart & Options ---------- */

function addConfiguredProductToCart(product, selectedOptions = {}, selectedImageIndex = 0, qty = 1) {
  if (!product) return false;
  const cfg = getProductVariantConfig(product, selectedOptions, selectedImageIndex);
  if (cfg.imageSoldOut) {
    showToast('عذراً، هذا الخيار أو الصورة غير متاحة حالياً');
    return false;
  }

  const cartKey = `${product.id}__${cfg.activeImage}__${cfg.variantLabel}`;
  const existing = state.cart.find((item) => item.cartKey === cartKey);

  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({
      cartKey,
      productId: product.id,
      title: product.title,
      merchantSlug: product.merchantSlug,
      merchantName: product.merchantName,
      price: cfg.unitPrice,
      image: cfg.activeImage,
      variantLabel: cfg.variantLabel,
      qty
    });
  }

  saveCart();
  showToast(`تمت إضافة "${product.title}" إلى السلة`);
  return true;
}

function handleAddOrSelectOptions(productId) {
  const product = getProductById(productId);
  if (!product) return;

  const imgIdx = state.cardImageIndices[productId] || 0;
  const images = product.images.length ? product.images : ['compressed_1795766509611.jpeg'];
  const activeImg = images[Math.max(0, Math.min(imgIdx, images.length - 1))];

  if (isProductImageSoldOut(product, activeImg)) {
    showToast('عذراً، نفدت الكمية لهذا المنتج حالياً');
    return;
  }

  if (Array.isArray(product.options) && product.options.length > 0) {
    openOptionsModal(product, imgIdx);
  } else {
    addConfiguredProductToCart(product, {}, imgIdx, 1);
  }
}

/* ---------- Options Modal ---------- */

function openOptionsModal(product, initialImgIndex = 0) {
  const modal = document.getElementById('optionsModal');
  if (!modal || !product) return;

  state.optionModalProductId = product.id;
  state.optionModalSelectedImageIndex = initialImgIndex;
  state.optionModalSelectedOptions = {};

  (product.options || []).forEach((opt) => {
    if (Array.isArray(opt.values) && opt.values.length) {
      state.optionModalSelectedOptions[opt.name] = opt.values[0];
    }
  });

  document.getElementById('optionsModalTitle').textContent = product.title;
  document.getElementById('optionsModalSubtitle').textContent = `${product.merchantName} • ${product.category}`;

  renderOptionModalGallery(product);
  renderOptionModalGroups(product);
  syncOptionModalFooter(product);

  openOverlayElement(modal, 'modal', 'optionsModal');
}

function renderOptionModalGallery(product) {
  const strip = document.getElementById('optionGalleryStrip');
  if (!strip) return;
  const images = product.images.length ? product.images : ['compressed_1795766509611.jpeg'];

  strip.innerHTML = images
    .map((src, idx) => {
      const soldOut = isProductImageSoldOut(product, src);
      const active = idx === state.optionModalSelectedImageIndex;
      return `
        <div class="preview-thumb-wrap ${active ? 'active' : ''}" data-opt-img-idx="${idx}">
          <img src="${src}" alt="" class="preview-thumb-img" onerror="this.src='compressed_1795766509611.jpeg'" />
          ${soldOut ? '<span class="preview-thumb-soldout">نفد</span>' : ''}
        </div>
      `;
    })
    .join('');

  strip.querySelectorAll('[data-opt-img-idx]').forEach((el) => {
    el.addEventListener('click', () => {
      state.optionModalSelectedImageIndex = Number(el.dataset.optImgIdx) || 0;
      renderOptionModalGallery(product);
      syncOptionModalFooter(product);
    });
  });
}

function renderOptionModalGroups(product) {
  const container = document.getElementById('optionsModalGroups');
  if (!container) return;

  container.innerHTML = (product.options || [])
    .map((opt) => {
      const selectedVal = state.optionModalSelectedOptions[opt.name];
      const btns = (opt.values || [])
        .map(
          (val) => `
            <button type="button" class="option-pill-btn ${selectedVal === val ? 'active' : ''}"
              data-opt-name="${opt.name}" data-opt-val="${val}">${val}</button>
          `
        )
        .join('');
      return `
        <div>
          <span class="option-group-label">${opt.name}:</span>
          <div class="option-pills-wrap">${btns}</div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.option-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.optName;
      const val = btn.dataset.optVal;
      state.optionModalSelectedOptions[name] = val;
      renderOptionModalGroups(product);
      syncOptionModalFooter(product);
    });
  });
}

function syncOptionModalFooter(product) {
  const priceEl = document.getElementById('optionsModalPrice');
  const confirmBtn = document.getElementById('confirmOptionAddBtn');
  const cfg = getProductVariantConfig(product, state.optionModalSelectedOptions, state.optionModalSelectedImageIndex);

  if (priceEl) priceEl.textContent = formatPrice(cfg.unitPrice);
  if (confirmBtn) {
    confirmBtn.disabled = cfg.imageSoldOut;
    confirmBtn.textContent = cfg.imageSoldOut ? 'هذا الخيار غير متاح' : 'تأكيد وإضافة للسلة';
  }
}

/* ---------- Product Preview Modal ---------- */

function openProductPreview(productId) {
  const product = getProductById(productId);
  const modal = document.getElementById('productPreviewModal');
  if (!product || !modal) return;

  state.previewProductId = product.id;
  state.previewSelectedImageIndex = state.cardImageIndices[product.id] || 0;
  state.previewSelectedOptions = {};

  (product.options || []).forEach((opt) => {
    if (Array.isArray(opt.values) && opt.values.length) {
      state.previewSelectedOptions[opt.name] = opt.values[0];
    }
  });

  document.getElementById('previewMerchantBadge').textContent = product.merchantName;
  document.getElementById('previewCategoryBadge').textContent = product.category;
  document.getElementById('previewTitle').textContent = product.title;
  document.getElementById('previewDesc').textContent = product.description || 'منتج متوفر لدى كارامل ستور في السويس.';

  renderPreviewOptions(product);
  syncPreviewGalleryUI(product);

  openOverlayElement(modal, 'modal', 'productPreviewModal');
}

function renderPreviewOptions(product) {
  const area = document.getElementById('previewOptionsArea');
  if (!area) return;

  if (!Array.isArray(product.options) || !product.options.length) {
    area.innerHTML = '';
    return;
  }

  area.innerHTML = product.options
    .map((opt) => {
      const activeVal = state.previewSelectedOptions[opt.name];
      const pills = (opt.values || [])
        .map(
          (val) => `<button type="button" class="option-pill-btn ${activeVal === val ? 'active' : ''}" data-p-opt="${opt.name}" data-p-val="${val}">${val}</button>`
        )
        .join('');
      return `
        <div>
          <span class="option-group-label">${opt.name}:</span>
          <div class="option-pills-wrap">${pills}</div>
        </div>
      `;
    })
    .join('');

  area.querySelectorAll('.option-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.previewSelectedOptions[btn.dataset.pOpt] = btn.dataset.pVal;
      renderPreviewOptions(product);
      syncPreviewGalleryUI(product);
    });
  });
}

function syncPreviewGalleryUI(product) {
  const images = product.images.length ? product.images : ['compressed_1795766509611.jpeg'];
  const idx = Math.max(0, Math.min(state.previewSelectedImageIndex, images.length - 1));
  const currentImg = images[idx];
  const cfg = getProductVariantConfig(product, state.previewSelectedOptions, idx);

  const mainImg = document.getElementById('previewMainImage');
  const soldBadge = document.getElementById('previewSoldOutBadge');
  const priceEl = document.getElementById('previewPrice');
  const addBtn = document.getElementById('previewAddToCartBtn');
  const thumbsEl = document.getElementById('previewThumbs');

  if (mainImg) {
    mainImg.src = currentImg;
    mainImg.alt = product.title;
  }
  syncSoldOutOverlayOnElement(soldBadge, cfg.imageSoldOut);
  if (priceEl) priceEl.textContent = formatPrice(cfg.unitPrice);

  if (addBtn) {
    addBtn.disabled = cfg.imageSoldOut;
    addBtn.textContent = cfg.imageSoldOut ? 'غير متاح حالياً' : 'أضف إلى السلة 🛒';
  }

  if (thumbsEl) {
    thumbsEl.innerHTML = images
      .map((src, tIdx) => {
        const soldOut = isProductImageSoldOut(product, src);
        return `
          <div class="preview-thumb-wrap ${tIdx === idx ? 'active' : ''}" data-thumb-idx="${tIdx}">
            <img src="${src}" alt="" class="preview-thumb-img" onerror="this.src='compressed_1795766509611.jpeg'" />
            ${soldOut ? '<span class="preview-thumb-soldout">نفد</span>' : ''}
          </div>
        `;
      })
      .join('');

    thumbsEl.querySelectorAll('[data-thumb-idx]').forEach((el) => {
      el.addEventListener('click', () => {
        state.previewSelectedImageIndex = Number(el.dataset.thumbIdx) || 0;
        syncPreviewGalleryUI(product);
      });
    });
  }
}

/* ---------- Cart Drawer & Checkout ---------- */

function updateCartHeaderUI() {
  const totalQty = state.cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);

  const countEl = document.getElementById('cartCount');
  const miniTotalEl = document.getElementById('cartMiniTotal');
  if (countEl) countEl.textContent = String(totalQty);
  if (miniTotalEl) miniTotalEl.textContent = formatPrice(subtotal);
}

function renderCartDrawer() {
  const listEl = document.getElementById('cartItemsList');
  const qtyEl = document.getElementById('cartTotalQty');
  const subtotalEl = document.getElementById('cartSubtotalPrice');
  if (!listEl) return;

  populateCustomerForm();

  if (!state.cart.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <h3>السلة فارغة</h3>
        <p>أضف المنتجات التي تعجبك ثم أرسل طلبك عبر واتساب.</p>
      </div>
    `;
    if (qtyEl) qtyEl.textContent = '0';
    if (subtotalEl) subtotalEl.textContent = formatPrice(0);
    return;
  }

  listEl.innerHTML = state.cart
    .map(
      (item, idx) => `
        <div class="cart-item-card">
          <img src="${item.image}" alt="${item.title}" class="cart-item-img" onerror="this.src='compressed_1795766509611.jpeg'" />
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.title}</h4>
            <div class="cart-item-variant">${item.merchantName}${item.variantLabel ? ` • ${item.variantLabel}` : ''}</div>
            <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
          </div>
          <div class="qty-stepper">
            <button type="button" class="qty-btn" data-cart-dec="${idx}" aria-label="تقليل الكمية">−</button>
            <span class="qty-val">${item.qty}</span>
            <button type="button" class="qty-btn" data-cart-inc="${idx}" aria-label="زيادة الكمية">+</button>
          </div>
        </div>
      `
    )
    .join('');

  listEl.querySelectorAll('[data-cart-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.cartInc);
      if (state.cart[idx]) {
        state.cart[idx].qty += 1;
        saveCart();
        renderCartDrawer();
      }
    });
  });

  listEl.querySelectorAll('[data-cart-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.cartDec);
      if (!state.cart[idx]) return;
      if (state.cart[idx].qty > 1) {
        state.cart[idx].qty -= 1;
      } else {
        state.cart.splice(idx, 1);
      }
      saveCart();
      renderCartDrawer();
    });
  });

  const totalQty = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (qtyEl) qtyEl.textContent = String(totalQty);
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
}

function buildWhatsappOrderMessage(order) {
  const lines = [
    `*طلب جديد من كارامل ستور (Caramel Store)*`,
    `رقم الطلب: *${order.id}*`,
    `الاسم: ${order.customer.name}`,
    `الموبايل: ${order.customer.phone}`,
    `العنوان في السويس: ${order.customer.address}`,
    `---------------------------`,
    `*المنتجات:*`
  ];

  order.items.forEach((item, i) => {
    const variantPart = item.variantLabel ? ` (${item.variantLabel})` : '';
    lines.push(`${i + 1}. ${item.title}${variantPart} — *${item.merchantName}* × ${item.qty} = ${formatPrice(item.price * item.qty)}`);
  });

  lines.push(`---------------------------`);
  lines.push(`*الإجمالي: ${formatPrice(order.total)}*`);
  if (order.customer.notes) {
    lines.push(`ملاحظات: ${order.customer.notes}`);
  }

  return lines.join('\n');
}

function checkoutViaWhatsapp() {
  saveCustomerForm();
  if (!state.cart.length) {
    showToast('السلة فارغة، أضف منتجات أولاً');
    return;
  }

  const { name, phone, address } = state.customer;
  if (!name || !phone || !address) {
    showToast('يرجى إدخال الاسم ورقم الموبايل والعنوان في السويس');
    return;
  }

  const total = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const orderCode = `CRM-${Math.floor(100 + Math.random() * 900)}`;
  const newOrder = {
    id: orderCode,
    status: 'active',
    createdAt: new Date().toLocaleString('ar-EG'),
    customer: { ...state.customer },
    items: state.cart.map((c) => ({ ...c })),
    total
  };

  state.orders.unshift(newOrder);
  saveOrders();

  const msg = buildWhatsappOrderMessage(newOrder);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

  state.cart = [];
  saveCart();
  renderCartDrawer();
  renderOrdersDrawer();

  window.open(url, '_blank', 'noopener,noreferrer');
  showToast(`تم تسجيل الطلب ${orderCode} وجاري فتح واتساب`);
}

/* ---------- Orders Drawer ---------- */

function updateOrdersBadgeUI() {
  const activeOrders = state.orders.filter((o) => o.status !== 'delivered');
  const deliveredOrders = state.orders.filter((o) => o.status === 'delivered');

  const badge = document.getElementById('activeOrdersBadge');
  if (badge) {
    badge.textContent = String(activeOrders.length);
    badge.classList.toggle('hidden', activeOrders.length === 0);
  }

  const tabActive = document.getElementById('tabCountActive');
  const tabDelivered = document.getElementById('tabCountDelivered');
  if (tabActive) tabActive.textContent = String(activeOrders.length);
  if (tabDelivered) tabDelivered.textContent = String(deliveredOrders.length);
}

function renderOrdersDrawer() {
  const container = document.getElementById('ordersListContainer');
  if (!container) return;
  updateOrdersBadgeUI();

  const list = state.orders.filter((o) =>
    state.activeOrderTab === 'delivered' ? o.status === 'delivered' : o.status !== 'delivered'
  );

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>لا توجد طلبات هنا</h3>
        <p>${state.activeOrderTab === 'delivered' ? 'لم يتم تأكيد استلام أي طلب بعد.' : 'لا توجد طلبات قيد التنفيذ حالياً.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map((order) => {
      const itemsSummary = (order.items || [])
        .map((i) => `${i.title} (${i.qty})`)
        .join('، ');
      return `
        <div class="order-card" data-order-id="${order.id}">
          <div class="order-card-head">
            <span>طلب #${order.id}</span>
            <span>${formatPrice(order.total)}</span>
          </div>
          <div class="order-items-mini">${itemsSummary}</div>
          <div class="order-items-mini">${order.createdAt || ''}</div>
          <div class="order-card-actions">
            <button type="button" class="small-action-btn" data-resend-order="${order.id}">إرسال لواتساب</button>
            ${
              order.status !== 'delivered'
                ? `<button type="button" class="small-action-btn primary" data-mark-delivered="${order.id}">تأكيد الاستلام</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-resend-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const order = state.orders.find((o) => o.id === btn.dataset.resendOrder);
      if (!order) return;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsappOrderMessage(order))}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  });

  container.querySelectorAll('[data-mark-delivered]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const order = state.orders.find((o) => o.id === btn.dataset.markDelivered);
      if (!order) return;
      order.status = 'delivered';
      saveOrders();
      renderOrdersDrawer();
      showToast(`تم نقل الطلب #${order.id} إلى المستلمة`);
    });
  });
}

/* ---------- Confirm Modal & Notifications ---------- */

function openConfirmDialog(title, desc, onConfirm) {
  const modal = document.getElementById('confirmActionModal');
  if (!modal) return;
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalDesc').textContent = desc;
  state.pendingConfirmCallback = onConfirm;
  openOverlayElement(modal, 'modal', 'confirmActionModal');
}

function renderNotificationsModal() {
  const listEl = document.getElementById('notificationsList');
  const dot = document.getElementById('notifBadge');
  if (dot) dot.classList.add('hidden');
  if (!listEl) return;

  listEl.innerHTML = state.notifications
    .map(
      (n) => `
        <div class="notif-item">
          <strong>${n.title}</strong>
          <p style="margin:4px 0;color:var(--text-muted);">${n.body}</p>
          <small style="color:var(--text-soft);">${n.date || ''}</small>
        </div>
      `
    )
    .join('');
}

/* ---------- Event Listeners & Initialization ---------- */

function bindEvents() {
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

  document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
    resetAllFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  searchInput?.addEventListener('input', () => {
    state.searchQuery = searchInput.value || '';
    clearSearchBtn?.classList.toggle('hidden', !state.searchQuery.trim());
    renderProductsGrid();
    renderFilterBanner();
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderProductsGrid();
    renderFilterBanner();
  });

  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderProductsGrid();
  });

  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetAllFilters);
  document.getElementById('clearActiveFilterBtn')?.addEventListener('click', resetAllFilters);
  document.getElementById('emptyResetBtn')?.addEventListener('click', resetAllFilters);

  document.getElementById('customOrderWhatsappBtn')?.addEventListener('click', () => {
    const text = 'مرحباً كارامل ستور، أرغب في طلب أوردر خاص / منتج من شي إن في السويس.';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  });

  // Cart Drawer
  document.getElementById('openCartBtn')?.addEventListener('click', () => {
    renderCartDrawer();
    openOverlayElement(document.getElementById('cartDrawer'), 'drawer', 'cartDrawer');
  });

  document.getElementById('checkoutWhatsappBtn')?.addEventListener('click', checkoutViaWhatsapp);

  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    if (!state.cart.length) return;
    openConfirmDialog('تفريغ السلة', 'هل تريد حذف جميع المنتجات من السلة الحالية؟', () => {
      state.cart = [];
      saveCart();
      renderCartDrawer();
      showToast('تم تفريغ السلة');
    });
  });

  ['customerNameInput', 'customerPhoneInput', 'customerAddressInput', 'customerNotesInput'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', saveCustomerForm);
  });

  // Orders Drawer
  document.getElementById('ordersHistoryBtn')?.addEventListener('click', () => {
    renderOrdersDrawer();
    openOverlayElement(document.getElementById('ordersDrawer'), 'drawer', 'ordersDrawer');
  });

  document.querySelectorAll('.orders-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.orders-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeOrderTab = tab.dataset.orderTab || 'active';
      renderOrdersDrawer();
    });
  });

  // Notifications
  document.getElementById('notifyBellBtn')?.addEventListener('click', () => {
    renderNotificationsModal();
    openOverlayElement(document.getElementById('notificationsModal'), 'modal', 'notificationsModal');
  });

  // Options Modal Confirm
  document.getElementById('confirmOptionAddBtn')?.addEventListener('click', () => {
    const product = getProductById(state.optionModalProductId);
    if (!product) return;
    const added = addConfiguredProductToCart(
      product,
      state.optionModalSelectedOptions,
      state.optionModalSelectedImageIndex,
      1
    );
    if (added) {
      closeOverlayElement(document.getElementById('optionsModal'));
    }
  });

  // Preview Modal Add & Share
  document.getElementById('previewAddToCartBtn')?.addEventListener('click', () => {
    const product = getProductById(state.previewProductId);
    if (!product) return;
    const added = addConfiguredProductToCart(
      product,
      state.previewSelectedOptions,
      state.previewSelectedImageIndex,
      1
    );
    if (added) {
      closeOverlayElement(document.getElementById('productPreviewModal'));
    }
  });

  document.getElementById('previewShareBtn')?.addEventListener('click', async () => {
    const product = getProductById(state.previewProductId);
    if (!product) return;
    const shareText = `${product.title} — ${formatPrice(product.price)} من كارامل ستور`;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, text: shareText, url: window.location.href });
        return;
      } catch (_) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(`${shareText} (${window.location.href})`);
        showToast('تم نسخ رابط المنتج');
      } catch (_) {}
    }
  });

  // Confirm Dialog Buttons
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => {
    state.pendingConfirmCallback = null;
    closeOverlayElement(document.getElementById('confirmActionModal'));
  });

  document.getElementById('confirmOkBtn')?.addEventListener('click', () => {
    const cb = state.pendingConfirmCallback;
    state.pendingConfirmCallback = null;
    closeOverlayElement(document.getElementById('confirmActionModal'));
    if (typeof cb === 'function') cb();
  });

  // Close Buttons & Backdrop Clicks
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeOverlayElement(document.getElementById(btn.dataset.closeModal));
    });
  });

  document.querySelectorAll('[data-close-drawer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeOverlayElement(document.getElementById(btn.dataset.closeDrawer));
    });
  });

  document.querySelectorAll('.modal-backdrop, .drawer-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeOverlayElement(backdrop);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.overlayStack.length) {
      const top = state.overlayStack[state.overlayStack.length - 1];
      if (top && top.el) closeOverlayElement(top.el);
    }
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
    });
  }
}

async function initApp() {
  loadPersistentData();
  bindEvents();
  runSplashScreen();
  updateCartHeaderUI();
  updateOrdersBadgeUI();

  const dot = document.getElementById('notifBadge');
  if (dot && state.notifications.length > 0) {
    dot.classList.remove('hidden');
  }

  await loadAllStoreData();
  renderAllViews();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', initApp);
