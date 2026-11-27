const WHATSAPP_NUMBER = "201055436305";
const STORE_URL = "https://caramelstoresuez.github.io/Carmelastore/";
const BRAND_LOGO_URL = "./compressed_1795766509611.jpeg?v=5";
const APP_BUILD_VERSION = "v20261127-13";
const APPLIED_BUILD_KEY = "caramel_applied_build_version_v1";
const CART_STORAGE_KEY = "caramel_store_cart_v1";
const WISHLIST_STORAGE_KEY = "caramel_wishlist_v1";
const ACTIVE_ORDERS_STORAGE_KEY = "caramel_active_orders_v1";
const RECEIVED_ORDERS_STORAGE_KEY = "caramel_received_orders_v1";
const INTEREST_STORAGE_KEY = "caramel_smart_interest_v1";
const THEME_STORAGE_KEY = "caramel_store_theme_mode_v1";
const CUSTOMER_PROFILE_KEY = "caramel_customer_profile_v1";
const SEARCH_HISTORY_KEY = "caramel_search_history_v1";
const BATCH_SIZE = 12;
const FULL_MODE_INITIAL_BATCH = 24;
const CONTINUATION_STEP = 8;

const GITHUB_MERCHANTS_CONFIG = {
  owner: "Caramelstoresuez",
  repo: "Carmelastore",
  branch: "main",
  folder: "merchants"
};

const KNOWN_MERCHANT_SLUGS = {
  "mohamed-ghareeb": "محمد غريب",
  "shireen-ghareeb": "شيرين غريب",
  "umm-ammar": "أم عمار",
  "umm-waleed": "أم وليد",
  "products": "متجر كارامل",
  "catalog": "متجر كارامل",
  "store": "متجر كارامل"
};

const FALLBACK_MERCHANT_FILES = [
  "merchants/mohamed-ghareeb.json",
  "merchants/shireen-ghareeb.json",
  "merchants/umm-ammar.json",
  "merchants/umm-waleed.json",
  "products.json",
  "data/products.json"
];

const CATEGORY_NAMES = {
  all: "الكل",
  home: "المنزل",
  appliances: "الأدوات الكهربائية",
  phones: "الهواتف والإكسسوارات",
  jewelry: "مجوهرات وإكسسوارات",
  perfume: "الجمال والصحة",
  school: "اللوازم المكتبية والمدرسة",
  gifts: "الهدايا",
  tafse: "هاند ميد",
  women: "النساء",
  men: "الرجال",
  kids: "الأطفال"
};

const CATEGORY_SUBTITLES = {
  all: "تشكيلة المتجر بالكامل",
  home: "تنظيم، مطبخ، ومفروشات",
  appliances: "أجهزة وأدوات كهربائية منزلية",
  phones: "هواتف، شواحن، وسماعات",
  jewelry: "إكسسوارات، سلاسل، وخواتم",
  perfume: "عطور، عناية شخصية، وصحة",
  school: "كشاكيل، أقلام، وأدوات دراسة",
  gifts: "هدايا مخصصة وذكريات",
  tafse: "شغل يدوي ومكرميات",
  women: "أزياء وعناية نسائية",
  men: "اختيارات عملية للرجال",
  kids: "مستلزمات وتفاصيل للأطفال"
};

const CATEGORY_THEME_META = {
  all: { bar: "#e5be96", bg: "rgba(200, 150, 102, 0.18)", stroke: "#c89666" },
  home: { bar: "#d4a373", bg: "#faefe3", stroke: "#996738" },
  appliances: { bar: "#38bdf8", bg: "#e0f2fe", stroke: "#0284c7" },
  phones: { bar: "#818cf8", bg: "#e0e7ff", stroke: "#4338ca" },
  jewelry: { bar: "#fb7185", bg: "#ffe4e6", stroke: "#be123c" },
  perfume: { bar: "#60a5fa", bg: "#dbeafe", stroke: "#1d4ed8" },
  school: { bar: "#0ea5e9", bg: "#e0f2fe", stroke: "#0369a1" },
  gifts: { bar: "#f472b6", bg: "#fce7f3", stroke: "#be185d" },
  tafse: { bar: "#84a98c", bg: "#e8f0ea", stroke: "#354f52" },
  women: { bar: "#fbbf24", bg: "#fef3c7", stroke: "#b45309" },
  men: { bar: "#94a3b8", bg: "#e2e8f0", stroke: "#1e293b" },
  kids: { bar: "#22d3ee", bg: "#cffafe", stroke: "#0e7490" }
};

const PRODUCTS = [];
let deferredInstallPrompt = null;
let pendingUpdateAvailable = false;
let toastTimer = null;
let isAppendingBatch = false;
let currentFeedMode = "for-you";
let currentSortMode = "smart";
let onlyFavoritesMode = false;
let isLoadingJsonProducts = true;
let currentCategory = "all";
let currentMerchant = "";
let currentMaxPrice = 0;
let appendTargetOrderId = null;
let activeCartOrdersTab = "cart";
let expandedOrderIds = new Set();
let pendingConfirmAction = null;
let pendingConfirmCancelAction = null;
let pendingOptionSelection = {
  productId: null,
  clickedBtnId: null,
  selectedSize: "",
  selectedColor: "",
  selectedImg: "",
  currentPrice: 0,
  qty: 1
};
let trendSlideList = [];
let dealSlideList = [];
let trendSlideIdx = 0;
let dealSlideIdx = 0;
let pausedMotionKind = { trends: false, deals: false };
let autoHoverSlideTimer = null;
let activeHoveredCard = null;
let previewModalState = { productId: null, imgs: [], idx: 0 };
let feedObserver = null;
let globalEventsBound = false;
let overlayStack = [];
let suppressHistoryStep = false;

let wishlistIds = loadJsonArray(WISHLIST_STORAGE_KEY).map(String);
let cart = loadJsonArray(CART_STORAGE_KEY);
let activeOrders = loadJsonArray(ACTIVE_ORDERS_STORAGE_KEY);
let receivedOrders = loadJsonArray(RECEIVED_ORDERS_STORAGE_KEY);

function loadJsonArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveCart() {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch (e) {}
}
function saveWishlist() {
  try { localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds)); } catch (e) {}
}
function saveActiveOrders() {
  try { localStorage.setItem(ACTIVE_ORDERS_STORAGE_KEY, JSON.stringify(activeOrders)); } catch (e) {}
}
function saveReceivedOrders() {
  try { localStorage.setItem(RECEIVED_ORDERS_STORAGE_KEY, JSON.stringify(receivedOrders)); } catch (e) {}
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeHtmlAttr(str) {
  return escapeHtml(str);
}

function normalizeArabicDigits(str) {
  return String(str || "")
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
}

function normalizeText(str) {
  return normalizeArabicDigits(String(str || ""))
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\u0621-\u064Aa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericPrice(rawPrice) {
  if (typeof rawPrice === "number" && !Number.isNaN(rawPrice)) return rawPrice;
  const cleaned = normalizeArabicDigits(String(rawPrice || "")).replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function formatPriceNumber(priceOrLabel) {
  if (typeof priceOrLabel === "string" && /[a-zA-Z؀-ۿ]/.test(priceOrLabel)) {
    return priceOrLabel.trim();
  }
  return (Number(priceOrLabel) || 0).toLocaleString("ar-EG");
}

function normalizeProductImageUrl(rawImg) {
  if (!rawImg || typeof rawImg !== "string") return "";
  let cleaned = rawImg.trim().replace(/\\/g, "/");
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith("data:") || cleaned.startsWith("blob:")) {
    return cleaned;
  }
  cleaned = cleaned.replace(/^\.\//, "").replace(/^\/+/, "");
  try { cleaned = decodeURI(cleaned); } catch (e) {}
  return encodeURI(cleaned);
}

function getProductImagesList(product) {
  if (!product) return [];
  const list = [];
  if (Array.isArray(product.images)) list.push(...product.images);
  if (product.img) list.unshift(product.img);
  return Array.from(new Set(list.map(normalizeProductImageUrl).filter(Boolean)));
}

function getActiveCardImageSrc(cardEl, product) {
  const imgs = getProductImagesList(product);
  if (cardEl) {
    const imgEl = cardEl.querySelector(".product-img-box img");
    const idxAttr = imgEl?.getAttribute("data-img-idx");
    if (idxAttr !== null && imgs.length) {
      const idx = Number(idxAttr);
      if (!Number.isNaN(idx) && imgs[idx]) return imgs[idx];
    }
    const domSrc = imgEl?.getAttribute("src") || "";
    if (domSrc && imgEl?.getAttribute("data-broken") !== "1") {
      return normalizeProductImageUrl(domSrc);
    }
  }
  return imgs[0] || "";
}

function buildWhatsAppDeepLink(url) {
  try {
    const parsed = new URL(url);
    const phone = (parsed.pathname.replace(/^\/+/, "") || parsed.searchParams.get("phone") || WHATSAPP_NUMBER).replace(/\D/g, "");
    const text = parsed.searchParams.get("text") || "";
    const params = new URLSearchParams();
    if (phone) params.set("phone", phone);
    if (text) params.set("text", text);
    const apiUrl = `https://api.whatsapp.com/send?${params.toString()}`;
    const schemeUrl = `whatsapp://send?${params.toString()}`;
    const intentUrl = `intent://send${params.toString() ? `?${params.toString()}` : ""}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(apiUrl)};end`;
    return { apiUrl, schemeUrl, intentUrl };
  } catch (e) {
    return { apiUrl: url, schemeUrl: url, intentUrl: url };
  }
}

function launchWhatsAppTarget(url) {
  const { schemeUrl, intentUrl, apiUrl } = buildWhatsAppDeepLink(url);
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  let switchedAway = false;
  let fallbackDone = false;

  const onVis = () => {
    if (document.hidden) {
      switchedAway = true;
      document.removeEventListener("visibilitychange", onVis);
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const fallback = () => {
    if (fallbackDone || switchedAway || document.visibilityState !== "visible") return;
    fallbackDone = true;
    if (isAndroid && intentUrl) {
      window.location.href = intentUrl;
      return;
    }
    if (isIOS) {
      window.location.href = schemeUrl;
      return;
    }
    const win = window.open(apiUrl, "_blank", "noopener,noreferrer");
    if (!win) window.location.href = apiUrl;
  };

  try {
    if (isAndroid && intentUrl) window.location.href = intentUrl;
    else window.location.href = schemeUrl;
  } catch (e) {}

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVis);
    fallback();
  }, 1300);
}

function buildProductWhatsAppUrl(product, activeImgSrc = "") {
  if (!product) return `https://wa.me/${WHATSAPP_NUMBER}`;
  const price = product.priceLabel || product.price;
  const merchant = product.merchant || "متجر كارامل";
  const imgs = getProductImagesList(product);
  const chosen = normalizeProductImageUrl(activeImgSrc) || (imgs[0] || "");
  const idx = chosen && imgs.length ? imgs.indexOf(chosen) : -1;
  const imgInfo = chosen ? ` — الصورة المختارة${idx >= 0 && imgs.length > 1 ? ` (${idx + 1}/${imgs.length})` : ""}: ${chosen}` : "";
  const text = encodeURIComponent(`أريد طلب ${product.title} بسعر ${price} جنيه (التاجر: ${merchant})${imgInfo} من متجر كارامل`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

function showCaramelToast(msg) {
  const el = document.getElementById("caramelToast");
  if (!el || !msg) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function syncHeaderStickyOffsets() {
  const header = document.querySelector(".top-app-bar");
  if (!header) return;
  const h = Math.round(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--header-offset", `${h}px`);
  document.querySelectorAll(".section-heading").forEach(el => {
    el.style.scrollMarginTop = `${h + 62}px`;
  });
}

function initThemeMode() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark") {
      document.body.classList.add("dark-theme");
      document.documentElement.classList.add("boot-dark-root");
    } else {
      document.documentElement.classList.remove("boot-dark-root");
    }
  } catch (e) {}
  syncThemeIcon();
}

function syncThemeIcon() {
  const isDark = document.body.classList.contains("dark-theme");
  const svg = document.getElementById("themeIconSvg");
  if (!svg) return;
  svg.innerHTML = isDark
    ? `<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l1.41 1.41M19.07 4.93l1.41 1.41"></path>`
    : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
}

function toggleThemeMode() {
  const isDark = document.body.classList.toggle("dark-theme");
  document.documentElement.classList.toggle("boot-dark-root", isDark);
  try { localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light"); } catch (e) {}
  syncThemeIcon();
  renderSideCategoriesList();
  showCaramelToast(isDark ? "تم تفعيل المظهر الليلي" : "تم تفعيل المظهر النهاري");
}

function syncBodyScrollLock() {
  const open = Boolean(
    document.getElementById("imageModal")?.classList.contains("open") ||
    document.getElementById("productOptionModal")?.classList.contains("open") ||
    document.getElementById("serviceInfoModal")?.classList.contains("open") ||
    document.getElementById("confirmActionModal")?.classList.contains("open") ||
    document.getElementById("becomeMerchantModal")?.classList.contains("open") ||
    document.getElementById("cartDrawer")?.classList.contains("open") ||
    document.getElementById("catsDrawer")?.classList.contains("open")
  );
  document.body.style.overflow = open ? "hidden" : "";
}

function pushOverlayState(kind) {
  if (suppressHistoryStep) return;
  overlayStack.push(kind);
  try { history.pushState({ caramelOverlay: kind }, "", window.location.href); } catch (e) {}
}

function removeOverlayState(kind) {
  const idx = overlayStack.lastIndexOf(kind);
  if (idx !== -1) overlayStack.splice(idx, 1);
  if (suppressHistoryStep) return;
  try {
    if (history.state && history.state.caramelOverlay) {
      suppressHistoryStep = true;
      history.back();
      setTimeout(() => { suppressHistoryStep = false; }, 60);
    }
  } catch (e) { suppressHistoryStep = false; }
}

function closeTopOverlay(fromPop = false) {
  const top = overlayStack.pop();
  if (!top) return;
  if (top === "imageModal") closeImageModal(fromPop);
  else if (top === "optionModal") closeProductOptionModal(fromPop);
  else if (top === "serviceInfo") closeServiceInfoModal(fromPop);
  else if (top === "confirm") closeConfirmModal(fromPop, true);
  else if (top === "becomeMerchant") closeBecomeMerchantModal(fromPop);
  else if (top === "cartDrawer") closeCart(fromPop);
  else if (top === "catsDrawer") closeCategoriesDrawer(fromPop);
}

function closeAllOverlays() {
  while (overlayStack.length > 0) closeTopOverlay(false);
  closeImageModal(true);
  closeProductOptionModal(true);
  closeServiceInfoModal(true);
  closeConfirmModal(true, false);
  closeBecomeMerchantModal(true);
  closeCart(true);
  closeCategoriesDrawer(true);
}

function isAnyOverlayCurrentlyOpen() {
  return Boolean(
    document.getElementById("imageModal")?.classList.contains("open") ||
    document.getElementById("productOptionModal")?.classList.contains("open") ||
    document.getElementById("serviceInfoModal")?.classList.contains("open") ||
    document.getElementById("confirmActionModal")?.classList.contains("open") ||
    document.getElementById("becomeMerchantModal")?.classList.contains("open") ||
    document.getElementById("cartDrawer")?.classList.contains("open") ||
    document.getElementById("catsDrawer")?.classList.contains("open")
  );
}

function openConfirmModal(title, msg, onConfirm, label = "تأكيد", onCancel = null) {
  const m = document.getElementById("confirmActionModal");
  if (!m) {
    if (window.confirm(msg) && typeof onConfirm === "function") onConfirm();
    return;
  }
  document.getElementById("confirmModalTitle").textContent = title || "تأكيد العملية";
  document.getElementById("confirmModalMessage").textContent = msg || "";
  document.getElementById("confirmModalOkBtn").textContent = label;
  pendingConfirmAction = onConfirm;
  pendingConfirmCancelAction = onCancel;
  m.classList.add("open");
  syncBodyScrollLock();
  pushOverlayState("confirm");
}

function closeConfirmModal(fromPop = false, invokeCancel = false) {
  const m = document.getElementById("confirmActionModal");
  if (m) m.classList.remove("open");
  const cancelFn = pendingConfirmCancelAction;
  pendingConfirmAction = null;
  pendingConfirmCancelAction = null;
  syncBodyScrollLock();
  if (!fromPop) removeOverlayState("confirm");
  if (invokeCancel && typeof cancelFn === "function") cancelFn();
}

function executeConfirmedAction() {
  const fn = pendingConfirmAction;
  pendingConfirmAction = null;
  pendingConfirmCancelAction = null;
  closeConfirmModal(false, false);
  if (typeof fn === "function") fn();
}

function openServiceInfoModal(type) {
  const m = document.getElementById("serviceInfoModal");
  const titleEl = document.getElementById("serviceInfoModalTitle");
  const bodyEl = document.getElementById("serviceInfoModalBody");
  if (!m || !titleEl || !bodyEl) return;
  if (type === "payment") {
    titleEl.textContent = "طرق الدفع في متجر كارامل";
    bodyEl.innerHTML = `<div class="service-info-item"><strong>السويس:</strong> الدفع عند الاستلام.</div><div class="service-info-item"><strong>المحافظات الأخرى:</strong> الدفع إنستا باي أو فوري أو كاش.</div>`;
  } else if (type === "delivery") {
    titleEl.textContent = "مواعيد التوصيل";
    bodyEl.innerHTML = `<div class="service-info-item"><strong>التوصيل:</strong> التوصيل خلال يوم عمل.</div>`;
  } else {
    titleEl.textContent = "سياسة الاسترجاع";
    bodyEl.innerHTML = `<div class="service-info-item"><strong>سياسة الاسترجاع:</strong> خلال أسبوع لو المنتج تالف / به عيوب / أو غير الوصف.</div>`;
  }
  m.classList.add("open");
  syncBodyScrollLock();
  pushOverlayState("serviceInfo");
}

function closeServiceInfoModal(fromPop = false) {
  const m = document.getElementById("serviceInfoModal");
  if (m) m.classList.remove("open");
  syncBodyScrollLock();
  if (!fromPop) removeOverlayState("serviceInfo");
}

function openBecomeMerchantModal() {
  const m = document.getElementById("becomeMerchantModal");
  if (!m) return;
  m.classList.add("open");
  syncBodyScrollLock();
  pushOverlayState("becomeMerchant");
  setTimeout(() => document.getElementById("merchantRegName")?.focus(), 60);
}

function closeBecomeMerchantModal(fromPop = false) {
  const m = document.getElementById("becomeMerchantModal");
  if (m) m.classList.remove("open");
  syncBodyScrollLock();
  if (!fromPop) removeOverlayState("becomeMerchant");
}

function submitBecomeMerchantForm(e) {
  if (e) e.preventDefault();
  const name = (document.getElementById("merchantRegName")?.value || "").trim();
  const activity = (document.getElementById("merchantRegActivity")?.value || "").trim();
  const phone = (document.getElementById("merchantRegPhone")?.value || "").trim();
  if (!name || !activity || !phone) {
    showCaramelToast("يرجى إدخال الاسم والنشاط ورقم التواصل");
    return;
  }
  const msg = ["طلب انضمام كتاجر جديد في متجر كارامل", "--------------------", `الاسم: ${name}`, `النشاط: ${activity}`, `رقم التواصل: ${phone}`].join("\n");
  closeBecomeMerchantModal();
  document.getElementById("becomeMerchantForm")?.reset();
  launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function openCategoriesDrawer() {
  renderSideCategoriesList();
  document.getElementById("catsDrawer")?.classList.add("open");
  document.getElementById("catsBackdrop")?.classList.add("open");
  syncBodyScrollLock();
  pushOverlayState("catsDrawer");
}

function closeCategoriesDrawer(fromPop = false) {
  document.getElementById("catsDrawer")?.classList.remove("open");
  document.getElementById("catsBackdrop")?.classList.remove("open");
  syncBodyScrollLock();
  if (!fromPop) removeOverlayState("catsDrawer");
}

function renderSideCategoriesList() {
  const container = document.getElementById("sideCategoriesList");
  if (!container) return;
  const isDark = document.body.classList.contains("dark-theme");
  const cats = ["all", ...Object.keys(CATEGORY_NAMES).filter(k => k !== "all")];
  container.innerHTML = cats.map(key => {
    const meta = CATEGORY_THEME_META[key] || CATEGORY_THEME_META.all;
    const isAct = currentCategory === key;
    const stroke = isDark ? meta.bar : meta.stroke;
    const bg = isDark ? "rgba(255,255,255,0.08)" : meta.bg;
    return `<button type="button" class="clean-cat-tile ${isAct ? "active" : ""}" onclick="closeCategoriesDrawer(); selectTopQuickTab('${key}', null);"><div class="clean-cat-top-row"><span class="clean-cat-icon-badge" style="background:${bg};color:${stroke};">●</span><span class="clean-cat-label">${CATEGORY_NAMES[key]}</span></div><span class="clean-cat-desc">${CATEGORY_SUBTITLES[key] || ""}</span></button>`;
  }).join("");
}

function toggleHeaderSearchBar(forceOpen = null) {
  const wrap = document.getElementById("collapsibleSearchWrap");
  const btn = document.getElementById("headerSearchToggleBtn");
  const input = document.getElementById("homeSearchInput");
  if (!wrap) return;
  const open = typeof forceOpen === "boolean" ? forceOpen : !wrap.classList.contains("open");
  wrap.classList.toggle("open", open);
  btn?.classList.toggle("active", open);
  renderSmartSearchSuggestions();
  setTimeout(syncHeaderStickyOffsets, 200);
  if (open && input) setTimeout(() => input.focus(), 60);
}

function openGlobalSearchBar() {
  closeAllOverlays();
  toggleHeaderSearchBar(true);
}

let searchDebounceTimer = null;
function handleSearchInput() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const val = (document.getElementById("homeSearchInput")?.value || "").trim();
    const cancelBtn = document.getElementById("searchCancelBtn");
    if (cancelBtn) cancelBtn.style.display = val ? "inline-block" : "none";
    renderProducts(currentCategory);
  }, 140);
}

function handleSearchKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    performSearchRender();
  } else if (e.key === "Escape") {
    cancelSearchMode();
  }
}

function performSearchRender() {
  const val = (document.getElementById("homeSearchInput")?.value || "").trim();
  if (val) {
    try {
      const prev = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]").filter(Boolean);
      const next = [val, ...prev.filter(x => normalizeText(x) !== normalizeText(val))].slice(0, 4);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch (e) {}
  }
  renderSmartSearchSuggestions();
  renderProducts(currentCategory);
}

function cancelSearchMode(e) {
  if (e) e.stopPropagation();
  const input = document.getElementById("homeSearchInput");
  const cancelBtn = document.getElementById("searchCancelBtn");
  if (input) input.value = "";
  if (cancelBtn) cancelBtn.style.display = "none";
  document.getElementById("searchResultsSummaryBar")?.classList.remove("visible");
  renderProducts(currentCategory);
}

function renderSmartSearchSuggestions() {
  const el = document.getElementById("smartSearchSuggestions");
  if (!el) return;
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]"); } catch (e) {}
  const defaults = ["لانش بوكس", "كشكول", "مقلمة", "زمزمية", "صلصال", "فوم"];
  const list = Array.from(new Set([...(Array.isArray(recent) ? recent : []), ...defaults])).slice(0, 6);
  el.innerHTML = list.map(w => `<button type="button" class="search-suggest-chip" onclick="applySearchSuggestion('${escapeHtmlAttr(w)}')">${escapeHtml(w)}</button>`).join("");
}

function applySearchSuggestion(word) {
  toggleHeaderSearchBar(true);
  const input = document.getElementById("homeSearchInput");
  if (input) {
    input.value = word;
    performSearchRender();
    scrollToProductsTop();
  }
}

function toggleProductFavorite(id, btn, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const sId = String(id || "");
  const idx = wishlistIds.indexOf(sId);
  let added = false;
  if (idx > -1) wishlistIds.splice(idx, 1);
  else { wishlistIds.unshift(sId); added = true; }
  saveWishlist();
  updateWishlistUI();
  document.querySelectorAll(`.fav-toggle-btn[data-fav-id="${CSS.escape(sId)}"]`).forEach(el => el.classList.toggle("active", added));
  if (onlyFavoritesMode && !added) renderProducts(currentCategory);
  showCaramelToast(added ? "تمت الإضافة إلى المفضلة ♥" : "تمت الإزالة من المفضلة");
}

function toggleFavoritesFilter() {
  if (!wishlistIds.length && !onlyFavoritesMode) {
    showCaramelToast("قائمة المفضلة فارغة حالياً");
    return;
  }
  onlyFavoritesMode = !onlyFavoritesMode;
  updateWishlistUI();
  renderProducts(currentCategory);
  if (onlyFavoritesMode) scrollToProductsTop();
}

function updateWishlistUI() {
  const badge = document.getElementById("headerFavCount");
  if (badge) {
    badge.textContent = String(wishlistIds.length);
    badge.classList.toggle("visible", wishlistIds.length > 0);
  }
  document.getElementById("headerFavFilterBtn")?.classList.toggle("active", onlyFavoritesMode);
}

function selectTopQuickTab(cat, btn) {
  currentCategory = cat || "all";
  currentMaxPrice = 0;
  onlyFavoritesMode = false;
  updateWishlistUI();
  document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
    el.classList.toggle("active", el === btn || el.getAttribute("data-quick") === currentCategory);
  });
  document.body.className = document.body.className.split(/\s+/).filter(c => c && !c.startsWith("cat-mode-")).concat(`cat-mode-${currentCategory}`).join(" ");
  renderProducts(currentCategory);
  scrollToProductsTop();
}

function setPriceFilter(maxP) {
  currentMaxPrice = Number(maxP) || 0;
  renderProducts(currentCategory);
  scrollToProductsTop();
}

function setSortMode(mode) {
  currentSortMode = mode || "smart";
  renderProducts(currentCategory);
}

function setFeedMode(mode, btn) {
  currentFeedMode = mode || "for-you";
  document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(b => {
    b.classList.toggle("active", b === btn || b.getAttribute("data-mode") === currentFeedMode);
  });
  renderProducts(currentCategory);
}

function resetHomeFresh() {
  closeAllOverlays();
  currentCategory = "all";
  currentMerchant = "";
  currentMaxPrice = 0;
  currentFeedMode = "for-you";
  currentSortMode = "smart";
  onlyFavoritesMode = false;
  updateWishlistUI();
  const si = document.getElementById("homeSearchInput");
  if (si) si.value = "";
  document.getElementById("activeMerchantBanner")?.classList.remove("visible");
  document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.toggle("active", el.getAttribute("data-quick") === "all"));
  document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(b => b.classList.toggle("active", b.getAttribute("data-mode") === "for-you"));
  renderProducts("all");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToProductsTop() {
  const target = document.getElementById("productsSectionHeading");
  if (!target) return;
  const h = document.querySelector(".top-app-bar")?.getBoundingClientRect().height || 50;
  window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - h - 54), behavior: "smooth" });
}

function renderSmartPriceChips(list) {
  const container = document.getElementById("smartPriceChipsContainer");
  if (!container) return;
  const prices = (list || []).map(p => Number(p.price) || 0).filter(v => v > 0);
  const tiers = [50, 100, 150, 300, 500, 1000].filter(t => prices.some(pr => pr <= t));
  let html = `<button type="button" class="price-chip-btn ${currentMaxPrice === 0 ? "active" : ""}" onclick="setPriceFilter(0)">الكل</button>`;
  tiers.forEach(t => {
    html += `<button type="button" class="price-chip-btn ${currentMaxPrice === t ? "active" : ""}" onclick="setPriceFilter(${t})">حتى ${t} ج</button>`;
  });
  container.innerHTML = html;
}

function getFilteredProducts(cat, searchRaw = "") {
  const q = normalizeText(searchRaw || "");
  const list = PRODUCTS.filter(p => {
    if (!p) return false;
    if (onlyFavoritesMode && !wishlistIds.includes(String(p.id))) return false;
    if (currentMerchant && p.merchant !== currentMerchant) return false;
    if (cat !== "all" && p.category !== cat && !(Array.isArray(p.categories) && p.categories.includes(cat))) return false;
    if (currentMaxPrice > 0 && ((Number(p.price) || 0) <= 0 || (Number(p.price) || 0) > currentMaxPrice)) return false;
    if (currentFeedMode === "deals" && !((Number(p.price) || 0) > 0 && (Number(p.price) || 0) <= 65)) return false;
    if (!q) return true;
    const hay = normalizeText(`${p.title} ${p.desc} ${p.merchant} ${p.category}`);
    return hay.includes(q);
  });
  if (currentSortMode === "price-asc") return [...list].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  if (currentSortMode === "price-desc") return [...list].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  if (currentFeedMode === "new") return [...list].reverse();
  return list;
}

function renderProductCardHtml(p) {
  const isFav = wishlistIds.includes(String(p.id));
  const price = formatPriceNumber(p.priceLabel || p.price);
  const imgs = getProductImagesList(p);
  const mainImg = imgs[0] || "";
  return `
    <article class="product-card" data-product-id="${escapeHtmlAttr(p.id)}">
      <button type="button" class="fav-toggle-btn ${isFav ? "active" : ""}" data-fav-id="${escapeHtmlAttr(p.id)}" aria-label="المفضلة" onclick="toggleProductFavorite('${escapeHtmlAttr(p.id)}', this, event)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </button>
      <div class="product-img-box" onclick="openImageModal('${escapeHtmlAttr(mainImg)}', '${escapeHtmlAttr(p.id)}')">
        <img src="${escapeHtmlAttr(mainImg)}" alt="${escapeHtmlAttr(p.title)}" loading="lazy" decoding="async" onload="this.style.opacity='1'">
      </div>
      <div class="product-details">
        <div>
          <div class="product-title">${escapeHtml(p.title)}</div>
          <div class="product-price-row"><div class="product-price">${price} <span>جنيه</span></div></div>
          <div class="product-desc">${escapeHtml(p.desc)}</div>
        </div>
        <div class="card-btns">
          <button type="button" class="add-cart-btn" id="btn-${escapeHtmlAttr(p.id)}" onclick="addToCart('${escapeHtmlAttr(p.id)}', this)">+ أضف للسلة</button>
          <a href="${escapeHtmlAttr(buildProductWhatsAppUrl(p, mainImg))}" class="direct-wa-link" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); launchWhatsAppTarget(this.href);">طلب</a>
        </div>
      </div>
    </article>
  `;
}

let currentRenderedList = [];
let renderedCount = 0;

function renderProducts(cat = "all") {
  currentCategory = cat;
  const grid = document.getElementById("productsGrid");
  const titleEl = document.getElementById("activeCategoryTitle");
  const badgeEl = document.getElementById("resultsCountBadge");
  const sentinel = document.getElementById("feedSentinel");
  if (!grid) return;

  if (isLoadingJsonProducts && !PRODUCTS.length) {
    if (titleEl) titleEl.textContent = "جاري تحميل منتجات متجر كارامل...";
    grid.innerHTML = `<div class="empty-state-box"><div class="empty-state-msg">جاري تحميل المنتجات...</div></div>`;
    return;
  }

  renderSmartPriceChips(PRODUCTS);
  const searchRaw = (document.getElementById("homeSearchInput")?.value || "").trim();
  const filtered = getFilteredProducts(cat, searchRaw);
  currentRenderedList = filtered;

  if (titleEl) {
    titleEl.textContent = `${CATEGORY_NAMES[cat] || "الكل"} — ${currentFeedMode === "new" ? "مدخلات جديدة" : currentFeedMode === "deals" ? "أسعار اقتصادية" : "من أجلك"}`;
  }
  if (badgeEl) {
    badgeEl.textContent = `${filtered.length} منتج`;
    badgeEl.classList.toggle("is-hidden", filtered.length === 0);
  }

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state-box"><div class="empty-state-msg">لا توجد منتجات مطابقة للاختيارات الحالية.</div><div class="empty-state-actions"><button type="button" class="search-clear-inline-btn" onclick="resetHomeFresh()">عرض كل المنتجات</button></div></div>`;
    if (sentinel) sentinel.textContent = "";
    renderedCount = 0;
    return;
  }

  const initial = Math.min(FULL_MODE_INITIAL_BATCH, filtered.length);
  grid.innerHTML = filtered.slice(0, initial).map(renderProductCardHtml).join("");
  renderedCount = initial;
  if (sentinel) {
    sentinel.textContent = renderedCount < filtered.length
      ? `معروض ${renderedCount} من ${filtered.length} — اسحب للأسفل للمزيد`
      : `تم عرض جميع المنتجات (${filtered.length})`;
  }
  setupInfiniteScrollObserver();
}

function appendNextBatch() {
  const grid = document.getElementById("productsGrid");
  const sentinel = document.getElementById("feedSentinel");
  if (!grid || isAppendingBatch || renderedCount >= currentRenderedList.length) return;
  isAppendingBatch = true;
  const slice = currentRenderedList.slice(renderedCount, renderedCount + BATCH_SIZE);
  grid.insertAdjacentHTML("beforeend", slice.map(renderProductCardHtml).join(""));
  renderedCount += slice.length;
  if (sentinel) {
    sentinel.textContent = renderedCount < currentRenderedList.length
      ? `معروض ${renderedCount} من ${currentRenderedList.length} — اسحب للأسفل للمزيد`
      : `تم عرض جميع المنتجات (${currentRenderedList.length})`;
  }
  isAppendingBatch = false;
}

function setupInfiniteScrollObserver() {
  const sentinel = document.getElementById("feedSentinel");
  if (!sentinel) return;
  if (feedObserver) feedObserver.disconnect();
  if ("IntersectionObserver" in window) {
    feedObserver = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && renderedCount < currentRenderedList.length) {
        appendNextBatch();
      }
    }, { rootMargin: "260px" });
    feedObserver.observe(sentinel);
  }
}

function renderSpotlightBoxes() {
  const tEl = document.getElementById("trendsSpotlightGrid");
  const dEl = document.getElementById("dealsSpotlightGrid");
  if (!tEl || !dEl || !PRODUCTS.length) return;
  trendSlideList = PRODUCTS.filter(p => p.images && p.images.length > 1).slice(0, 5);
  if (!trendSlideList.length) trendSlideList = PRODUCTS.slice(0, 5);
  dealSlideList = [...PRODUCTS].filter(p => p.price > 0).sort((a, b) => a.price - b.price).slice(0, 5);
  renderSingleSpotlightBox("trends", tEl, trendSlideList, trendSlideIdx);
  renderSingleSpotlightBox("deals", dEl, dealSlideList, dealSlideIdx);
}

function renderSingleSpotlightBox(kind, container, list, idx) {
  if (!container || !list.length) return;
  const item = list[idx % list.length];
  container.innerHTML = `<div class="visual-motion-card" onclick="openImageModal('${escapeHtmlAttr(item.img)}', '${escapeHtmlAttr(item.id)}')"><img src="${escapeHtmlAttr(item.img)}" alt="${escapeHtmlAttr(item.title)}" loading="eager"><div class="visual-price-overlay"><span class="visual-price-pill">${formatPriceNumber(item.price)} <span>جنيه</span></span></div></div>`;
}

function setMotionPaused(kind, p) { pausedMotionKind[kind] = Boolean(p); }

setInterval(() => {
  if (document.hidden || isAnyOverlayCurrentlyOpen()) return;
  if (!pausedMotionKind.trends && trendSlideList.length > 1) {
    trendSlideIdx = (trendSlideIdx + 1) % trendSlideList.length;
    renderSingleSpotlightBox("trends", document.getElementById("trendsSpotlightGrid"), trendSlideList, trendSlideIdx);
  }
  if (!pausedMotionKind.deals && dealSlideList.length > 1) {
    dealSlideIdx = (dealSlideIdx + 1) % dealSlideList.length;
    renderSingleSpotlightBox("deals", document.getElementById("dealsSpotlightGrid"), dealSlideList, dealSlideIdx);
  }
}, 3400);

function openImageModal(imgSrc, productId = "") {
  const m = document.getElementById("imageModal");
  const p = PRODUCTS.find(x => x.id === productId);
  if (!m) return;
  const imgs = p ? getProductImagesList(p) : [normalizeProductImageUrl(imgSrc)].filter(Boolean);
  const startIdx = Math.max(0, imgs.findIndex(u => u === normalizeProductImageUrl(imgSrc)));
  previewModalState = { productId: p ? p.id : "", imgs, idx: startIdx };
  const active = imgs[startIdx] || "";
  const imgEl = document.getElementById("modalImagePreview");
  if (imgEl) imgEl.src = active;
  document.getElementById("previewProductTitle").textContent = p ? p.title : "معاينة المنتج";
  document.getElementById("previewMainPrice").innerHTML = p ? `${formatPriceNumber(p.price)} <span>جنيه</span>` : "";
  document.getElementById("previewStoryText").textContent = p ? p.desc : "";
  const addBtn = document.getElementById("previewAddToCartBtn");
  const waBtn = document.getElementById("previewWhatsAppBtn");
  if (addBtn && p) {
    addBtn.classList.remove("is-hidden");
    addBtn.onclick = () => { closeImageModal(); addToCart(p.id, null, active); };
  }
  if (waBtn && p) {
    waBtn.classList.remove("is-hidden");
    waBtn.href = buildProductWhatsAppUrl(p, active);
    waBtn.onclick = e => { e.preventDefault(); launchWhatsAppTarget(waBtn.href); };
  }
  m.classList.add("open");
  syncBodyScrollLock();
  pushOverlayState("imageModal");
}

function closeImageModal(fromPop = false) {
  document.getElementById("imageModal")?.classList.remove("open");
  syncBodyScrollLock();
  if (!fromPop) removeOverlayState("imageModal");
}

function stepPreviewImage(d, e) {
  if (e) e.stopPropagation();
  const imgs = previewModalState.imgs || [];
  if (imgs.length <= 1) return;
  previewModalState.idx = ((previewModalState.idx + d) % imgs.length + imgs.length) % imgs.length;
  document.getElementById("modalImagePreview").src = imgs[previewModalState.idx];
}

function addToCart(id, btn, customImg = "") {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  if (Array.isArray(p.sizes) && p.sizes.length) {
    openProductOptionModal(p, btn ? btn.id : "", customImg || p.img);
    return;
  }
  const ex = cart.find(c => c.id === p.id && !c.selectedSize);
  if (ex) ex.qty += 1;
  else cart.push({ id: p.id, title: p.title, price: Number(p.price) || 0, img: customImg || p.img || "", merchant: p.merchant || "", qty: 1, selectedSize: "", note: "" });
  saveCart();
  updateCartUI();
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "تمت الإضافة ✓";
    btn.classList.add("added");
    setTimeout(() => { btn.textContent = orig; btn.classList.remove("added"); }, 900);
  }
}

function openProductOptionModal(p, btnId = "", preImg = "") {
  const m = document.getElementById("productOptionModal");
  if (!m || !p || !Array.isArray(p.sizes) || !p.sizes.length) return;
  const firstSize = p.sizes[0];
  pendingOptionSelection = {
    productId: p.id,
    clickedBtnId: btnId,
    selectedSize: typeof firstSize === "string" ? firstSize : firstSize.label,
    selectedColor: "",
    selectedImg: preImg || p.img || "",
    currentPrice: typeof firstSize === "object" ? (Number(firstSize.price) || Number(p.price) || 0) : (Number(p.price) || 0),
    qty: 1
  };
  document.getElementById("optionModalImg").src = pendingOptionSelection.selectedImg;
  document.getElementById("optionModalTitle").textContent = p.title;
  document.getElementById("optionModalPrice").innerHTML = `${formatPriceNumber(pendingOptionSelection.currentPrice)} <span>جنيه</span>`;
  document.getElementById("optionModalQtyVal").textContent = "1";
  document.getElementById("optionModalNoteInput").value = "";
  const sg = document.getElementById("optionModalSizeGroup");
  const sp = document.getElementById("optionModalSizePills");
  sg.classList.remove("is-hidden");
  document.getElementById("optionModalSizeLabel").textContent = p.sizeLabel || "اختر الخيار:";
  sp.innerHTML = p.sizes.map((s, i) => {
    const lbl = typeof s === "string" ? s : s.label;
    const prc = typeof s === "object" ? (Number(s.price) || Number(p.price) || 0) : (Number(p.price) || 0);
    return `<button type="button" class="option-pill-btn ${i === 0 ? "selected" : ""}" onclick="selectOptionPill('size','${escapeHtmlAttr(lbl)}',this,${prc})">${escapeHtml(lbl)}</button>`;
  }).join("");
  m.classList.add("open");
  syncBodyScrollLock();
  pushOverlayState("optionModal");
}

function closeProductOptionModal(fromPop = false) {
  document.getElementById("productOptionModal")?.classList.remove("open");
  syncBodyScrollLock();
  if (!fromPop) removeOverlayState("optionModal");
}

function selectOptionPill(type, val, btn, prc = 0) {
  pendingOptionSelection.selectedSize = val;
  if (prc > 0) {
    pendingOptionSelection.currentPrice = prc;
    document.getElementById("optionModalPrice").innerHTML = `${formatPriceNumber(prc)} <span>جنيه</span>`;
  }
  document.querySelectorAll("#optionModalSizePills .option-pill-btn").forEach(b => b.classList.remove("selected"));
  if (btn) btn.classList.add("selected");
}

function changeModalQty(d) {
  pendingOptionSelection.qty = Math.max(1, (pendingOptionSelection.qty || 1) + d);
  document.getElementById("optionModalQtyVal").textContent = String(pendingOptionSelection.qty);
}

function confirmAddProductWithOptions() {
  const p = PRODUCTS.find(x => x.id === pendingOptionSelection.productId);
  if (!p) return;
  const note = (document.getElementById("optionModalNoteInput")?.value || "").trim();
  const unitPrice = pendingOptionSelection.currentPrice || Number(p.price) || 0;
  const qty = pendingOptionSelection.qty || 1;
  const size = pendingOptionSelection.selectedSize || "";
  closeProductOptionModal();
  const ex = cart.find(c => c.id === p.id && (c.selectedSize || "") === size && (c.note || "") === note);
  if (ex) ex.qty += qty;
  else cart.push({ id: p.id, title: p.title, price: unitPrice, img: pendingOptionSelection.selectedImg || p.img || "", merchant: p.merchant || "", qty, selectedSize: size, note });
  saveCart();
  updateCartUI();
  showCaramelToast("تمت الإضافة إلى السلة");
}

function openCart() {
  renderCartItems();
  switchCartOrdersTab(activeCartOrdersTab);
  document.getElementById("cartDrawer")?.classList.add("open");
  document.getElementById("cartBackdrop")?.classList.add("open");
  syncBodyScrollLock();
  pushOverlayState("cartDrawer");
}

function closeCart(fromPop = false) {
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.getElementById("cartBackdrop")?.classList.remove("open");
  syncBodyScrollLock();
  if (!fromPop) removeOverlayState("cartDrawer");
}

function switchCartOrdersTab(tab) {
  activeCartOrdersTab = tab || "cart";
  document.getElementById("tabBtnCurrentCart")?.classList.toggle("active", activeCartOrdersTab === "cart");
  document.getElementById("tabBtnPendingOrders")?.classList.toggle("active", activeCartOrdersTab === "pending");
  document.getElementById("tabBtnReceivedOrders")?.classList.toggle("active", activeCartOrdersTab === "received");
  document.getElementById("currentCartSection")?.classList.toggle("is-hidden", activeCartOrdersTab !== "cart");
  document.getElementById("activeOrdersSection")?.classList.toggle("is-hidden", activeCartOrdersTab !== "pending");
  document.getElementById("receivedOrdersSection")?.classList.toggle("is-hidden", activeCartOrdersTab !== "received");
  if (activeCartOrdersTab === "pending") renderActiveOrders();
  else if (activeCartOrdersTab === "received") renderReceivedOrders();
}

function updateCartUI() {
  const pieces = cart.reduce((s, i) => s + (Number(i.qty) || 1), 0);
  const amount = cart.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.qty) || 1)), 0);
  const bBadge = document.getElementById("bottomCartCount");
  if (bBadge) { bBadge.textContent = String(pieces); bBadge.classList.toggle("visible", pieces > 0); }
  document.getElementById("currentCartCountBadge").textContent = String(pieces);
  document.getElementById("activeOrdersCountBadge").textContent = String(activeOrders.length);
  document.getElementById("receivedOrdersCountBadge").textContent = String(receivedOrders.length);
  document.getElementById("currentCartPageChip").textContent = `${pieces} قطعة`;
  document.getElementById("cartDistinctCount").textContent = String(cart.length);
  document.getElementById("cartTotalPieces").textContent = String(pieces);
  document.getElementById("cartTotalAmount").textContent = `${formatPriceNumber(amount)} جنيه`;
}

function renderCartItems() {
  const c = document.getElementById("cartItemsContainer");
  if (!c) return;
  if (!cart.length) {
    c.innerHTML = `<div class="cart-empty">سلة المشتريات الجارية فارغة حالياً.</div>`;
    return;
  }
  c.innerHTML = cart.map((it, i) => `
    <div class="cart-item">
      <div class="cart-item-top">
        <img src="${escapeHtmlAttr(it.img || "")}" alt="${escapeHtmlAttr(it.title)}">
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(it.title)}</div>
          <div class="cart-item-price">${formatPriceNumber(it.price)} جنيه × ${it.qty}${it.selectedSize ? ` (${escapeHtml(it.selectedSize)})` : ""}</div>
        </div>
        <div class="qty-controls">
          <button type="button" class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
          <span class="qty-val">${it.qty}</span>
          <button type="button" class="qty-btn" onclick="changeQty(${i}, -1)">-</button>
          <button type="button" class="remove-item-btn" onclick="removeCartItem(${i})">✕</button>
        </div>
      </div>
    </div>
  `).join("");
}

function changeQty(i, d) {
  if (!cart[i]) return;
  const n = (Number(cart[i].qty) || 1) + d;
  if (n <= 0) cart.splice(i, 1);
  else cart[i].qty = n;
  saveCart(); updateCartUI(); renderCartItems();
}

function removeCartItem(i) {
  if (!cart[i]) return;
  cart.splice(i, 1);
  saveCart(); updateCartUI(); renderCartItems();
}

function clearCart() {
  if (!cart.length) return;
  cart = [];
  saveCart(); updateCartUI(); renderCartItems();
  showCaramelToast("تم تفريغ السلة");
}

function renderActiveOrders() {
  const c = document.getElementById("activeOrdersContainer");
  if (!c) return;
  if (!activeOrders.length) {
    c.innerHTML = `<div class="active-orders-empty">لا توجد طلبات قيد التنفيذ حالياً.</div>`;
    return;
  }
  c.innerHTML = activeOrders.map(o => `<div class="active-order-item"><strong>#${escapeHtml(o.id)}</strong> — ${formatPriceNumber(o.total || 0)} جنيه</div>`).join("");
}

function renderReceivedOrders() {
  const c = document.getElementById("receivedOrdersContainer");
  if (!c) return;
  if (!receivedOrders.length) {
    c.innerHTML = `<div class="received-orders-empty">لا توجد أوردرات مستلمة حتى الآن.</div>`;
    return;
  }
  c.innerHTML = receivedOrders.map(o => `<div class="active-order-item"><strong>#${escapeHtml(o.id)}</strong> — ${formatPriceNumber(o.total || 0)} جنيه (مستلم)</div>`).join("");
}

function checkoutOnWhatsApp() {
  if (!cart.length) { showCaramelToast("السلة فارغة"); return; }
  const total = cart.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.qty) || 1)), 0);
  const orderId = `CRM-${101 + activeOrders.length + receivedOrders.length}`;
  const lines = cart.map((it, idx) => `${idx + 1}. ${it.title}${it.selectedSize ? ` (${it.selectedSize})` : ""} × ${it.qty} = ${(it.price * it.qty).toLocaleString("ar-EG")} جنيه`);
  const msg = [`طلب جديد — رقم الأوردر: #${orderId}`, "--------------------", ...lines, "--------------------", `الإجمالي: ${total.toLocaleString("ar-EG")} جنيه`].join("\n");
  activeOrders.unshift({ id: orderId, items: [...cart], total, createdAt: new Date().toLocaleString("ar-EG") });
  saveActiveOrders();
  cart = []; saveCart(); updateCartUI(); renderCartItems(); switchCartOrdersTab("pending");
  launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function copyOrderSummaryText() {
  if (!cart.length) { showCaramelToast("السلة فارغة"); return; }
  const total = cart.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.qty) || 1)), 0);
  const text = cart.map((it, i) => `${i + 1}. ${it.title} × ${it.qty}`).join("\n") + `\nالإجمالي: ${total} جنيه`;
  navigator.clipboard?.writeText(text).then(() => showCaramelToast("تم نسخ ملخص الطلب")).catch(() => {});
}

function openWhatsAppChatDirect() {
  launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("مرحباً متجر كارامل")}`);
}

function pulseBottomNavButton(id) {
  const b = document.getElementById(id);
  if (!b) return;
  b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
  setTimeout(() => b.classList.remove("pop"), 300);
}

async function shareStoreApp() {
  const txt = "متجر كارامل - Caramel Store:\n" + STORE_URL;
  if (navigator.share) {
    try { await navigator.share({ title: "متجر كارامل", text: txt, url: STORE_URL }); return; } catch (e) {}
  }
  navigator.clipboard?.writeText(txt).then(() => showCaramelToast("تم نسخ رابط المتجر!")).catch(() => {});
}

function syncHeaderInstallOrUpdateButton() {
  const btn = document.getElementById("headerInstallBtn");
  if (!btn) return;
  if (deferredInstallPrompt) {
    btn.classList.add("visible");
    btn.style.display = "inline-flex";
  } else {
    btn.classList.remove("visible");
    btn.style.display = "none";
  }
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  syncHeaderInstallOrUpdateButton();
});

function handleInstallOrUpdateAction() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    syncHeaderInstallOrUpdateButton();
  }
}

function enableCaramelPush() {
  showCaramelToast("إشعارات العروض متاحة عند فتح التطبيق عبر متصفح مدعوم");
}

function bindGlobalWindowEvents() {
  if (globalEventsBound) return;
  globalEventsBound = true;
  window.addEventListener("popstate", () => {
    if (overlayStack.length > 0) closeTopOverlay(true);
    else closeAllOverlays();
  });
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const btt = document.getElementById("backToTopFab");
    if (btt) btt.classList.toggle("visible", y > 420);
    const fill = document.getElementById("scrollProgressFill");
    if (fill) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.width = `${h > 0 ? Math.min(100, Math.max(0, (y / h) * 100)) : 0}%`;
    }
  }, { passive: true });
}

async function loadMerchantProductsFromJson() {
  isLoadingJsonProducts = true;
  renderProducts(currentCategory);
  const files = ["./mohamed-ghareeb.json", "./merchants/mohamed-ghareeb.json"];
  for (const url of files) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r && r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length) {
          PRODUCTS.splice(0, PRODUCTS.length, ...data);
          break;
        }
      }
    } catch (e) {}
  }
  isLoadingJsonProducts = false;
  renderSpotlightBoxes();
  renderProducts(currentCategory);
  updateCartUI();
  updateWishlistUI();
}

function runSplash() {
  const sp = document.getElementById("caramelSplashScreen");
  const sub = document.getElementById("caramelSplashSubRect");
  if (!sp) return;
  requestAnimationFrame(() => requestAnimationFrame(() => sub?.classList.add("descend-in")));
  setTimeout(() => {
    sp.classList.add("hide");
    setTimeout(() => sp.parentNode?.removeChild(sp), 450);
  }, 1050);
}

function initApp() {
  runSplash();
  initThemeMode();
  bindGlobalWindowEvents();
  syncHeaderStickyOffsets();
  renderSmartSearchSuggestions();
  updateCartUI();
  updateWishlistUI();
  loadMerchantProductsFromJson();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
